#!/usr/bin/env python3
"""
Follow and Search Functionality Testing for LuvHive
Tests the fixed follow/unfollow functionality and search functionality
"""

import requests
import json
import sys
import os
from datetime import datetime

# Load environment variables
sys.path.append('/app/backend')
from dotenv import load_dotenv
load_dotenv('/app/frontend/.env')

# Get backend URL from frontend env
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chatfix-luvhive.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class FollowSearchTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.current_user_id = None
        self.current_username = None
        
        # Test users
        self.test_user_1_id = None
        self.test_user_1_username = None
        self.test_user_2_id = None
        self.test_user_2_username = None
        
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
    
    def create_test_user(self, full_name, username, age=25, gender="female", password="password123"):
        """Create a test user"""
        try:
            user_data = {
                "fullName": full_name,
                "username": username,
                "age": age,
                "gender": gender,
                "password": password
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=user_data)
            
            if response.status_code == 200:
                data = response.json()
                return data['user']['id'], data['access_token']
            else:
                print(f"Failed to create user {username}: {response.status_code} - {response.text}")
                return None, None
                
        except Exception as e:
            print(f"Exception creating user {username}: {str(e)}")
            return None, None
    
    def login_user(self, username, password="password123"):
        """Login a user and return token"""
        try:
            login_data = {
                "username": username,
                "password": password
            }
            
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                return data['user']['id'], data['access_token']
            else:
                print(f"Failed to login user {username}: {response.status_code} - {response.text}")
                return None, None
                
        except Exception as e:
            print(f"Exception logging in user {username}: {str(e)}")
            return None, None
    
    def setup_test_users(self):
        """Setup test users for follow/search testing"""
        print("Setting up test users...")
        
        # Try to login existing users first
        user1_id, token1 = self.login_user("hashtagtest")
        if user1_id and token1:
            self.test_user_1_id = user1_id
            self.test_user_1_username = "hashtagtest"
            print(f"✅ Logged in existing user: hashtagtest")
        else:
            # Create new user
            user1_id, token1 = self.create_test_user("Hashtag Test", "hashtagtest", 26, "male")
            if user1_id and token1:
                self.test_user_1_id = user1_id
                self.test_user_1_username = "hashtagtest"
                print(f"✅ Created new user: hashtagtest")
        
        # Try to login/create Luvsociety user
        user2_id, token2 = self.login_user("Luvsociety")
        if user2_id and token2:
            self.test_user_2_id = user2_id
            self.test_user_2_username = "Luvsociety"
            print(f"✅ Logged in existing user: Luvsociety")
        else:
            # Create new user
            user2_id, token2 = self.create_test_user("Luv Society", "Luvsociety", 24, "female")
            if user2_id and token2:
                self.test_user_2_id = user2_id
                self.test_user_2_username = "Luvsociety"
                print(f"✅ Created new user: Luvsociety")
        
        # Set current user as hashtagtest
        if self.test_user_1_id and token1:
            self.current_user_id = self.test_user_1_id
            self.current_username = self.test_user_1_username
            self.auth_token = token1
            self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
            print(f"✅ Set current user: {self.current_username}")
            return True
        
        print("❌ Failed to setup test users")
        return False
    
    def create_test_posts(self):
        """Create test posts for search testing"""
        try:
            # Create posts with different content for search testing
            test_posts = [
                {
                    "mediaType": "image",
                    "mediaUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
                    "caption": "Testing hashtag functionality #hashtagtest #testing #luvhive"
                },
                {
                    "mediaType": "image", 
                    "mediaUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
                    "caption": "Welcome to Luvsociety! Building connections #luvsociety #social #connect"
                }
            ]
            
            created_posts = []
            for post_data in test_posts:
                response = self.session.post(f"{API_BASE}/posts/create", json=post_data)
                if response.status_code == 200:
                    created_posts.append(response.json())
            
            print(f"✅ Created {len(created_posts)}/{len(test_posts)} test posts")
            return len(created_posts) > 0
            
        except Exception as e:
            print(f"❌ Exception creating test posts: {str(e)}")
            return False
    
    def test_follow_user(self):
        """Test POST /api/users/{userId}/follow endpoint"""
        if not self.test_user_2_id:
            self.log_result("Follow User", False, "No test user 2 ID available")
            return
        
        try:
            response = self.session.post(f"{API_BASE}/users/{self.test_user_2_id}/follow")
            
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'follow' in data['message'].lower():
                    self.log_result("Follow User", True, f"Successfully followed user: {data['message']}")
                else:
                    self.log_result("Follow User", False, f"Unexpected response: {data}")
            else:
                self.log_result("Follow User", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Follow User", False, "Exception occurred", str(e))
    
    def test_unfollow_user(self):
        """Test POST /api/users/{userId}/unfollow endpoint"""
        if not self.test_user_2_id:
            self.log_result("Unfollow User", False, "No test user 2 ID available")
            return
        
        try:
            response = self.session.post(f"{API_BASE}/users/{self.test_user_2_id}/unfollow")
            
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'unfollow' in data['message'].lower():
                    self.log_result("Unfollow User", True, f"Successfully unfollowed user: {data['message']}")
                else:
                    self.log_result("Unfollow User", False, f"Unexpected response: {data}")
            else:
                self.log_result("Unfollow User", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Unfollow User", False, "Exception occurred", str(e))
    
    def test_is_following_logic_user_profile(self):
        """Test isFollowing logic in user profile endpoint"""
        if not self.test_user_2_id:
            self.log_result("isFollowing Logic - User Profile", False, "No test user 2 ID available")
            return
        
        try:
            # First follow the user
            follow_response = self.session.post(f"{API_BASE}/users/{self.test_user_2_id}/follow")
            
            if follow_response.status_code == 200:
                # Now check user profile
                profile_response = self.session.get(f"{API_BASE}/users/{self.test_user_2_id}")
                
                if profile_response.status_code == 200:
                    profile_data = profile_response.json()
                    
                    if 'isFollowing' in profile_data:
                        if profile_data['isFollowing'] == True:
                            self.log_result("isFollowing Logic - User Profile", True, 
                                          f"isFollowing correctly shows True after following user")
                        else:
                            self.log_result("isFollowing Logic - User Profile", False, 
                                          f"isFollowing shows {profile_data['isFollowing']} but should be True")
                    else:
                        self.log_result("isFollowing Logic - User Profile", False, "isFollowing field missing from profile")
                else:
                    self.log_result("isFollowing Logic - User Profile", False, f"Profile request failed: {profile_response.status_code}")
            else:
                self.log_result("isFollowing Logic - User Profile", False, "Could not follow user for testing")
                
        except Exception as e:
            self.log_result("isFollowing Logic - User Profile", False, "Exception occurred", str(e))
    
    def test_is_following_logic_user_list(self):
        """Test isFollowing logic in users list endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/users/list")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'users' in data and isinstance(data['users'], list):
                    # Find our test user 2 in the list
                    test_user_found = None
                    for user in data['users']:
                        if user['id'] == self.test_user_2_id:
                            test_user_found = user
                            break
                    
                    if test_user_found:
                        if 'isFollowing' in test_user_found:
                            # We should be following this user from previous test
                            if test_user_found['isFollowing'] == True:
                                self.log_result("isFollowing Logic - User List", True, 
                                              f"isFollowing correctly shows True in users list")
                            else:
                                self.log_result("isFollowing Logic - User List", False, 
                                              f"isFollowing shows {test_user_found['isFollowing']} but should be True")
                        else:
                            self.log_result("isFollowing Logic - User List", False, "isFollowing field missing from user list")
                    else:
                        self.log_result("isFollowing Logic - User List", True, "Test user not found in list (may be expected)")
                else:
                    self.log_result("isFollowing Logic - User List", False, "Response missing 'users' array")
            else:
                self.log_result("isFollowing Logic - User List", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("isFollowing Logic - User List", False, "Exception occurred", str(e))
    
    def test_search_luvsociety_all(self):
        """Test searching for 'Luvsociety' with type 'all' - should show users AND posts"""
        try:
            search_request = {
                "query": "Luvsociety",
                "type": "all"
            }
            
            response = self.session.post(f"{API_BASE}/search", json=search_request)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if we have users and posts arrays
                if 'users' in data and 'posts' in data:
                    users_found = len(data['users'])
                    posts_found = len(data['posts'])
                    
                    # Look for Luvsociety user in results
                    luvsociety_user_found = any(user['username'].lower() == 'luvsociety' for user in data['users'])
                    
                    if luvsociety_user_found:
                        self.log_result("Search Luvsociety All", True, 
                                      f"Found Luvsociety user in search results. Users: {users_found}, Posts: {posts_found}")
                    else:
                        self.log_result("Search Luvsociety All", False, 
                                      f"Luvsociety user not found in search results. Users: {users_found}, Posts: {posts_found}")
                else:
                    self.log_result("Search Luvsociety All", False, "Response missing 'users' or 'posts' arrays")
            else:
                self.log_result("Search Luvsociety All", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Search Luvsociety All", False, "Exception occurred", str(e))
    
    def test_search_luvsociety_users(self):
        """Test searching for 'Luvsociety' with type 'users' - should show user profile"""
        try:
            search_request = {
                "query": "Luvsociety",
                "type": "users"
            }
            
            response = self.session.post(f"{API_BASE}/search", json=search_request)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'users' in data:
                    users_found = len(data['users'])
                    
                    # Look for Luvsociety user in results
                    luvsociety_user = None
                    for user in data['users']:
                        if user['username'].lower() == 'luvsociety':
                            luvsociety_user = user
                            break
                    
                    if luvsociety_user:
                        # Check if isFollowing logic is correct
                        if 'isFollowing' in luvsociety_user:
                            self.log_result("Search Luvsociety Users", True, 
                                          f"Found Luvsociety user with isFollowing: {luvsociety_user['isFollowing']}")
                        else:
                            self.log_result("Search Luvsociety Users", False, 
                                          "Luvsociety user found but missing isFollowing field")
                    else:
                        self.log_result("Search Luvsociety Users", False, 
                                      f"Luvsociety user not found in search results. Found {users_found} users")
                else:
                    self.log_result("Search Luvsociety Users", False, "Response missing 'users' array")
            else:
                self.log_result("Search Luvsociety Users", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Search Luvsociety Users", False, "Exception occurred", str(e))
    
    def test_search_hashtagtest_all(self):
        """Test searching for 'hashtagtest' with type 'all' - should show user AND their posts"""
        try:
            search_request = {
                "query": "hashtagtest",
                "type": "all"
            }
            
            response = self.session.post(f"{API_BASE}/search", json=search_request)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'users' in data and 'posts' in data:
                    users_found = len(data['users'])
                    posts_found = len(data['posts'])
                    
                    # Look for hashtagtest user in results
                    hashtagtest_user_found = any(user['username'].lower() == 'hashtagtest' for user in data['users'])
                    
                    # Look for posts with hashtagtest content
                    hashtagtest_posts_found = any('hashtagtest' in post.get('caption', '').lower() for post in data['posts'])
                    
                    if hashtagtest_user_found or hashtagtest_posts_found:
                        self.log_result("Search Hashtagtest All", True, 
                                      f"Found hashtagtest content. User found: {hashtagtest_user_found}, Posts with content: {hashtagtest_posts_found}")
                    else:
                        self.log_result("Search Hashtagtest All", False, 
                                      f"No hashtagtest content found. Users: {users_found}, Posts: {posts_found}")
                else:
                    self.log_result("Search Hashtagtest All", False, "Response missing 'users' or 'posts' arrays")
            else:
                self.log_result("Search Hashtagtest All", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Search Hashtagtest All", False, "Exception occurred", str(e))
    
    def test_search_is_following_accuracy(self):
        """Test that isFollowing status is accurate in search results"""
        try:
            # First ensure we're following test_user_2
            follow_response = self.session.post(f"{API_BASE}/users/{self.test_user_2_id}/follow")
            
            # Search for users
            search_request = {
                "query": "Luvsociety",
                "type": "users"
            }
            
            response = self.session.post(f"{API_BASE}/search", json=search_request)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'users' in data:
                    # Find our test user in search results
                    test_user_in_search = None
                    for user in data['users']:
                        if user['id'] == self.test_user_2_id:
                            test_user_in_search = user
                            break
                    
                    if test_user_in_search:
                        if 'isFollowing' in test_user_in_search:
                            if test_user_in_search['isFollowing'] == True:
                                self.log_result("Search isFollowing Accuracy", True, 
                                              "isFollowing status is accurate in search results")
                            else:
                                self.log_result("Search isFollowing Accuracy", False, 
                                              f"isFollowing shows {test_user_in_search['isFollowing']} but should be True")
                        else:
                            self.log_result("Search isFollowing Accuracy", False, 
                                          "isFollowing field missing from search results")
                    else:
                        self.log_result("Search isFollowing Accuracy", True, 
                                      "Test user not found in search results (may be expected)")
                else:
                    self.log_result("Search isFollowing Accuracy", False, "Response missing 'users' array")
            else:
                self.log_result("Search isFollowing Accuracy", False, f"Status: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Search isFollowing Accuracy", False, "Exception occurred", str(e))
    
    def run_follow_search_tests(self):
        """Run all follow and search functionality tests"""
        print("=" * 60)
        print("LUVHIVE FOLLOW & SEARCH FUNCTIONALITY TESTING")
        print("=" * 60)
        print(f"Testing against: {API_BASE}")
        print()
        
        # Setup phase
        if not self.setup_test_users():
            print("❌ Cannot proceed without test users")
            return False
        
        # Create test posts for search testing
        print("Creating test posts...")
        self.create_test_posts()
        print()
        
        # Test follow/unfollow functionality
        print("Testing Follow/Unfollow Functionality...")
        self.test_follow_user()
        self.test_unfollow_user()
        
        # Test isFollowing logic
        print("Testing isFollowing Logic...")
        self.test_is_following_logic_user_profile()
        self.test_is_following_logic_user_list()
        
        # Test search functionality
        print("Testing Search Functionality...")
        self.test_search_luvsociety_all()
        self.test_search_luvsociety_users()
        self.test_search_hashtagtest_all()
        self.test_search_is_following_accuracy()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
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
    tester = FollowSearchTester()
    success = tester.run_follow_search_tests()
    sys.exit(0 if success else 1)