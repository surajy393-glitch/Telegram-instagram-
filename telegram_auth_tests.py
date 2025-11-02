#!/usr/bin/env python3
"""
Focused Telegram Authentication Tests
Tests the 4 specific methods requested for comprehensive Telegram authentication verification
"""

import requests
import json
import sys
import os
import time
import hashlib
import hmac
from datetime import datetime

# Load environment variables
sys.path.append('/app/backend')
from dotenv import load_dotenv
load_dotenv('/app/frontend/.env')

# Get backend URL from frontend env
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://repo-testing.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class TelegramAuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.current_user_id = None
        self.results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }
    
    def log_result(self, test_name, success, message="", error_details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if error_details:
            print(f"   Error: {error_details}")
        
        if success:
            self.results['passed'] += 1
        else:
            self.results['failed'] += 1
            self.results['errors'].append({
                'test': test_name,
                'message': message,
                'error': error_details
            })
        print()
    
    def register_test_user(self):
        """Register a test user for authentication"""
        try:
            user_data = {
                "fullName": "Test User",
                "username": f"testuser_{datetime.now().strftime('%H%M%S')}",
                "age": 25,
                "gender": "female",
                "password": "SecurePass123!",
                "email": f"test.{datetime.now().strftime('%H%M%S')}@example.com"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=user_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data['access_token']
                self.current_user_id = data['user']['id']
                self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                return True
            else:
                print(f"❌ User registration failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ User registration error: {str(e)}")
            return False
    
    def test_telegram_registration_complete_profile(self):
        """Test POST /api/auth/telegram creates complete user profiles for EditProfile compatibility"""
        try:
            # Load bot token
            load_dotenv('/app/backend/.env')
            telegram_bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', "8494034049:AAEb5jiuYLUMmkjsIURx6RqhHJ4mj3bOI10")
            
            # Create realistic Telegram auth data
            unique_id = int(time.time()) % 1000000
            auth_data = {
                "id": unique_id,
                "first_name": "TelegramUser",
                "last_name": "TestProfile", 
                "username": f"tg_user_{unique_id}",
                "photo_url": "https://t.me/i/userpic/320/test.jpg",
                "auth_date": int(time.time()) - 60
            }
            
            # Generate proper hash
            data_check_arr = []
            for key, value in sorted(auth_data.items()):
                data_check_arr.append(f"{key}={value}")
            
            data_check_string = '\n'.join(data_check_arr)
            secret_key = hashlib.sha256(telegram_bot_token.encode()).digest()
            correct_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
            
            telegram_request = {
                "id": auth_data["id"],
                "first_name": auth_data["first_name"],
                "last_name": auth_data["last_name"],
                "username": auth_data["username"],
                "photo_url": auth_data["photo_url"],
                "auth_date": auth_data["auth_date"],
                "hash": correct_hash
            }
            
            response = self.session.post(f"{API_BASE}/auth/telegram", json=telegram_request)
            
            if response.status_code == 200:
                data = response.json()
                user = data.get('user', {})
                
                # Check ALL required fields for EditProfile compatibility
                required_fields = {
                    'basic_info': ['id', 'fullName', 'username', 'email', 'age', 'gender', 'bio'],
                    'telegram_fields': ['telegramId', 'telegramUsername', 'telegramFirstName', 'authMethod'],
                    'profile_fields': ['profileImage', 'followers', 'following', 'posts'],
                    'preferences': ['preferences'],
                    'privacy': ['privacy'],
                    'social_links': ['socialLinks'],
                    'additional': ['interests', 'location', 'appearInSearch']
                }
                
                missing_fields = []
                field_issues = []
                
                # Check each category
                for category, fields in required_fields.items():
                    for field in fields:
                        if field not in user:
                            missing_fields.append(f"{category}.{field}")
                        elif field == 'email' and not user[field]:
                            field_issues.append(f"email is null/empty: {user[field]}")
                        elif field == 'email' and not user[field].endswith('@luvhive.app'):
                            field_issues.append(f"email format incorrect: {user[field]}")
                
                # Verify email format specifically
                expected_email = f"tg{unique_id}@luvhive.app"
                if user.get('email') != expected_email:
                    field_issues.append(f"email should be {expected_email}, got {user.get('email')}")
                
                # Check nested objects
                if 'preferences' in user and user['preferences']:
                    pref_fields = ['showAge', 'showOnlineStatus', 'allowMessages']
                    for pref in pref_fields:
                        if pref not in user['preferences']:
                            missing_fields.append(f"preferences.{pref}")
                
                if 'privacy' in user and user['privacy']:
                    privacy_fields = ['profileVisibility', 'showLastSeen']
                    for priv in privacy_fields:
                        if priv not in user['privacy']:
                            missing_fields.append(f"privacy.{priv}")
                
                if 'socialLinks' in user and user['socialLinks']:
                    social_fields = ['instagram', 'twitter', 'website']
                    for social in social_fields:
                        if social not in user['socialLinks']:
                            missing_fields.append(f"socialLinks.{social}")
                
                if missing_fields or field_issues:
                    error_msg = ""
                    if missing_fields:
                        error_msg += f"Missing fields: {missing_fields}. "
                    if field_issues:
                        error_msg += f"Field issues: {field_issues}."
                    self.log_result("test_telegram_registration_complete_profile()", False, error_msg)
                else:
                    self.log_result("test_telegram_registration_complete_profile()", True, 
                                  f"✅ Complete profile created: email={user['email']}, preferences={bool(user.get('preferences'))}, privacy={bool(user.get('privacy'))}, socialLinks={bool(user.get('socialLinks'))}")
            else:
                self.log_result("test_telegram_registration_complete_profile()", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("test_telegram_registration_complete_profile()", False, "Exception occurred", str(e))
    
    def test_telegram_bot_check_complete_profile(self):
        """Test POST /api/auth/telegram-bot-check creates complete MongoDB users from PostgreSQL"""
        try:
            # Test the bot check endpoint that creates users from PostgreSQL
            response = self.session.post(f"{API_BASE}/auth/telegram-bot-check", json={})
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('authenticated'):
                    user = data.get('user', {})
                    
                    # Check that user has all required fields for EditProfile
                    required_fields = ['id', 'username', 'fullName', 'authMethod']
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if missing_fields:
                        self.log_result("test_telegram_bot_check_complete_profile()", False, f"Missing basic fields: {missing_fields}")
                    else:
                        # Now get the full user profile to check completeness
                        if 'access_token' in data:
                            # Use the token to get full profile
                            temp_session = requests.Session()
                            temp_session.headers.update({'Authorization': f'Bearer {data["access_token"]}'})
                            
                            me_response = temp_session.get(f"{API_BASE}/auth/me")
                            if me_response.status_code == 200:
                                full_user = me_response.json()
                                
                                # Check for EditProfile required fields
                                editprofile_fields = ['email', 'age', 'gender', 'bio']
                                missing_editprofile = [field for field in editprofile_fields if field not in full_user]
                                
                                # Check email format (allow None for age/gender as they have defaults)
                                email_valid = full_user.get('email', '').endswith('@luvhive.app')
                                
                                if missing_editprofile:
                                    self.log_result("test_telegram_bot_check_complete_profile()", False, 
                                                  f"Missing EditProfile fields: {missing_editprofile}")
                                elif not email_valid:
                                    self.log_result("test_telegram_bot_check_complete_profile()", False, 
                                                  f"Invalid email format: {full_user.get('email')}")
                                else:
                                    self.log_result("test_telegram_bot_check_complete_profile()", True, 
                                                  f"✅ Complete profile from PostgreSQL: email={full_user['email']}, age={full_user['age']}, gender={full_user['gender']}")
                            else:
                                self.log_result("test_telegram_bot_check_complete_profile()", False, f"Could not get full user profile: {me_response.status_code} - {me_response.text}")
                        else:
                            self.log_result("test_telegram_bot_check_complete_profile()", False, "No access token in response")
                else:
                    self.log_result("test_telegram_bot_check_complete_profile()", True, 
                                  "✅ No recent Telegram authentication found (expected behavior)")
            else:
                self.log_result("test_telegram_bot_check_complete_profile()", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("test_telegram_bot_check_complete_profile()", False, "Exception occurred", str(e))
    
    def test_compare_telegram_vs_normal_user_structure(self):
        """Compare Telegram user structure with normal registration user structure"""
        try:
            # First create a normal user for comparison
            normal_user_data = {
                "fullName": "Normal User",
                "username": f"normal_user_{int(time.time()) % 1000000}",
                "age": 25,
                "gender": "female",
                "password": "SecurePass123!",
                "email": "normal@example.com"
            }
            
            normal_response = self.session.post(f"{API_BASE}/auth/register", json=normal_user_data)
            
            if normal_response.status_code == 200:
                normal_user = normal_response.json()['user']
                
                # Now create a Telegram user
                load_dotenv('/app/backend/.env')
                telegram_bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', "8494034049:AAEb5jiuYLUMmkjsIURx6RqhHJ4mj3bOI10")
                unique_id = int(time.time()) % 1000000
                
                auth_data = {
                    "id": unique_id,
                    "first_name": "Telegram",
                    "last_name": "User",
                    "username": f"tg_compare_{unique_id}",
                    "photo_url": "https://t.me/i/userpic/320/test.jpg",
                    "auth_date": int(time.time()) - 60
                }
                
                # Generate hash
                data_check_arr = []
                for key, value in sorted(auth_data.items()):
                    data_check_arr.append(f"{key}={value}")
                
                data_check_string = '\n'.join(data_check_arr)
                secret_key = hashlib.sha256(telegram_bot_token.encode()).digest()
                correct_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
                
                telegram_request = {
                    "id": auth_data["id"],
                    "first_name": auth_data["first_name"],
                    "last_name": auth_data["last_name"],
                    "username": auth_data["username"],
                    "photo_url": auth_data["photo_url"],
                    "auth_date": auth_data["auth_date"],
                    "hash": correct_hash
                }
                
                telegram_response = self.session.post(f"{API_BASE}/auth/telegram", json=telegram_request)
                
                if telegram_response.status_code == 200:
                    telegram_user = telegram_response.json()['user']
                    
                    # Compare field structures
                    normal_fields = set(normal_user.keys())
                    telegram_fields = set(telegram_user.keys())
                    
                    # Fields that should be in both
                    common_required = {'id', 'fullName', 'username', 'age', 'gender', 'email'}
                    
                    missing_in_telegram = common_required - telegram_fields
                    missing_in_normal = common_required - normal_fields
                    
                    # Check email validity
                    telegram_email_valid = telegram_user.get('email', '').endswith('@luvhive.app')
                    normal_email_valid = normal_user.get('email') == normal_user_data['email']
                    
                    issues = []
                    if missing_in_telegram:
                        issues.append(f"Missing in Telegram user: {missing_in_telegram}")
                    if missing_in_normal:
                        issues.append(f"Missing in normal user: {missing_in_normal}")
                    if not telegram_email_valid:
                        issues.append(f"Telegram email invalid: {telegram_user.get('email')}")
                    if not normal_email_valid:
                        issues.append(f"Normal email invalid: {normal_user.get('email')}")
                    
                    if issues:
                        self.log_result("test_compare_telegram_vs_normal_user_structure()", False, "; ".join(issues))
                    else:
                        self.log_result("test_compare_telegram_vs_normal_user_structure()", True, 
                                      f"✅ Both user types have identical required fields. Telegram email: {telegram_user['email']}, Normal email: {normal_user['email']}")
                else:
                    self.log_result("test_compare_telegram_vs_normal_user_structure()", False, f"Telegram user creation failed: {telegram_response.status_code}")
            else:
                self.log_result("test_compare_telegram_vs_normal_user_structure()", False, f"Normal user creation failed: {normal_response.status_code}")
                
        except Exception as e:
            self.log_result("test_compare_telegram_vs_normal_user_structure()", False, "Exception occurred", str(e))
    
    def test_telegram_user_editprofile_compatibility(self):
        """Test that Telegram users have all fields needed for EditProfile functionality"""
        try:
            # Create a Telegram user and verify EditProfile compatibility
            load_dotenv('/app/backend/.env')
            telegram_bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', "8494034049:AAEb5jiuYLUMmkjsIURx6RqhHJ4mj3bOI10")
            unique_id = int(time.time()) % 1000000
            
            auth_data = {
                "id": unique_id,
                "first_name": "EditProfile",
                "last_name": "TestUser",
                "username": f"editprofile_test_{unique_id}",
                "photo_url": "https://t.me/i/userpic/320/test.jpg",
                "auth_date": int(time.time()) - 60
            }
            
            # Generate hash
            data_check_arr = []
            for key, value in sorted(auth_data.items()):
                data_check_arr.append(f"{key}={value}")
            
            data_check_string = '\n'.join(data_check_arr)
            secret_key = hashlib.sha256(telegram_bot_token.encode()).digest()
            correct_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
            
            telegram_request = {
                "id": auth_data["id"],
                "first_name": auth_data["first_name"],
                "last_name": auth_data["last_name"],
                "username": auth_data["username"],
                "photo_url": auth_data["photo_url"],
                "auth_date": auth_data["auth_date"],
                "hash": correct_hash
            }
            
            response = self.session.post(f"{API_BASE}/auth/telegram", json=telegram_request)
            
            if response.status_code == 200:
                data = response.json()
                
                # Use the token to get full profile
                temp_session = requests.Session()
                temp_session.headers.update({'Authorization': f'Bearer {data["access_token"]}'})
                
                me_response = temp_session.get(f"{API_BASE}/auth/me")
                if me_response.status_code == 200:
                    user = me_response.json()
                    
                    # Check basic fields that EditProfile page would need (from /api/auth/me response)
                    basic_required = ['id', 'fullName', 'username', 'age', 'gender', 'bio', 'profileImage']
                    email_required = True  # Email should be present and valid
                    
                    missing_fields = []
                    field_issues = []
                    
                    # Check basic fields
                    for field in basic_required:
                        if field not in user:
                            missing_fields.append(field)
                    
                    # Check email specifically
                    if 'email' not in user:
                        missing_fields.append('email')
                    elif not user['email'] or user['email'] is None:
                        field_issues.append(f"email is null: {user['email']}")
                    elif not user['email'].endswith('@luvhive.app'):
                        field_issues.append(f"email format incorrect: {user['email']}")
                    
                    # Test profile update functionality
                    update_data = {
                        "fullName": "Updated Telegram User",
                        "bio": "Updated bio for EditProfile test"
                    }
                    
                    update_response = temp_session.put(f"{API_BASE}/auth/profile", data=update_data)
                    update_success = update_response.status_code == 200
                    
                    if missing_fields or field_issues:
                        error_msg = ""
                        if missing_fields:
                            error_msg += f"Missing fields: {missing_fields}. "
                        if field_issues:
                            error_msg += f"Field issues: {field_issues}."
                        self.log_result("test_telegram_user_editprofile_compatibility()", False, error_msg)
                    elif not update_success:
                        self.log_result("test_telegram_user_editprofile_compatibility()", False, 
                                      f"Profile update failed: {update_response.status_code}")
                    else:
                        self.log_result("test_telegram_user_editprofile_compatibility()", True, 
                                      f"✅ Full EditProfile compatibility: email={user['email']}, all basic fields present, profile update successful")
                else:
                    self.log_result("test_telegram_user_editprofile_compatibility()", False, f"Could not get full user profile: {me_response.status_code}")
            else:
                self.log_result("test_telegram_user_editprofile_compatibility()", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("test_telegram_user_editprofile_compatibility()", False, "Exception occurred", str(e))
    
    def run_comprehensive_telegram_tests(self):
        """Run the 4 comprehensive Telegram authentication tests"""
        print("=" * 80)
        print("COMPREHENSIVE TELEGRAM AUTHENTICATION TESTS")
        print("=" * 80)
        print(f"Testing against: {API_BASE}")
        print()
        
        # Setup phase
        if not self.register_test_user():
            print("❌ Cannot proceed without authenticated user")
            return
        
        print("🔍 Running 4 Comprehensive Telegram Authentication Tests...")
        print()
        
        print("1️⃣ Testing Telegram Registration Complete Profile...")
        self.test_telegram_registration_complete_profile()
        
        print("2️⃣ Testing Telegram Bot Check Complete Profile...")
        self.test_telegram_bot_check_complete_profile()
        
        print("3️⃣ Testing Telegram vs Normal User Structure Comparison...")
        self.test_compare_telegram_vs_normal_user_structure()
        
        print("4️⃣ Testing Telegram User EditProfile Compatibility...")
        self.test_telegram_user_editprofile_compatibility()
        
        # Summary
        print("=" * 80)
        print("COMPREHENSIVE TEST RESULTS")
        print("=" * 80)
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"Total Tests: {self.results['passed'] + self.results['failed']}")
        
        if self.results['errors']:
            print("\n🔍 DETAILED FAILURE ANALYSIS:")
            for error in self.results['errors']:
                print(f"❌ {error['test']}")
                print(f"   Issue: {error['message']}")
                if error['error']:
                    print(f"   Error: {error['error']}")
                print()
        else:
            print("\n🎉 ALL TELEGRAM AUTHENTICATION TESTS PASSED!")
            print("✅ User profile completeness verification")
            print("✅ Email field validation (tg{id}@luvhive.app format)")
            print("✅ Field structure comparison between normal and Telegram users")
            print("✅ EditProfile functionality compatibility")
        
        return self.results['failed'] == 0

if __name__ == "__main__":
    tester = TelegramAuthTester()
    success = tester.run_comprehensive_telegram_tests()
    sys.exit(0 if success else 1)