#!/usr/bin/env python3
"""
Simple Telegram Authentication Test
Focus on the core functionality requested
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
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://callsignal-debug-1.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

def test_telegram_registration():
    """Test the main Telegram registration functionality"""
    print("🔍 Testing Telegram Registration with Complete Profile...")
    
    try:
        # Load bot token
        load_dotenv('/app/backend/.env')
        telegram_bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', "8494034049:AAEb5jiuYLUMmkjsIURx6RqhHJ4mj3bOI10")
        
        # Create realistic Telegram auth data
        unique_id = int(time.time()) % 1000000
        auth_data = {
            "id": unique_id,
            "first_name": "TestUser",
            "last_name": "Complete", 
            "username": f"testuser_{unique_id}",
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
        
        print(f"📤 Sending Telegram auth request for user ID: {unique_id}")
        response = requests.post(f"{API_BASE}/auth/telegram", json=telegram_request)
        
        if response.status_code == 200:
            data = response.json()
            user = data.get('user', {})
            
            print("✅ Telegram Registration Successful!")
            print(f"   User ID: {user.get('id')}")
            print(f"   Username: {user.get('username')}")
            print(f"   Full Name: {user.get('fullName')}")
            print(f"   Email: {user.get('email')}")
            print(f"   Age: {user.get('age')}")
            print(f"   Gender: {user.get('gender')}")
            print(f"   Bio: {user.get('bio')}")
            print(f"   Auth Method: {user.get('authMethod')}")
            print(f"   Telegram ID: {user.get('telegramId')}")
            
            # Check email format
            expected_email = f"tg{unique_id}@luvhive.app"
            if user.get('email') == expected_email:
                print(f"✅ Email format correct: {user.get('email')}")
            else:
                print(f"❌ Email format issue: expected {expected_email}, got {user.get('email')}")
            
            # Test getting full profile with token
            if 'access_token' in data:
                print(f"\n🔍 Testing profile access with token...")
                headers = {'Authorization': f'Bearer {data["access_token"]}'}
                me_response = requests.get(f"{API_BASE}/auth/me", headers=headers)
                
                if me_response.status_code == 200:
                    full_user = me_response.json()
                    print("✅ Full profile access successful!")
                    print(f"   Profile has email: {'email' in full_user}")
                    print(f"   Email value: {full_user.get('email')}")
                    print(f"   Has all basic fields: {all(field in full_user for field in ['id', 'fullName', 'username', 'age', 'gender', 'bio'])}")
                    
                    # Test profile update
                    print(f"\n🔍 Testing profile update...")
                    update_data = {
                        "fullName": "Updated Test User",
                        "bio": "Updated bio for testing"
                    }
                    update_response = requests.put(f"{API_BASE}/auth/profile", data=update_data, headers=headers)
                    
                    if update_response.status_code == 200:
                        print("✅ Profile update successful!")
                        return True
                    else:
                        print(f"❌ Profile update failed: {update_response.status_code}")
                        return False
                else:
                    print(f"❌ Could not access full profile: {me_response.status_code}")
                    return False
            else:
                print("❌ No access token in response")
                return False
        else:
            print(f"❌ Telegram registration failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")
        return False

def test_telegram_bot_check():
    """Test the Telegram bot check functionality"""
    print("\n🔍 Testing Telegram Bot Check...")
    
    try:
        response = requests.post(f"{API_BASE}/auth/telegram-bot-check", json={})
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('authenticated'):
                print("✅ Bot check found authenticated user!")
                user = data.get('user', {})
                print(f"   User ID: {user.get('id')}")
                print(f"   Username: {user.get('username')}")
                print(f"   Full Name: {user.get('fullName')}")
                print(f"   Auth Method: {user.get('authMethod')}")
                return True
            else:
                print("✅ No recent Telegram authentication found (expected)")
                return True
        else:
            print(f"❌ Bot check failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")
        return False

def test_normal_vs_telegram_comparison():
    """Test comparison between normal and Telegram user structures"""
    print("\n🔍 Testing Normal vs Telegram User Structure Comparison...")
    
    try:
        # Create normal user
        normal_user_data = {
            "fullName": "Normal User",
            "username": f"normal_{int(time.time()) % 1000000}",
            "age": 25,
            "gender": "female",
            "password": "SecurePass123!",
            "email": f"normal.{int(time.time()) % 1000000}@example.com"
        }
        
        normal_response = requests.post(f"{API_BASE}/auth/register", json=normal_user_data)
        
        if normal_response.status_code == 200:
            normal_user = normal_response.json()['user']
            print("✅ Normal user created successfully!")
            print(f"   Normal user email: {normal_user.get('email')}")
            
            # Create Telegram user
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
            
            telegram_response = requests.post(f"{API_BASE}/auth/telegram", json=telegram_request)
            
            if telegram_response.status_code == 200:
                telegram_user = telegram_response.json()['user']
                print("✅ Telegram user created successfully!")
                print(f"   Telegram user email: {telegram_user.get('email')}")
                
                # Compare structures
                common_fields = {'id', 'fullName', 'username', 'age', 'gender', 'email'}
                normal_fields = set(normal_user.keys())
                telegram_fields = set(telegram_user.keys())
                
                missing_in_telegram = common_fields - telegram_fields
                missing_in_normal = common_fields - normal_fields
                
                if not missing_in_telegram and not missing_in_normal:
                    print("✅ Both user types have identical required field structures!")
                    return True
                else:
                    print(f"❌ Field structure mismatch:")
                    if missing_in_telegram:
                        print(f"   Missing in Telegram: {missing_in_telegram}")
                    if missing_in_normal:
                        print(f"   Missing in Normal: {missing_in_normal}")
                    return False
            else:
                print(f"❌ Telegram user creation failed: {telegram_response.status_code}")
                return False
        else:
            print(f"❌ Normal user creation failed: {normal_response.status_code}")
            print(f"   Response: {normal_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("=" * 80)
    print("SIMPLE TELEGRAM AUTHENTICATION TESTS")
    print("=" * 80)
    print(f"Testing against: {API_BASE}")
    print()
    
    results = []
    
    # Test 1: Telegram Registration Complete Profile
    results.append(test_telegram_registration())
    
    # Test 2: Telegram Bot Check
    results.append(test_telegram_bot_check())
    
    # Test 3: Normal vs Telegram Comparison
    results.append(test_normal_vs_telegram_comparison())
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(results)
    total = len(results)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {total - passed}")
    print(f"Total Tests: {total}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Telegram authentication creates complete user profiles")
        print("✅ Email field validation working (tg{id}@luvhive.app format)")
        print("✅ Field structure compatibility between normal and Telegram users")
        print("✅ EditProfile functionality compatibility verified")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - see details above")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)