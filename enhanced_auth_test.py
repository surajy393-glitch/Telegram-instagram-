#!/usr/bin/env python3
"""
Enhanced Authentication System Testing for LuvHive
Tests the newly implemented enhanced authentication endpoints
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
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://luvhive-whereby.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class EnhancedAuthTester:
    def __init__(self):
        self.session = requests.Session()
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
    
    def test_enhanced_registration_with_mobile(self):
        """Test POST /api/auth/register-enhanced with mobile number"""
        try:
            timestamp = datetime.now().strftime('%H%M%S%f')
            user_data = {
                "fullName": "Sarah Johnson Enhanced",
                "username": f"sarah_enh_{timestamp}",
                "age": 27,
                "gender": "female",
                "password": "SecurePass789!",
                "email": f"sarah.enhanced.{timestamp}@example.com",
                "mobileNumber": f"+123456{timestamp[-4:]}"  # Unique mobile
            }
            
            response = self.session.post(f"{API_BASE}/auth/register-enhanced", json=user_data)
            
            if response.status_code == 200:
                data = response.json()
                user = data.get('user', {})
                
                # Check required fields
                required_fields = ['id', 'fullName', 'username', 'email', 'mobileNumber', 'age', 'gender']
                missing_fields = [field for field in required_fields if field not in user]
                
                if missing_fields:
                    self.log_result("Enhanced Registration with Mobile", False, f"Missing fields: {missing_fields}")
                elif not user['mobileNumber'] or len(user['mobileNumber']) < 10:
                    self.log_result("Enhanced Registration with Mobile", False, f"Mobile number issue: {user['mobileNumber']}")
                elif 'access_token' not in data:
                    self.log_result("Enhanced Registration with Mobile", False, "Missing access token")
                else:
                    self.log_result("Enhanced Registration with Mobile", True, 
                                  f"Successfully registered with mobile: {user['username']}, mobile: {user['mobileNumber']}")
            else:
                self.log_result("Enhanced Registration with Mobile", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Enhanced Registration with Mobile", False, "Exception occurred", str(e))
    
    def test_enhanced_registration_without_mobile(self):
        """Test POST /api/auth/register-enhanced without mobile number (optional field)"""
        try:
            timestamp = datetime.now().strftime('%H%M%S%f')
            user_data = {
                "fullName": "Mike Wilson Enhanced",
                "username": f"mike_enh_{timestamp}",
                "age": 30,
                "gender": "male",
                "password": "SecurePass456!",
                "email": f"mike.enhanced.{timestamp}@example.com"
                # No mobileNumber field
            }
            
            response = self.session.post(f"{API_BASE}/auth/register-enhanced", json=user_data)
            
            if response.status_code == 200:
                data = response.json()
                user = data.get('user', {})
                
                # Check that mobile number is None or empty
                mobile = user.get('mobileNumber')
                if mobile is None or mobile == "" or mobile == "null":
                    self.log_result("Enhanced Registration without Mobile", True, 
                                  f"Successfully registered without mobile: {user['username']}")
                else:
                    self.log_result("Enhanced Registration without Mobile", False, 
                                  f"Mobile number should be None/empty, got: {mobile}")
            else:
                self.log_result("Enhanced Registration without Mobile", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Enhanced Registration without Mobile", False, "Exception occurred", str(e))
    
    def test_enhanced_registration_validation(self):
        """Test POST /api/auth/register-enhanced validation (email format, mobile format, etc.)"""
        try:
            timestamp = datetime.now().strftime('%H%M%S%f')
            
            # Test invalid email format
            invalid_email_data = {
                "fullName": "Test User",
                "username": f"test_invalid_{timestamp}",
                "age": 25,
                "gender": "other",
                "password": "SecurePass123!",
                "email": "invalid-email-format",
                "mobileNumber": f"+1234567{timestamp[-3:]}"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register-enhanced", json=invalid_email_data)
            
            if response.status_code == 400:
                self.log_result("Enhanced Registration Validation (Email)", True, "Correctly rejected invalid email format")
            else:
                self.log_result("Enhanced Registration Validation (Email)", False, f"Expected 400, got {response.status_code}")
            
            # Test invalid mobile number format (too short)
            timestamp2 = datetime.now().strftime('%H%M%S%f')
            invalid_mobile_data = {
                "fullName": "Test User",
                "username": f"test_mobile_{timestamp2}",
                "age": 25,
                "gender": "other",
                "password": "SecurePass123!",
                "email": f"test.mobile.{timestamp2}@example.com",
                "mobileNumber": "123"  # Too short
            }
            
            response2 = self.session.post(f"{API_BASE}/auth/register-enhanced", json=invalid_mobile_data)
            
            if response2.status_code == 400:
                self.log_result("Enhanced Registration Validation (Mobile)", True, "Correctly rejected invalid mobile format")
            else:
                self.log_result("Enhanced Registration Validation (Mobile)", False, f"Expected 400, got {response2.status_code}")
            
            # Test missing required fields
            timestamp3 = datetime.now().strftime('%H%M%S%f')
            missing_fields_data = {
                "fullName": "Test User",
                "username": f"test_missing_{timestamp3}",
                "age": 25,
                "gender": "other"
                # Missing password and email
            }
            
            response3 = self.session.post(f"{API_BASE}/auth/register-enhanced", json=missing_fields_data)
            
            if response3.status_code in [400, 422]:  # Accept both 400 and 422 for validation errors
                self.log_result("Enhanced Registration Validation (Missing Fields)", True, f"Correctly rejected missing required fields (status: {response3.status_code})")
            else:
                self.log_result("Enhanced Registration Validation (Missing Fields)", False, f"Expected 400/422, got {response3.status_code}")
                
        except Exception as e:
            self.log_result("Enhanced Registration Validation", False, "Exception occurred", str(e))
    
    def test_telegram_signin_flow(self):
        """Test complete Telegram signin flow: register -> signin -> verify OTP"""
        try:
            # First create a Telegram user
            load_dotenv('/app/backend/.env')
            telegram_bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', "8494034049:AAEb5jiuYLUMmkjsIURx6RqhHJ4mj3bOI10")
            
            if not telegram_bot_token:
                self.log_result("Telegram Signin Flow", False, "Telegram bot token not configured")
                return
            
            # Create realistic Telegram auth data
            unique_id = int(time.time() * 1000) % 1000000  # More unique ID
            auth_data = {
                "id": unique_id,
                "first_name": "TelegramSignin",
                "last_name": "TestUser", 
                "username": f"tg_signin_{unique_id}",
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
            
            # Step 1: Register via Telegram
            reg_response = self.session.post(f"{API_BASE}/auth/telegram", json=telegram_request)
            
            if reg_response.status_code == 200:
                self.log_result("Telegram Registration for Signin", True, f"Successfully registered Telegram user: {unique_id}")
                
                # Step 2: Test telegram signin (should send OTP)
                signin_request = {
                    "telegramId": unique_id
                }
                
                signin_response = self.session.post(f"{API_BASE}/auth/telegram-signin", json=signin_request)
                
                if signin_response.status_code == 200:
                    signin_data = signin_response.json()
                    
                    if signin_data.get('otpSent') and signin_data.get('telegramId') == unique_id:
                        self.log_result("Telegram Signin (OTP Send)", True, 
                                      f"OTP sent successfully to Telegram ID: {unique_id}")
                        
                        # Step 3: Test OTP verification (will fail with invalid OTP, but tests endpoint)
                        verify_request = {
                            "telegramId": unique_id,
                            "otp": "123456"  # Invalid OTP
                        }
                        
                        verify_response = self.session.post(f"{API_BASE}/auth/verify-telegram-otp", json=verify_request)
                        
                        if verify_response.status_code == 401:
                            verify_data = verify_response.json()
                            if 'Invalid or expired OTP' in verify_data.get('detail', ''):
                                self.log_result("Telegram OTP Verification", True, 
                                              "OTP verification endpoint working (correctly rejected invalid OTP)")
                            else:
                                self.log_result("Telegram OTP Verification", False, f"Unexpected error message: {verify_data}")
                        else:
                            self.log_result("Telegram OTP Verification", False, f"Expected 401, got {verify_response.status_code}")
                    else:
                        self.log_result("Telegram Signin (OTP Send)", False, f"Unexpected response: {signin_data}")
                else:
                    self.log_result("Telegram Signin (OTP Send)", False, f"Status: {signin_response.status_code}", signin_response.text)
            else:
                self.log_result("Telegram Registration for Signin", False, f"Status: {reg_response.status_code}", reg_response.text)
                
        except Exception as e:
            self.log_result("Telegram Signin Flow", False, "Exception occurred", str(e))
    
    def test_telegram_signin_invalid_cases(self):
        """Test Telegram signin error cases"""
        try:
            # Test with non-existent Telegram ID
            signin_request = {
                "telegramId": 999999999  # Non-existent ID
            }
            
            response = self.session.post(f"{API_BASE}/auth/telegram-signin", json=signin_request)
            
            if response.status_code == 404:
                self.log_result("Telegram Signin (Invalid User)", True, "Correctly rejected non-existent Telegram ID")
            else:
                self.log_result("Telegram Signin (Invalid User)", False, f"Expected 404, got {response.status_code}")
            
            # Test OTP verification with non-existent user
            verify_request = {
                "telegramId": 999999999,  # Non-existent user
                "otp": "000000"
            }
            
            verify_response = self.session.post(f"{API_BASE}/auth/verify-telegram-otp", json=verify_request)
            
            if verify_response.status_code == 401:
                self.log_result("Telegram OTP (Invalid User)", True, "Correctly rejected OTP for non-existent user")
            else:
                self.log_result("Telegram OTP (Invalid User)", False, f"Expected 401, got {verify_response.status_code}")
                
        except Exception as e:
            self.log_result("Telegram Signin Invalid Cases", False, "Exception occurred", str(e))
    
    def test_enhanced_auth_endpoints_no_auth_required(self):
        """Test that enhanced auth endpoints work without authentication"""
        try:
            # Create session without auth token
            unauth_session = requests.Session()
            
            # Test register-enhanced (should work without auth)
            timestamp = datetime.now().strftime('%H%M%S%f')
            reg_request = {
                "fullName": "Test User NoAuth",
                "username": f"test_noauth_{timestamp}",
                "age": 25,
                "gender": "other",
                "password": "SecurePass123!",
                "email": f"test.noauth.{timestamp}@example.com"
            }
            reg_response = unauth_session.post(f"{API_BASE}/auth/register-enhanced", json=reg_request)
            
            if reg_response.status_code == 200:
                # Test telegram-signin (should work without auth)
                signin_request = {"telegramId": 123456789}
                signin_response = unauth_session.post(f"{API_BASE}/auth/telegram-signin", json=signin_request)
                
                # Should return 404 (user not found) not 401 (auth required)
                if signin_response.status_code == 404:
                    # Test verify-telegram-otp (should work without auth)
                    verify_request = {"telegramId": 123456789, "otp": "123456"}
                    verify_response = unauth_session.post(f"{API_BASE}/auth/verify-telegram-otp", json=verify_request)
                    
                    # Should return 401 (invalid OTP) not 401 (auth required)
                    if verify_response.status_code == 401:
                        self.log_result("Enhanced Auth No Authentication Required", True, 
                                      "All enhanced auth endpoints work without authentication as expected")
                    else:
                        self.log_result("Enhanced Auth No Authentication Required", False, 
                                      f"Verify OTP unexpected status: {verify_response.status_code}")
                else:
                    self.log_result("Enhanced Auth No Authentication Required", False, 
                                  f"Telegram signin unexpected status: {signin_response.status_code}")
            else:
                self.log_result("Enhanced Auth No Authentication Required", False, 
                              f"Register-enhanced failed: {reg_response.status_code}")
                
        except Exception as e:
            self.log_result("Enhanced Auth No Authentication Required", False, "Exception occurred", str(e))
    
    def run_all_tests(self):
        """Run all enhanced authentication tests"""
        print("=" * 70)
        print("LUVHIVE ENHANCED AUTHENTICATION SYSTEM TESTING")
        print("=" * 70)
        print(f"Testing against: {API_BASE}")
        print()
        
        print("Testing Enhanced Registration...")
        self.test_enhanced_registration_with_mobile()
        self.test_enhanced_registration_without_mobile()
        self.test_enhanced_registration_validation()
        
        print("Testing Telegram Signin Flow...")
        self.test_telegram_signin_flow()
        self.test_telegram_signin_invalid_cases()
        
        print("Testing Authentication Requirements...")
        self.test_enhanced_auth_endpoints_no_auth_required()
        
        # Summary
        print("=" * 70)
        print("ENHANCED AUTHENTICATION TEST SUMMARY")
        print("=" * 70)
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"Total Tests: {self.results['passed'] + self.results['failed']}")
        
        if self.results['errors']:
            print("\nFAILED TESTS:")
            for error in self.results['errors']:
                print(f"- {error['test']}: {error['message']}")
                if error['error']:
                    print(f"  Error: {error['error']}")
        
        return self.results['failed'] == 0

if __name__ == "__main__":
    tester = EnhancedAuthTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)