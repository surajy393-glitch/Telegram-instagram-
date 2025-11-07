import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import DatingRegisterPage from "@/pages/DatingRegisterPage";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import ProfilePage from "@/pages/ProfilePage";
import MyProfilePage from "@/pages/MyProfilePage";
import FeedPage from "@/pages/FeedPage";
import StoriesPage from "@/pages/StoriesPage";
import SocialSettingsPage from "@/pages/SocialSettingsPage";
import EditProfilePage from "@/pages/EditProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import VerificationStatusPage from "@/pages/VerificationStatusPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SearchPage from "@/pages/SearchPage";
import PostDetailPage from "@/pages/PostDetailPage";
import ChatPage from "@/pages/ChatPage";
import MessagesPage from "@/pages/MessagesPage";
import TelegramAuthHandler from "@/components/TelegramAuthHandler";
import { Toaster } from "@/components/ui/toaster";
import { getToken, setToken, httpClient, getUser, setUser as setUserStorage } from "@/utils/authClient";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global Telegram WebApp Initialization
  useEffect(() => {
    console.log('🚀 Initializing Telegram WebApp globally...');
    
    // Check if running in Telegram
    if (window.Telegram && window.Telegram.WebApp) {
      try {
        // Signal that WebApp is ready
        window.Telegram.WebApp.ready();
        console.log('✅ Telegram.WebApp.ready() called');
        
        // Expand to full height for better UX
        window.Telegram.WebApp.expand();
        console.log('✅ Telegram.WebApp.expand() called');
        
        // Optional: Set header color to match theme
        window.Telegram.WebApp.setHeaderColor('bg_color');
        console.log('✅ Telegram WebApp initialized globally');
      } catch (error) {
        console.error('❌ Error initializing Telegram WebApp:', error);
      }
    } else {
      console.log('ℹ️ Not running in Telegram WebApp context');
    }

    // Cleanup on unload
    const handleUnload = () => {
      console.log('🧹 App unloading - cleaning up resources...');
    };

    window.addEventListener('beforeunload', handleUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      // Clean up old generic localStorage keys (migration)
      if (localStorage.getItem("user")) {
        console.log("🧹 Cleaning up old generic 'user' key");
        localStorage.removeItem("user");
      }
      if (localStorage.getItem("token")) {
        console.log("🧹 Cleaning up old generic 'token' key");
        localStorage.removeItem("token");
      }
      
      const token = getToken();
      
      console.log("🔍 App.js: Checking authentication...");
      console.log("   Token present:", !!token);
      
      if (!token) {
        // No token, check Telegram-scoped storage as fallback
        const userData = getUser();
        if (userData) {
          console.log("📱 User loaded from Telegram-scoped storage (no token):", userData.username);
          setUser(userData);
        }
        setLoading(false);
        return;
      }
      
      try {
        // Fetch fresh user data from API
        console.log("🔄 Fetching fresh user data from API...");
        const response = await httpClient.get('/auth/me');
        const freshUser = response.data;
        
        console.log("✅ Fresh user data received:", freshUser.username);
        console.log("   Premium status:", freshUser.isPremium);
        console.log("   Profile Image:", freshUser.profileImage);
        
        // Update both state and Telegram-scoped storage with fresh data
        setIsAuthenticated(true);
        setUser(freshUser);
        setUserStorage(freshUser); // Store in Telegram-scoped storage
      } catch (error) {
        console.error("❌ Failed to fetch fresh user data:", error);
        
        // Fallback to Telegram-scoped storage if API fails
        const userData = getUser();
        if (userData) {
          console.log("📱 Fallback to Telegram-scoped storage after API error:", userData.username);
          setIsAuthenticated(true);
          setUser(userData);
        } else {
          setToken(null);
        }
      }
      
      setLoading(false);
    };
    
    loadUser();
  }, []);

  const handleLogin = (token, userData) => {
    console.log("🔐 handleLogin called with user:", userData);
    setToken(token); // Use centralized token setter
    setUserStorage(userData); // Store in Telegram-scoped storage
    setIsAuthenticated(true);
    setUser(userData);
    console.log("✅ User state updated, profileImage:", userData?.profileImage);
  };

  const handleLogout = () => {
    setToken(null); // Clear token using centralized utility
    setUserStorage(null); // Clear Telegram-scoped user storage
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <div className="text-2xl text-pink-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Telegram WebApp Auth Route */}
          <Route 
            path="/telegram-auth" 
            element={
              <TelegramAuthHandler onAuthSuccess={handleLogin} />
            } 
          />
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <Navigate to="/feed" replace />
              ) : (
                <LandingPage />
              )
            } 
          />
          <Route 
            path="/register" 
            element={
              isAuthenticated ? (
                <Navigate to="/feed" replace />
              ) : (
                <DatingRegisterPage onLogin={handleLogin} />
              )
            } 
          />
          <Route 
            path="/login" 
            element={
              isAuthenticated ? (
                <Navigate to="/feed" replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            } 
          />
          <Route 
            path="/home" 
            element={<Navigate to="/feed" replace />}
          />
          <Route 
            path="/feed" 
            element={
              isAuthenticated ? (
                <FeedPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/stories" 
            element={
              isAuthenticated ? (
                <StoriesPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/social-settings" 
            element={
              isAuthenticated ? (
                <SocialSettingsPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/my-profile" 
            element={
              isAuthenticated ? (
                <MyProfilePage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/edit-profile" 
            element={
              isAuthenticated ? (
                <EditProfilePage user={user} onLogin={handleLogin} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/settings" 
            element={
              isAuthenticated ? (
                <SettingsPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/verification-status" 
            element={
              isAuthenticated ? (
                <VerificationStatusPage user={user} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/notifications" 
            element={
              isAuthenticated ? (
                <NotificationsPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/search" 
            element={
              isAuthenticated ? (
                <SearchPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/test-zego" 
            element={<TestZegoPage />} 
          />
          <Route 
            path="/post/:postId" 
            element={
              isAuthenticated ? (
                <PostDetailPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/profile/:userId" 
            element={
              isAuthenticated ? (
                <ProfilePage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/messages" 
            element={
              isAuthenticated ? (
                <MessagesPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/chat/:userId" 
            element={
              isAuthenticated ? (
                <ChatPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;