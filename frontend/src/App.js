import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WherebyProvider } from "@whereby.com/browser-sdk/react";
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
import IncomingCallModal from "@/components/IncomingCallModal";
import VideoCallModal from "@/components/VideoCallModal";
import { Toaster } from "@/components/ui/toaster";
import { getToken, setToken, httpClient, getUser, setUser as setUserStorage } from "@/utils/authClient";

// Global Call Detection Component
function GlobalCallHandler({ user }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callRoomUrl, setCallRoomUrl] = useState(null);
  const [callMeetingId, setCallMeetingId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);

  // Global polling for incoming calls
  useEffect(() => {
    if (!user) return;

    const checkIncomingCalls = async () => {
      try {
        const response = await httpClient.get('/messages/incoming-calls');
        const calls = response.data.incomingCalls || [];
        
        if (calls.length > 0) {
          const latestCall = calls[0];
          console.log('📞 Global incoming call detected:', latestCall);
          
          setIncomingCall({
            messageId: latestCall.messageId,
            callType: latestCall.callType,
            roomUrl: latestCall.roomUrl,
            meetingId: latestCall.meetingId,
            caller: {
              id: latestCall.callerId,
              fullName: latestCall.callerName,
              username: latestCall.callerUsername,
              profileImage: latestCall.callerImage
            },
            conversationId: latestCall.conversationId
          });
          setShowIncomingCallModal(true);
        }
      } catch (error) {
        console.error('Error checking incoming calls:', error);
      }
    };

    // Check immediately
    checkIncomingCalls();

    // Then check every 3 seconds
    const interval = setInterval(checkIncomingCalls, 3000);

    return () => clearInterval(interval);
  }, [user]);

  const handleAcceptCall = async () => {
    if (incomingCall) {
      console.log('✅ Accepting global incoming call');
      
      // Mark notification as read
      try {
        if (incomingCall.conversationId) {
          await httpClient.post('/messages/mark-read', { conversationId: incomingCall.conversationId });
        }
      } catch (error) {
        console.error('Error marking call as read:', error);
      }
      
      // Set up call
      setCallRoomUrl(incomingCall.roomUrl);
      setCallMeetingId(incomingCall.meetingId);
      setOtherUser(incomingCall.caller);
      setIsCallActive(true);
      setShowIncomingCallModal(false);
      setIncomingCall(null);
    }
  };

  const handleRejectCall = async () => {
    console.log('❌ Rejecting global incoming call');
    
    // Mark notification as read
    try {
      if (incomingCall?.conversationId) {
        await httpClient.post('/messages/mark-read', { conversationId: incomingCall.conversationId });
      }
    } catch (error) {
      console.error('Error marking call as read:', error);
    }
    
    setShowIncomingCallModal(false);
    setIncomingCall(null);
  };

  const handleCallEnd = () => {
    setIsCallActive(false);
    setCallRoomUrl(null);
    setCallMeetingId(null);
    setOtherUser(null);
  };

  return (
    <>
      <IncomingCallModal
        isOpen={showIncomingCallModal}
        callType={incomingCall?.callType}
        callerUser={incomingCall?.caller}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />
      
      <VideoCallModal
        isOpen={isCallActive}
        roomUrl={callRoomUrl}
        onClose={handleCallEnd}
        otherUser={otherUser}
        meetingId={callMeetingId}
      />
    </>
  );
}

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
      <WherebyProvider>
        <BrowserRouter>
          {/* Global Call Handler - works across all pages */}
          {isAuthenticated && user && <GlobalCallHandler user={user} />}
          
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
        <Toaster />
      </BrowserRouter>
      </WherebyProvider>
    </div>
  );
}

export default App;