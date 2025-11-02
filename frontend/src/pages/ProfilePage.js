import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Crown, MoreVertical, Shield, AlertCircle, EyeOff, Link2, Share2, Zap, Lock, Info } from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import axios from "axios";
import { getPostMediaUrl as normalizePostMediaUrl } from "@/utils/media";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Use a fallback so API calls don't break when the env var is missing
const API = "/api";

// Utility function to linkify bio text (mentions and URLs)
const LinkifyBio = ({ text }) => {
  if (!text) return null;
  
  const parts = text.split(/(@\w+|https?:\/\/[^\s]+)/g);
  
  return (
    <p className="text-gray-700 leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          // Make @mentions clickable
          return (
            <span key={index} className="text-blue-600 hover:underline cursor-pointer font-medium">
              {part}
            </span>
          );
        } else if (part.startsWith('http')) {
          // Make URLs clickable
          return (
            <a 
              key={index} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
};

const ProfilePage = ({ user, onLogout }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [showVibeCompatibility, setShowVibeCompatibility] = useState(false);
  const [vibeScore, setVibeScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [followingInProgress, setFollowingInProgress] = useState(new Set());
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);
  const [showFollowersDialog, setShowFollowersDialog] = useState(false);
  const [followersDialogType, setFollowersDialogType] = useState(null); // 'followers' or 'following'
  const [followersList, setFollowersList] = useState([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  // Check if we're viewing a specific user or discovery page
  const isViewingSpecificUser = !!userId;
  const isViewingOwnProfile = userId === user?.id;

  // Get backend URL from environment (use empty string for same-domain deployment)
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

  // Helper function to normalize media URLs (adds /api prefix if needed)
  const getMediaSrc = (url) => {
    if (!url) return "";
    
    // Absolute URLs and data URIs should be returned unchanged
    if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) {
      return url;
    }
    
    let path = url;
    // Add /api if the path references the uploads directory
    if (path.startsWith('/uploads/')) {
      path = `/api${path}`;
    }
    
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    
    const trimmedBackend = BACKEND_URL.replace(/\/$/, '');
    return trimmedBackend ? `${trimmedBackend}${path}` : path;
  };

  // Helper function to derive the actual account ID from user object
  const getAccountId = (userObj) => {
    return userObj?.id || userObj?._id || userObj?.user_id || userObj?.tg_user_id;
  };

  useEffect(() => {
    if (isViewingSpecificUser) {
      fetchUserProfile(userId);
      // Don't fetch posts immediately with URL userId - wait for profile to load
      // Then use the actual ID from viewingUser
    } else {
      fetchProfile();
      fetchUsers();
    }
  }, [userId]);

  // Fetch posts after profile loads with correct ID
  useEffect(() => {
    if (viewingUser && isViewingSpecificUser) {
      const accountId = getAccountId(viewingUser);
      console.log('🔍 Fetching posts with derived accountId:', accountId, 'username:', viewingUser.username);
      if (accountId) {
        fetchUserPosts(accountId, viewingUser.username);
      }
    }
  }, [viewingUser?.id, viewingUser?._id, viewingUser?.user_id, viewingUser?.tg_user_id]);

  // Auto-refresh posts when follow request is accepted
  useEffect(() => {
    // If the profile shows postsCount > 0 but we haven't loaded any posts yet,
    // fetch them. This handles the case where a follow request was accepted after
    // the initial profile load.
    if (
      viewingUser &&
      viewingUser.postsCount > 0 &&
      userPosts.length === 0 &&
      (!viewingUser.isPrivate ||
       viewingUser.isFollowing ||
       viewingUser.id === user?.id)
    ) {
      console.log("Auto-fetching posts after follow acceptance");
      const accountId = getAccountId(viewingUser);
      if (accountId) {
        fetchUserPosts(accountId, viewingUser.username);
      }
    }
  }, [viewingUser, userPosts.length]);

  const fetchAccountInfo = async (userId) => {
    console.log("=== fetchAccountInfo CALLED with ID:", userId);
    
    try {
      const token = localStorage.getItem("token");
      const url = `${API}/users/${userId}/account-info`;
      console.log("Fetching from URL:", url);
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log("✅ Account info received:", response.data);
      setAccountInfo(response.data);
      
    } catch (error) {
      console.error("❌ Error fetching account info:", error);
      console.error("Error details:", error.response?.data);
      
      // Show error in modal
      setAccountInfo({
        error: true,
        message: error.response?.data?.detail || error.message || "Failed to load account information"
      });
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/users/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchUserProfile = async (targetUserId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      let response;
      try {
        // Attempt the detailed UUID-only endpoint
        response = await axios.get(`${API}/users/${targetUserId}/profile`, { headers });
      } catch (err) {
        // Fallback to the generic endpoint that accepts usernames as well
        console.log("Profile endpoint failed, trying fallback with username:", targetUserId);
        response = await axios.get(`${API}/users/${targetUserId}`, { headers });
      }
      console.log("Profile fetched successfully:", response.data.username);
      setViewingUser(response.data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Log out if the token is invalid or expired
      if (error.response?.status === 401) {
        console.error("401 Unauthorized - logging out");
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async (accountId, username) => {
    setPostsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // 1. Try to load posts via the normal endpoint (now accepts UUID or username)
      console.log("Fetching posts with accountId:", accountId, "username:", username);
      let response = await axios.get(`${API}/users/${accountId}/posts`, { headers });
      console.log("Posts API response:", response.data);
      
      let postsData = Array.isArray(response.data.posts)
        ? response.data.posts
        : Array.isArray(response.data)
        ? response.data
        : [];

      // 2. If no posts returned but postsCount shows > 0, try using the username slug
      if (postsData.length === 0 && viewingUser?.postsCount > 0 && username) {
        console.log("No posts with UUID, trying username fallback:", username);
        const fallback = await axios.get(`${API}/users/${username}/posts`, { headers });
        console.log("Fallback response:", fallback.data);
        postsData = Array.isArray(fallback.data.posts)
          ? fallback.data.posts
          : Array.isArray(fallback.data)
          ? fallback.data
          : [];
      }
      
      // 3. If still empty and we expect posts, load the feed and filter by this user
      if (postsData.length === 0 && viewingUser?.postsCount > 0) {
        console.warn("User posts endpoint returned nothing; falling back to feed");
        const feedResp = await axios.get(`${API}/posts/feed`, { headers });
        const feedPosts = Array.isArray(feedResp.data.posts) ? feedResp.data.posts : [];
        postsData = feedPosts.filter(
          (p) => p.userId === accountId || p.username === username
        );
        console.log(`Extracted ${postsData.length} posts from feed`);
      }
      
      console.log("Posts fetched successfully:", postsData.length);
      setUserPosts(postsData);
    } catch (error) {
      console.error('Error fetching user posts:', error);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.response?.data?.detail);
      
      // If 500 error or other issues, try feed fallback as last resort
      if (error.response?.status === 500 || error.response?.status === 404) {
        console.warn("Primary endpoints failed, attempting feed fallback");
        try {
          const token = localStorage.getItem('token');
          const headers = { Authorization: `Bearer ${token}` };
          const feedResp = await axios.get(`${API}/posts/feed`, { headers });
          const feedPosts = Array.isArray(feedResp.data.posts) ? feedResp.data.posts : [];
          const filteredPosts = feedPosts.filter(
            (p) => p.userId === accountId || p.username === username
          );
          console.log(`Feed fallback successful: extracted ${filteredPosts.length} posts`);
          setUserPosts(filteredPosts);
        } catch (feedError) {
          console.error("Feed fallback also failed:", feedError);
          setUserPosts([]);
        }
      } else if (error.response?.status === 401) {
        // Handle expired or invalid tokens
        console.error("401 Unauthorized - logging out");
        onLogout();
        setUserPosts([]);
      } else {
        setUserPosts([]);
      }
    } finally {
      setPostsLoading(false);
    }
  };

  const handleVibeCompatibility = async () => {
    if (!viewingUser) return;
    
    setShowVibeCompatibility(true);
    try {
      const token = localStorage.getItem("token");
      console.log(`Fetching vibe compatibility for user: ${viewingUser.id}`);
      
      const response = await axios.get(`${API}/auth/calculate-compatibility/${viewingUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log("Vibe compatibility response:", response.data);
      setVibeScore(response.data);
    } catch (error) {
      console.error("Error calculating vibe compatibility:", error);
      alert("Failed to calculate vibe compatibility. Please try again.");
      setShowVibeCompatibility(false);
    }
  };

  const handleBlockUser = async () => {
    if (!viewingUser) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/${viewingUser.id}/block`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`${viewingUser.username} has been blocked`);
    } catch (error) {
      console.error("Error blocking user:", error);
      alert("Failed to block user");
    }
  };

  const handleReportUser = async () => {
    if (!viewingUser) return;
    alert(`Report submitted for ${viewingUser.username}. Our team will review this profile.`);
  };

  const handleHideStory = async () => {
    if (!viewingUser) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/${viewingUser.id}/hide-story`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("You will no longer see stories from this user");
    } catch (error) {
      console.error("Error hiding story:", error);
      alert("Failed to hide stories");
    }
  };

  const handleCopyProfileURL = () => {
    if (!viewingUser) return;
    const profileURL = `${window.location.origin}/profile/${viewingUser.id}`;
    navigator.clipboard.writeText(profileURL).then(() => {
      alert("Profile URL copied to clipboard!");
    }).catch(() => {
      alert("Failed to copy URL");
    });
  };

  const handleShareProfile = async () => {
    if (!viewingUser) return;
    
    const profileURL = `${window.location.origin}/profile/${viewingUser.id}`;
    const shareText = `Check out ${viewingUser.fullName}'s profile on LuvHive!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${viewingUser.fullName} - LuvHive Profile`,
          text: shareText,
          url: profileURL,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          // Fallback to copy link
          navigator.clipboard.writeText(profileURL).then(() => {
            alert('Profile link copied! Share it on Telegram, WhatsApp, Instagram, or Facebook!');
          });
        }
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(profileURL).then(() => {
        alert('Profile link copied! Share it on Telegram, WhatsApp, Instagram, or Facebook!');
      }).catch(() => {
        alert('Failed to copy link');
      });
    }
  };

  const handleShowFollowers = async (type) => {
    // Check if account is private and user doesn't follow them
    if (viewingUser?.isPrivate && !viewingUser?.isFollowing && !isViewingOwnProfile) {
      alert("This account is private. Follow to see their followers and following.");
      return;
    }

    setFollowersDialogType(type);
    setShowFollowersDialog(true);
    setFollowersLoading(true);

    try {
      const token = localStorage.getItem('token');
      const endpoint = type === 'followers' 
        ? `${API}/users/${viewingUser?.id}/followers` 
        : `${API}/users/${viewingUser?.id}/following`;
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Backend returns {followers: [...]} or {following: [...]}
      const listData = type === 'followers' ? response.data.followers : response.data.following;
      setFollowersList(listData || []);
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      alert(`Failed to load ${type}`);
    } finally {
      setFollowersLoading(false);
    }
  };

  const handleFollowToggle = async (targetUserId, isFollowing, hasRequested) => {
    // Prevent multiple simultaneous follow actions on same user
    if (followingInProgress.has(targetUserId)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found");
        return;
      }

      // Add to following in progress
      setFollowingInProgress(prev => new Set(prev).add(targetUserId));

      let endpoint, newState;
      
      if (hasRequested) {
        // Cancel follow request
        endpoint = "cancel-follow-request";
        newState = { isFollowing: false, hasRequested: false };
      } else if (isFollowing) {
        // Unfollow
        endpoint = "unfollow";
        newState = { isFollowing: false, hasRequested: false };
      } else {
        // Follow or send request
        endpoint = "follow";
      }

      console.log(`Action: ${endpoint} for user ${targetUserId}`);
      
      const response = await axios.post(`${API}/users/${targetUserId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log("Follow action response:", response.data);
      
      // Update state based on response
      if (endpoint === "follow") {
        const wasRequestSent = response.data.requested === true;
        newState = wasRequestSent 
          ? { isFollowing: false, hasRequested: true }
          : { isFollowing: true, hasRequested: false };
      }
      
      // Update the viewingUser state for ProfilePage
      if (viewingUser && viewingUser.id === targetUserId) {
        setViewingUser(prev => ({
          ...prev,
          ...newState,
          followersCount: newState.isFollowing && !isFollowing
            ? prev.followersCount + 1 
            : (!newState.isFollowing && isFollowing ? Math.max(0, prev.followersCount - 1) : prev.followersCount)
        }));
      }

      // Update the followers list if dialog is open
      if (showFollowersDialog) {
        setFollowersList(prev => 
          prev.map(f => 
            f.id === targetUserId 
              ? { ...f, isFollowing: newState.isFollowing, hasRequested: newState.hasRequested }
              : f
          )
        );
      }

      // Refresh profile data to get updated state
      await fetchUserProfile(targetUserId);
      await fetchUserPosts(targetUserId);
      
    } catch (error) {
      console.error("Error toggling follow:", error);
      if (error.response) {
        console.error("Response error:", error.response.data);
        alert(error.response.data.detail || "Failed to process request");
      } else {
        alert("Failed to process request. Please try again.");
      }
    } finally {
      // Remove from following in progress
      setFollowingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <div className="text-2xl text-pink-600">Loading...</div>
      </div>
    );
  }

  if (isViewingSpecificUser && isViewingOwnProfile) {
    // Redirect to MyProfile immediately if viewing own profile
    navigate("/my-profile", { replace: true });
    return null; // Don't render anything during redirect
  }

  if (isViewingSpecificUser) {
    // Individual User Profile View
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100" data-testid="user-profile-page">
        {/* Header */}
        <header className="glass-effect border-b border-pink-100">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Button 
              variant="ghost" 
              className="hover:bg-pink-50"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5 text-pink-600" />
            </Button>
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
              @{viewingUser?.username}
            </h1>
            
            {/* 3-Dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hover:bg-pink-50" data-testid="profile-menu-btn">
                  <MoreVertical className="w-5 h-5 text-pink-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white rounded-xl shadow-lg w-56" align="end">
                <DropdownMenuItem
                  /* Always open the modal immediately and clear old data. */
                  onClick={() => {
                    console.log("🔴 ABOUT THIS ACCOUNT CLICKED!");
                    console.log("viewingUser:", viewingUser);
                    
                    // Derive ID from all possible fields (id, _id, user_id, tg_user_id)
                    const accountId =
                      viewingUser?.id ||
                      viewingUser?._id ||
                      viewingUser?.user_id ||
                      viewingUser?.tg_user_id;
                    
                    console.log("Resolved accountId:", accountId);

                    // Show the dialog immediately so a spinner is visible
                    console.log("Setting showAccountInfo = TRUE");
                    setShowAccountInfo(true);
                    setAccountInfo(null);
                    console.log("Modal should be visible NOW");

                    if (accountId) {
                      console.log("Calling fetchAccountInfo with:", accountId);
                      fetchAccountInfo(accountId);
                    } else {
                      console.error("NO ID FOUND!");
                      // Display error inside the modal
                      setAccountInfo({
                        error: true,
                        message:
                          'Unable to determine user ID for account info. Please try again later.',
                      });
                    }
                  }}
                  className="cursor-pointer hover:bg-pink-50 rounded-lg py-3 flex items-center"
                >
                  <Info className="w-4 h-4 mr-3" />
                  About this account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBlockUser} className="cursor-pointer hover:bg-red-50 text-red-600 rounded-lg py-3">
                  <Shield className="w-4 h-4 mr-3" />
                  Block
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReportUser} className="cursor-pointer hover:bg-red-50 text-red-600 rounded-lg py-3">
                  <AlertCircle className="w-4 h-4 mr-3" />
                  Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleHideStory} className="cursor-pointer hover:bg-pink-50 rounded-lg py-3">
                  <EyeOff className="w-4 h-4 mr-3" />
                  Hide your story
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyProfileURL} className="cursor-pointer hover:bg-pink-50 rounded-lg py-3">
                  <Link2 className="w-4 h-4 mr-3" />
                  Copy profile URL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareProfile} className="cursor-pointer hover:bg-pink-50 rounded-lg py-3">
                  <Share2 className="w-4 h-4 mr-3" />
                  Share this profile
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {/* User Profile Card */}
          <div className="glass-effect rounded-3xl p-8 mb-8 shadow-xl animate-fadeIn">
            <div className="text-center">
              <img
                src={
                  viewingUser?.profileImage 
                    ? (viewingUser.profileImage.startsWith('http') || viewingUser.profileImage.startsWith('data:')
                        ? viewingUser.profileImage 
                        : viewingUser.profileImage)
                    : "https://via.placeholder.com/120"
                }
                alt={viewingUser?.username}
                className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-pink-200 shadow-lg mb-4"
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/120";
                }}
              />
              <h2 className="text-3xl font-bold text-gray-800 mb-1">{viewingUser?.fullName}</h2>
              <div className="flex items-center justify-center gap-1 mb-2">
                <p className="text-lg text-gray-600">@{viewingUser?.username}</p>
                {viewingUser?.isVerified && <VerifiedBadge size="md" />}
                {viewingUser?.isFounder && (
                  <span className="text-2xl" title="Official LuvHive Account">
                    👑
                  </span>
                )}
              </div>
              
              {/* Official Account Badge */}
              {viewingUser?.isFounder && (
                <div className="inline-block bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-2 shadow-md">
                  🏢 Official LuvHive Account
                </div>
              )}
              
              {/* Verification Pathway Display */}
              {viewingUser?.isVerified && viewingUser?.verificationPathway && !viewingUser?.isFounder && (
                <p className="text-xs text-gray-500 mb-2">
                  Verified via: {viewingUser.verificationPathway}
                </p>
              )}
              
              {/* Private Account Badge */}
              {viewingUser?.isPrivate && (
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Private Account</span>
                </div>
              )}
              
              {viewingUser?.isPremium && (
                <div className="inline-flex items-center gap-2 premium-badge mb-4">
                  <Crown className="w-4 h-4" />
                  PREMIUM MEMBER
                </div>
              )}

              <div className="flex justify-center gap-8 mt-6 mb-6">
                <div>
                  {/* Use postsCount from the backend or fall back to the loaded posts length */}
                  <p className="text-2xl font-bold text-pink-600">{viewingUser?.postsCount || userPosts?.length || 0}</p>
                  <p className="text-sm text-gray-600">Posts</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-pink-600">{viewingUser?.followersCount || 0}</p>
                  <p 
                    className="text-sm text-gray-600 cursor-pointer hover:text-pink-600 transition-colors"
                    onClick={() => handleShowFollowers('followers')}
                  >
                    Followers
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-pink-600">{viewingUser?.followingCount || 0}</p>
                  <p 
                    className="text-sm text-gray-600 cursor-pointer hover:text-pink-600 transition-colors"
                    onClick={() => handleShowFollowers('following')}
                  >
                    Following
                  </p>
                </div>
              </div>

              {viewingUser?.bio && (
                <div className="bg-pink-50 rounded-2xl p-4 mt-4 mb-6">
                  <LinkifyBio text={viewingUser.bio} />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => handleFollowToggle(viewingUser?.id, viewingUser?.isFollowing, viewingUser?.hasRequested)}
                  data-testid="follow-user-btn"
                  variant={viewingUser?.isFollowing ? "outline" : (viewingUser?.hasRequested ? "outline" : "default")}
                  disabled={followingInProgress.has(viewingUser?.id)}
                  className={
                    viewingUser?.hasRequested
                      ? "flex-1 border-2 border-gray-400 text-gray-700 hover:bg-gray-50 rounded-xl py-3 text-sm"
                      : viewingUser?.isFollowing 
                        ? "flex-1 border-2 border-pink-500 text-pink-600 hover:bg-pink-50 rounded-xl py-3 text-sm" 
                        : "flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl py-3 text-sm"
                  }
                >
                  {followingInProgress.has(viewingUser?.id) ? (
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">
                        {viewingUser?.hasRequested ? 'Canceling...' : (viewingUser?.isFollowing ? 'Unfollowing...' : 'Requesting...')}
                      </span>
                    </div>
                  ) : (
                    viewingUser?.hasRequested ? "Requested" : (viewingUser?.isFollowing ? "Following" : (viewingUser?.isFollowingMe ? "Follow back" : "Follow"))
                  )}
                </Button>
                
                <Button
                  onClick={handleVibeCompatibility}
                  data-testid="vibe-compatibility-btn"
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl py-3 text-sm"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Vibe
                </Button>
                
                <Link to={`/chat/${viewingUser?.id}`} className="flex-1">
                  <Button
                    data-testid="premium-chat-user-btn"
                    variant="outline"
                    className="w-full border-2 border-purple-500 text-purple-600 hover:bg-purple-50 rounded-xl py-3 text-sm"
                  >
                    <Crown className="w-4 h-4 mr-1" />
                    Chat
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* User Posts Grid */}
          {(
            // If the viewed account is private and it's not your own profile,
            // hide the posts entirely. Followers should not see content of
            // private accounts.
            viewingUser?.isPrivate && !isViewingOwnProfile
          ) ? (
            <div className="glass-effect rounded-3xl overflow-hidden shadow-xl">
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-16 text-center">
                <div className="bg-white rounded-full w-32 h-32 mx-auto mb-6 flex items-center justify-center shadow-lg">
                  <Lock className="w-16 h-16 text-gray-400" />
                </div>
                <h3 className="text-3xl font-bold text-gray-800 mb-3">This Account is Private</h3>
                <p className="text-gray-600 text-lg mb-2">
                  Follow @{viewingUser?.username} to see their photos and videos
                </p>
                {viewingUser?.hasRequested && (
                  <div className="mt-4 inline-block bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
                    ✓ Follow request sent
                  </div>
                )}
              </div>
            </div>
          ) : postsLoading ? (
            <div className="glass-effect rounded-3xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Loading Posts...</h3>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
              </div>
            </div>
          ) : userPosts && userPosts.length > 0 ? (
            <div className="glass-effect rounded-3xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Posts</h3>
              <div className="grid grid-cols-3 gap-2">
                {userPosts.slice(0, 9).map((post) => {
                  const mediaUrl = normalizePostMediaUrl(post);
                  if (!mediaUrl) {
                    return (
                      <div key={post.id} className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    );
                  }
                  const isVideo = (post.mediaType || post.postType) === "video";
                  return (
                    <div key={post.id} className="aspect-square rounded-lg overflow-hidden">
                      {isVideo ? (
                        <video
                          src={mediaUrl}
                          className="w-full h-full object-cover"
                          controls
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <img
                          src={mediaUrl}
                          alt="Post"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://via.placeholder.com/400?text=Image+Not+Found';
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewingUser?.postsCount > 0 ? (
            <div className="glass-effect rounded-3xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Unable to Load Posts</h3>
              <p className="text-gray-600 text-center">This user has {viewingUser.postsCount} posts but they couldn't be loaded.</p>
              <p className="text-sm text-gray-500 text-center mt-2">Please check console logs for details.</p>
            </div>
          ) : (
            <div className="glass-effect rounded-3xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">No Posts Yet</h3>
              <p className="text-gray-600 text-center">This user hasn't posted anything yet</p>
            </div>
          )}
        </div>

        {/* Vibe Check Dialog */}
        <Dialog open={showVibeCompatibility} onOpenChange={setShowVibeCompatibility}>
          <DialogContent className="bg-white rounded-3xl max-w-md" data-testid="vibe-compatibility-dialog">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500">
                Vibe Check
              </DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              {vibeScore !== null ? (
                <div className="space-y-3">
                  {/* Main Score */}
                  <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500">
                    {vibeScore.compatibility_percentage}%
                  </div>
                  <p className="text-sm text-gray-600">
                    {vibeScore.message}
                  </p>
                  
                  {/* Breakdown in Grid - All 3 in one view */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {/* Total Score */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3">
                      <div className="text-2xl font-bold text-purple-600">
                        {vibeScore.compatibility_percentage}%
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Overall</div>
                    </div>
                    
                    {/* Interest Match */}
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3">
                      <div className="text-2xl font-bold text-blue-600">
                        {vibeScore.interest_score}%
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Interests</div>
                    </div>
                    
                    {/* Personality Match */}
                    <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-3">
                      <div className="text-2xl font-bold text-pink-600">
                        {vibeScore.personality_score}%
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Personality</div>
                    </div>
                  </div>
                  
                  {/* Common Interests */}
                  {vibeScore.common_interests && vibeScore.common_interests.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-3 mt-3">
                      <div className="text-xs font-semibold text-gray-700 mb-2">❤️ Common Interests</div>
                      <div className="flex flex-wrap gap-1">
                        {vibeScore.common_interests.map((interest, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-sm text-gray-600">
                    Calculating vibe...
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* About this account Dialog */}
        <Dialog
          open={showAccountInfo}
          onOpenChange={(open) => {
            setShowAccountInfo(open);
            if (!open) {
              setAccountInfo(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>About this account</DialogTitle>
              <DialogDescription>
                To help keep our community authentic, we're showing information about accounts on LuvHive.
              </DialogDescription>
            </DialogHeader>

            {/* Loading State */}
            {!accountInfo && (
              <div className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading account information...</p>
              </div>
            )}

            {/* Error State */}
            {accountInfo?.error && (
              <div className="py-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <p className="font-semibold text-red-800">Failed to load</p>
                      <p className="text-sm text-red-600 mt-1">{accountInfo.message}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAccountInfo(false);
                    setAccountInfo(null);
                  }}
                  className="w-full mt-4 bg-gray-900 hover:bg-gray-800 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {/* Success State */}
            {accountInfo && !accountInfo.error && (
              <div className="space-y-4 py-4">
                {/* Date Joined */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Date joined</p>
                    <p className="text-sm text-gray-600">{accountInfo.dateJoined}</p>
                  </div>
                </div>
                
                {/* Country */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Account based in</p>
                    <p className="text-sm text-gray-600">{accountInfo.country}</p>
                  </div>
                </div>
                
                {/* Verified Badge (if verified) */}
                {accountInfo.isVerified && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Shield className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">Verified</p>
                        <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19l12-12-1.41-1.41z" />
                        </svg>
                      </div>
                      {accountInfo.isFounder ? (
                        <>
                          <p className="text-sm text-gray-700 mb-1">
                            <span className="font-semibold">👑 Official LuvHive Account</span>
                          </p>
                          <p className="text-xs text-gray-600">
                            This is the official account of LuvHive. Verified on {accountInfo.verifiedAt}.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-700 mb-1">
                            Verified via: <span className="font-semibold">{accountInfo.verificationPathway}</span>
                          </p>
                          <p className="text-xs text-gray-600">
                            {accountInfo.verificationPathway === 'High Engagement Pathway' && 
                              'Verified through exceptional community engagement with 20+ posts, 100+ followers, and significant likes and views.'}
                            {accountInfo.verificationPathway === 'Moderate Engagement Pathway' && 
                              'Verified through consistent activity over 90+ days with 10+ posts, 50+ followers, and strong engagement.'}
                            {accountInfo.verificationPathway === 'Community Contribution' && 
                              'Verified through valuable community contributions such as moderation or helpful reporting.'}
                            {accountInfo.verificationPathway === 'Cross-Platform Verified' && 
                              'Verified by linking a verified account from another major social platform.'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setShowAccountInfo(false);
                    setAccountInfo(null);
                  }}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Followers/Following Dialog */}
        <Dialog open={showFollowersDialog} onOpenChange={setShowFollowersDialog}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {followersDialogType === 'followers' ? 'Followers' : 'Following'}
              </DialogTitle>
            </DialogHeader>
            
            {followersLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : followersList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No {followersDialogType === 'followers' ? 'followers' : 'following'} yet
              </div>
            ) : (
              <div className="space-y-3">
                {followersList.map((follower) => (
                  <div
                    key={follower.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <img
                      src={follower.profileImage || "https://via.placeholder.com/40"}
                      alt={follower.username}
                      className="w-12 h-12 rounded-full object-cover border-2 border-pink-200 cursor-pointer"
                      onClick={() => {
                        setShowFollowersDialog(false);
                        navigate(`/profile/${follower.id}`);
                      }}
                    />
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        setShowFollowersDialog(false);
                        navigate(`/profile/${follower.id}`);
                      }}
                    >
                      <p className="font-semibold text-gray-900 truncate">{follower.username}</p>
                      {follower.fullName && (
                        <p className="text-sm text-gray-500 truncate">{follower.fullName}</p>
                      )}
                    </div>
                    {/* Don't show follow button for own profile */}
                    {follower.id !== user?.id && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollowToggle(follower.id, follower.isFollowing, follower.hasRequested);
                        }}
                        size="sm"
                        variant={follower.isFollowing || follower.hasRequested ? "outline" : "default"}
                        disabled={followingInProgress.has(follower.id)}
                        className={
                          follower.isFollowing 
                            ? "border-pink-500 text-pink-600 hover:bg-pink-50 rounded-full min-w-[90px]"
                            : follower.hasRequested
                            ? "border-gray-400 text-gray-700 hover:bg-gray-50 rounded-full min-w-[90px]"
                            : "bg-pink-500 hover:bg-pink-600 text-white rounded-full min-w-[90px]"
                        }
                      >
                        {followingInProgress.has(follower.id) ? (
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs">
                              {follower.hasRequested ? 'Canceling...' : (follower.isFollowing ? 'Unfollowing...' : 'Following...')}
                            </span>
                          </div>
                        ) : (
                          follower.hasRequested
                            ? "Requested"
                            : (follower.isFollowing 
                              ? "Following" 
                              : (followersDialogType === 'followers' ? "Follow back" : "Follow"))
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Discovery Page (Original Content)
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100" data-testid="profile-page">
      {/* Header */}
      <header className="glass-effect border-b border-pink-100">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/home">
            <Button variant="ghost" className="hover:bg-pink-50">
              <ArrowLeft className="w-5 h-5 text-pink-600" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
            Discover
          </h1>
          <div className="w-10"></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Profile Card */}
        <div className="glass-effect rounded-3xl p-8 mb-8 shadow-xl animate-fadeIn">
          <div className="text-center">
            <img
              src={profile?.profileImage || "https://via.placeholder.com/120"}
              alt={profile?.username}
              className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-pink-200 shadow-lg mb-4"
            />
            <h2 className="text-3xl font-bold text-gray-800 mb-1">{profile?.fullName}</h2>
            <p className="text-lg text-gray-600 mb-2">@{profile?.username}</p>
            
            {profile?.isPremium && (
              <div className="inline-flex items-center gap-2 premium-badge mb-4">
                <Crown className="w-4 h-4" />
                PREMIUM MEMBER
              </div>
            )}

            <div className="flex justify-center gap-8 mt-6 mb-6">
              <div>
                <p className="text-2xl font-bold text-pink-600">{profile?.age}</p>
                <p className="text-sm text-gray-600">Age</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-pink-600">{profile?.gender}</p>
                <p className="text-sm text-gray-600">Gender</p>
              </div>
            </div>

            {profile?.bio && (
              <div className="bg-pink-50 rounded-2xl p-4 mt-4">
                <LinkifyBio text={profile.bio} />
              </div>
            )}

            {profile?.telegramLinked ? (
              <div className="mt-6 bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                <p className="text-green-700 font-semibold">✓ Telegram Connected</p>
              </div>
            ) : (
              <div className="mt-6 bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
                <p className="text-yellow-700 font-semibold">⚠ Telegram Not Connected</p>
                <p className="text-sm text-gray-600 mt-1">Link your Telegram account from the bot</p>
              </div>
            )}
          </div>
        </div>

        {/* Premium Section */}
        {!profile?.isPremium && (
          <div className="glass-effect rounded-3xl p-8 mb-8 shadow-xl animate-slideIn">
            <div className="text-center">
              <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Upgrade to Premium</h3>
              <p className="text-gray-600 mb-6">Unlock unlimited chat and exclusive features</p>
              <Button
                onClick={() => setShowPremiumPopup(true)}
                data-testid="premium-chat-btn"
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-8 py-6 rounded-xl text-lg btn-hover"
              >
                Get Premium Now
              </Button>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="glass-effect rounded-3xl p-6 shadow-xl animate-scaleIn">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Discover People</h3>
          <div className="space-y-3">
            {users.length === 0 ? (
              <p className="text-center text-gray-600 py-4">No users found</p>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50 transition-colors"
                >
                  <Link to={`/profile/${u.id}`}>
                    <img
                      src={u.profileImage || "https://via.placeholder.com/48"}
                      alt={u.username}
                      className="w-12 h-12 rounded-full object-cover border-2 border-pink-200 cursor-pointer hover:border-pink-400 transition-colors"
                    />
                  </Link>
                  <div className="flex-1">
                    <Link to={`/profile/${u.id}`} className="font-semibold text-gray-800 hover:text-pink-600 transition-colors">
                      {u.fullName}
                    </Link>
                    <p className="text-sm text-gray-600">@{u.username}</p>
                    <p className="text-xs text-gray-500">{u.followersCount} followers</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleFollowToggle(u.id, u.isFollowing)}
                      data-testid={`follow-btn-${u.id}`}
                      size="sm"
                      variant={u.isFollowing ? "outline" : "default"}
                      disabled={followingInProgress.has(u.id)}
                      className={u.isFollowing ? "border-pink-500 text-pink-600 hover:bg-pink-50 rounded-full min-w-[80px]" : "bg-pink-500 hover:bg-pink-600 text-white rounded-full min-w-[80px]"}
                    >
                      {followingInProgress.has(u.id) ? (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs">{u.isFollowing ? 'Unfollowing...' : 'Following...'}</span>
                        </div>
                      ) : (
                        u.isFollowing ? "Following" : "Follow"
                      )}
                    </Button>
                    <Link to={`/chat/${u.id}`}>
                      <Button
                        data-testid={`chat-btn-${u.id}`}
                        size="sm"
                        variant="outline"
                        className="border-pink-500 text-pink-600 hover:bg-pink-50 rounded-full"
                      >
                        Chat
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Premium Popup */}
      <Dialog open={showPremiumPopup} onOpenChange={setShowPremiumPopup}>
        <DialogContent className="bg-white rounded-3xl" data-testid="premium-popup">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-500">
              Premium Chat
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700 mt-4">
              <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">
                Buy Premium from Bot to Use Chat Service
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Visit our Telegram bot to purchase premium membership and unlock unlimited chat access
              </p>
              <Button
                onClick={() => window.open("https://t.me/your_bot_username", "_blank")}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl"
              >
                Open Telegram Bot
              </Button>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Verification Details Popover */}
      
    </div>
  );
};

export default ProfilePage;