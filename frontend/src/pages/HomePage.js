import { useState, useEffect, memo, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Send, Plus, LogOut, User as UserIcon, Bookmark, X, MoreVertical, Trash2, Download, Link2, Share2, AlertCircle, Bell, Search, MessageSquare } from "lucide-react";
import HashtagText from "@/components/HashtagText";
import axios from "axios";
import { httpClient } from "@/utils/authClient";
import { getPostMediaUrl } from '@/utils/media';
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

const API = "/api";

// Utility function for relative time (IST-aware)
const getRelativeTime = (dateString) => {
  // Parse the UTC time from backend - ensure it's treated as UTC
  // If the string doesn't have 'Z' at end, add it to mark as UTC
  const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
  const postDate = new Date(utcString);
  const now = new Date();
  
  // Calculate difference in milliseconds
  const diffInMs = now.getTime() - postDate.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  
  // Handle negative times (future dates - shouldn't happen but just in case)
  if (diffInSeconds < 0) {
    return "just now";
  }
  
  // Less than 1 minute
  if (diffInSeconds < 60) {
    return "just now";
  }
  
  // Less than 1 hour
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }
  
  // Less than 24 hours
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }
  
  // Less than 7 days
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }
  
  // More than 7 days - show date in IST
  return postDate.toLocaleDateString('en-IN', { 
    month: 'short', 
    day: 'numeric',
    year: postDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    timeZone: 'Asia/Kolkata'
  });
};

const HomePage = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [storyToDelete, setStoryToDelete] = useState(null);
  const [viewingStories, setViewingStories] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportingPost, setReportingPost] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editCaption, setEditCaption] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingPost, setDeletingPost] = useState(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentingPost, setCommentingPost] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [newPost, setNewPost] = useState({ mediaUrl: "", caption: "", mediaType: "image" });
  const [newStory, setNewStory] = useState({ mediaUrl: "", caption: "", mediaType: "image" });
  const [openPostMenu, setOpenPostMenu] = useState(null); // Track which post menu is open

  useEffect(() => {
    fetchFeed();
    fetchNotificationCount();
    fetchMessageCount();
    
    // Poll notification and message count every 30 seconds
    const interval = setInterval(() => {
      fetchNotificationCount();
      fetchMessageCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close post menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openPostMenu && !event.target.closest('[data-testid^="post-menu-"]')) {
        setOpenPostMenu(null);
      }
    };

    if (openPostMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openPostMenu]);

  const fetchNotificationCount = async () => {
    try {
      const response = await httpClient.get(`/notifications/unread-count`);
      setNotificationCount(response.data.count);
    } catch (error) {
      console.error("Error fetching notification count:", error);
    }
  };

  const fetchMessageCount = async () => {
    try {
      const response = await httpClient.get(`/messages/unread-count`);
      setMessageCount(response.data.count);
    } catch (error) {
      console.error("Error fetching message count:", error);
    }
  };

  const fetchFeed = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [storiesRes, postsRes] = await Promise.all([
        axios.get(`${API}/stories/feed`, { headers }),
        axios.get(`${API}/posts/feed`, { headers })
      ]);

      setStories(storiesRes.data.stories || []);
      setPosts(postsRes.data.posts || []);
    } catch (error) {
      console.error("Error fetching feed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "post") {
          setNewPost({ ...newPost, mediaUrl: reader.result, mediaType: file.type.startsWith("video") ? "video" : "image" });
        } else {
          setNewStory({ ...newStory, mediaUrl: reader.result, mediaType: file.type.startsWith("video") ? "video" : "image" });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.mediaUrl) {
      alert("Please upload an image or video");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/create`, newPost, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowCreatePost(false);
      setNewPost({ mediaUrl: "", caption: "", mediaType: "image" });
      fetchFeed();
    } catch (error) {
      alert("Failed to create post");
    }
  };

  const handleCreateStory = async () => {
    if (!newStory.mediaUrl) {
      alert("Please upload an image or video");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/stories/create`, newStory, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowCreateStory(false);
      setNewStory({ mediaUrl: "", caption: "", mediaType: "image" });
      fetchFeed();
    } catch (error) {
      alert("Failed to create story");
    }
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/posts/${postId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Like response:", response.data);
      
      // Immediately update the UI without waiting for full fetch
      setPosts(prevPosts => prevPosts.map(post => {
        if (post.id === postId) {
          const isLiked = post.isLiked;
          return {
            ...post,
            isLiked: !isLiked,
            likes: isLiked 
              ? post.likes.filter(id => id !== user?.id)
              : [...post.likes, user?.id]
          };
        }
        return post;
      }));
      
      // Fetch full feed in background
      fetchFeed();
    } catch (error) {
      console.error("Error liking post:", error);
      alert("Failed to like post. Please try again.");
    }
  };

  const handleSavePost = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${postId}/save`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFeed();
    } catch (error) {
      console.error("Error saving post:", error);
    }
  };

  const handleSharePost = async (postId) => {
    const postLink = `${window.location.origin}/post/${postId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post on LuvHive',
          text: 'Amazing post on LuvHive!',
          url: postLink,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          // Fallback to copy link
          navigator.clipboard.writeText(postLink).then(() => {
            alert('Link copied to clipboard! Share it on Telegram, WhatsApp, Snapchat, Instagram, or Facebook!');
          });
        }
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(postLink).then(() => {
        alert('Link copied to clipboard! Share it on Telegram, WhatsApp, Snapchat, Instagram, or Facebook!');
      }).catch(() => {
        alert('Failed to copy link');
      });
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !commentingPost) return;

    try {
      // For now, we'll update locally (backend endpoint can be added later)
      setPosts(prevPosts => prevPosts.map(post => {
        if (post.id === commentingPost.id) {
          return {
            ...post,
            comments: [...post.comments, {
              userId: user?.id,
              username: user?.username,
              profileImage: user?.profileImage,
              text: commentText,
              createdAt: new Date().toISOString()
            }]
          };
        }
        return post;
      }));

      setShowCommentDialog(false);
      setCommentingPost(null);
      setCommentText("");
      alert("Comment posted!");
    } catch (error) {
      alert("Failed to post comment");
    }
  };

  const openStoryViewer = (storyGroup) => {
    setViewingStories(storyGroup);
    setCurrentStoryIndex(0);
    setShowStoryViewer(true);
  };

  const nextStory = () => {
    if (viewingStories && currentStoryIndex < viewingStories.stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      setShowStoryViewer(false);
    }
  };

  const previousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    }
  };

  const handleDeleteStory = async () => {
    if (!storyToDelete) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/stories/${storyToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowDeleteConfirm(false);
      setShowStoryViewer(false);
      setStoryToDelete(null);
      fetchFeed();
      alert("Story deleted successfully!");
    } catch (error) {
      alert("Failed to delete story");
    }
  };

  const handleSaveVideo = async () => {
    if (!viewingStories || !viewingStories.stories[currentStoryIndex]) return;

    const currentStory = viewingStories.stories[currentStoryIndex];
    const mediaUrl = currentStory.mediaUrl;

    try {
      // Download the media
      const link = document.createElement('a');
      link.href = mediaUrl;
      link.download = `story-${Date.now()}.${currentStory.mediaType === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert("Media saved successfully!");
    } catch (error) {
      alert("Failed to save media");
    }
  };

  const handleCopyLink = () => {
    if (!viewingStories || !viewingStories.stories[currentStoryIndex]) return;

    const currentStory = viewingStories.stories[currentStoryIndex];
    const storyLink = `${window.location.origin}/story/${currentStory.id}`;

    navigator.clipboard.writeText(storyLink).then(() => {
      alert("Link copied to clipboard!");
    }).catch(() => {
      alert("Failed to copy link");
    });
  };

  const handleShareStory = async () => {
    if (!viewingStories || !viewingStories.stories[currentStoryIndex]) return;

    const currentStory = viewingStories.stories[currentStoryIndex];
    const storyLink = `${window.location.origin}/story/${currentStory.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Story by ${viewingStories.username}`,
          text: currentStory.caption || "Check out this story on LuvHive!",
          url: storyLink,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          alert("Failed to share");
        }
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(storyLink).then(() => {
        alert("Link copied! Share it on Telegram, WhatsApp, Snapchat, or Instagram!");
      });
    }
  };

  const openDeleteConfirm = (storyId) => {
    setStoryToDelete(storyId);
    setShowDeleteConfirm(true);
  };

  const handleUnfollowFromPost = async (postUserId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/${postUserId}/unfollow`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Unfollowed successfully!");
      fetchFeed(); // Refresh feed
    } catch (error) {
      console.error("Error unfollowing:", error);
      alert("Failed to unfollow");
    }
  };

  const handleFollowFromPost = async (postUserId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/${postUserId}/follow`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Following successfully!");
      fetchFeed(); // Refresh feed
    } catch (error) {
      console.error("Error following:", error);
      alert("Failed to follow");
    }
  };

  const handleMuteUser = async (postUserId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/${postUserId}/mute`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("User muted. You won't see their posts anymore.");
      fetchFeed(); // Refresh feed to remove muted user's posts
    } catch (error) {
      console.error("Error muting user:", error);
      alert("Failed to mute user");
    }
  };

  const handleBlockUser = async (postUserId) => {
    if (window.confirm("Are you sure you want to block this user? They won't be able to see your posts or follow you.")) {
      try {
        const token = localStorage.getItem("token");
        await axios.post(`${API}/users/${postUserId}/block`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert("User blocked successfully");
        fetchFeed(); // Refresh feed to remove blocked user's posts
      } catch (error) {
        console.error("Error blocking user:", error);
        alert("Failed to block user");
      }
    }
  };

  const handleReportPost = async (reason) => {
    if (!reportingPost) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${reportingPost.id}/report`, 
        { reason }, 
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      alert("Report submitted successfully. Thank you for helping keep LuvHive safe!");
      setShowReportDialog(false);
      setReportingPost(null);
    } catch (error) {
      console.error("Error reporting post:", error);
      alert("Failed to submit report. Please try again.");
    }
  };

  const handleArchivePost = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${postId}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Post archived successfully!");
      fetchFeed();
    } catch (error) {
      alert("Failed to archive post");
    }
  };

  const handleHideLikes = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${postId}/hide-likes`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFeed();
    } catch (error) {
      alert("Failed to toggle likes visibility");
    }
  };

  const handleToggleComments = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${postId}/toggle-comments`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFeed();
    } catch (error) {
      alert("Failed to toggle comments");
    }
  };

  const handleEditCaption = async () => {
    if (!editingPost) return;

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("caption", editCaption);
      
      await axios.put(`${API}/posts/${editingPost.id}/caption`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowEditDialog(false);
      setEditingPost(null);
      setEditCaption("");
      alert("Caption updated successfully!");
      fetchFeed();
    } catch (error) {
      alert("Failed to update caption");
    }
  };

  const handleDeletePost = async () => {
    if (!deletingPost) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/posts/${deletingPost}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowDeleteDialog(false);
      setDeletingPost(null);
      alert("Post deleted successfully!");
      fetchFeed();
    } catch (error) {
      alert("Failed to delete post");
    }
  };

  const handlePinPost = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${postId}/pin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Post pinned successfully!");
      fetchFeed();
    } catch (error) {
      alert("Failed to pin post");
    }
  };

  // Find user's own stories
  const myStories = stories.find(s => s.userId === user?.id);
  const otherStories = stories.filter(s => s.userId !== user?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <div className="text-2xl text-pink-600">Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100" data-testid="home-page">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 border-b border-pink-100">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
            LuvHive
          </h1>
          <div className="flex items-center gap-3">
            {user?.isPremium && (
              <span className="premium-badge">PREMIUM</span>
            )}
            <Link to="/search">
              <Button variant="ghost" className="hover:bg-pink-50 p-2" data-testid="search-btn">
                <Search className="w-5 h-5 text-pink-600" />
              </Button>
            </Link>
            <Link to="/messages">
              <Button variant="ghost" className="hover:bg-pink-50 relative p-2" data-testid="messages-btn">
                <MessageSquare className="w-5 h-5 text-pink-600" />
                {messageCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {messageCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/notifications">
              <Button variant="ghost" className="hover:bg-pink-50 relative p-2" data-testid="notifications-btn">
                <Bell className="w-5 h-5 text-pink-600" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/profile">
              <Button variant="ghost" className="hover:bg-pink-50 p-2" data-testid="profile-btn">
                <UserIcon className="w-5 h-5 text-pink-600" />
              </Button>
            </Link>
            <Button
              onClick={onLogout}
              variant="ghost"
              className="hover:bg-pink-50 p-2"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5 text-pink-600" />
            </Button>
          </div>
        </div>
        
        {/* Compact Stories Section */}
        <div className="container mx-auto px-4 pb-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* User Profile Circle */}
            <Link to="/profile">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 p-0.5 cursor-pointer hover:scale-105 transition-transform">
                <img
                  src={
                    user?.profileImage 
                      ? (user.profileImage.startsWith('http') || user.profileImage.startsWith('data:')
                          ? user.profileImage 
                          : `${user.profileImage}`)
                      : "https://via.placeholder.com/40"
                  }
                  alt="Profile"
                  className="w-full h-full rounded-full object-cover border-2 border-white"
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/40";
                  }}
                />
              </div>
            </Link>
            
            {/* Stories Button */}
            <button
              onClick={() => {
                if (stories.length > 0) {
                  const myStory = stories.find(s => s.userId === user?.id);
                  openStoryViewer(myStory || stories[0]);
                } else {
                  setShowCreateStory(true);
                }
              }}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-400 to-rose-400 text-white text-sm font-medium flex items-center gap-2 hover:from-pink-500 hover:to-rose-500 transition-all shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Stories
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Create Post Button */}
        <div className="mb-6">
          <Button
            onClick={() => setShowCreatePost(true)}
            data-testid="create-post-btn"
            className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-6 rounded-2xl text-lg btn-hover"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Post
          </Button>
        </div>

        {/* Posts Feed */}
        <div className="space-y-6 animate-slideIn">
          {posts.length === 0 ? (
            <div className="text-center py-12 glass-effect rounded-3xl">
              <p className="text-gray-600 text-lg">No posts yet. Be the first to share!</p>
            </div>
          ) : (
            posts.filter(post => {
              // Always show posts from other users
              if (post.userId !== user?.id) return true;
              
              // For own posts, only show if created within last 1 minute
              try {
                const postTime = new Date(post.createdAt);
                const now = new Date();
                const diffInMinutes = (now - postTime) / (1000 * 60);
                
                // Show only if less than 1 minute old
                return diffInMinutes < 1;
              } catch (error) {
                // If can't parse date, hide own post
                return false;
              }
            }).map((post) => (
              <div key={post.id} className="glass-effect rounded-3xl shadow-lg hover:shadow-xl transition-shadow">
                {/* Post Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        post.userProfileImage 
                          ? (post.userProfileImage.startsWith('http') || post.userProfileImage.startsWith('data:')
                              ? post.userProfileImage 
                              : `${post.userProfileImage}`)
                          : "https://via.placeholder.com/40"
                      }
                      alt={post.username}
                      className="w-10 h-10 rounded-full object-cover border-2 border-pink-200"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/40";
                      }}
                    />
                    <div>
                      <Link to={`/profile/${post.userId}`} className="font-semibold text-gray-800 hover:text-pink-600 transition-colors">
                        {post.username}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {getRelativeTime(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* 3-Dot Menu */}
                  <div className="relative ml-auto flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPostMenu(openPostMenu === post.id ? null : post.id);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-6 h-6 text-gray-700" />
                    </button>
                    
                    {openPostMenu === post.id && (
                      <div 
                        className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {post.userId === user?.id ? (
                          // Own post options
                          <>
                            <button onClick={() => { handleArchivePost(post.id); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b">
                              <Download className="w-5 h-5" />
                              Archive
                            </button>
                            <button onClick={() => { handleHideLikes(post.id); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b">
                              <Heart className="w-5 h-5" />
                              {post.likesHidden ? "Show" : "Hide"} Like Count
                            </button>
                            <button onClick={() => { handleToggleComments(post.id); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b">
                              <MessageCircle className="w-5 h-5" />
                              {post.commentsDisabled ? "Turn On" : "Turn Off"} Commenting
                            </button>
                            <button onClick={() => { setEditingPost(post); setEditCaption(post.caption); setShowEditDialog(true); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b">
                              <Send className="w-5 h-5" />
                              Edit Caption
                            </button>
                            <button onClick={() => { setDeletingPost(post.id); setShowDeleteDialog(true); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-red-50 text-red-600 flex items-center gap-3 border-b">
                              <Trash2 className="w-5 h-5" />
                              Delete
                            </button>
                            <button onClick={() => { handlePinPost(post.id); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3">
                              <Plus className="w-5 h-5" />
                              {post.isPinned ? "Unpin from" : "Pin to"} Your Main Grid
                            </button>
                          </>
                        ) : (
                          // Other user's post options
                          <>
                            <button onClick={() => { handleSavePost(post.id); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b">
                              <Bookmark className="w-5 h-5" />
                              {post.isSaved ? "Unsave" : "Save"} Post
                            </button>
                            <button onClick={() => { handleFollowFromPost(post.userId); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b">
                              <UserIcon className="w-5 h-5" />
                              Follow @{post.username}
                            </button>
                            <button onClick={() => { handleUnfollowFromPost(post.userId); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b">
                              <UserIcon className="w-5 h-5" />
                              Unfollow @{post.username}
                            </button>
                            <button onClick={() => { handleMuteUser(post.userId); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b">
                              <AlertCircle className="w-5 h-5" />
                              Mute User
                            </button>
                            <button onClick={() => { handleBlockUser(post.userId); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b text-orange-600">
                              <AlertCircle className="w-5 h-5" />
                              Block User
                            </button>
                            <button onClick={() => { setReportingPost(post); setShowReportDialog(true); setOpenPostMenu(null); }} className="w-full px-4 py-3 text-left hover:bg-red-50 text-red-600 flex items-center gap-3">
                              <AlertCircle className="w-5 h-5" />
                              Report Post
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Post Media */}
                <div className="bg-gray-100">
                  {(() => {
                    // Resolve the correct media URL using our helper. This will proxy
                    // Telegram file IDs through `/api/media/<id>` and normalise
                    // relative `/uploads` paths. If no media exists, return null.
                    const mediaUrl = getPostMediaUrl(post);
                    if (!mediaUrl) return null;
                    const isVideo = post.mediaType === 'video';
                    return isVideo ? (
                      <video src={mediaUrl} controls className="w-full max-h-96 object-contain" />
                    ) : (
                      <img src={mediaUrl} alt="Post" className="w-full max-h-96 object-contain" />
                    );
                  })()}
                </div>

                {/* Post Actions */}
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleLike(post.id)}
                        className="flex items-center gap-2 hover:scale-110 transition-transform"
                        data-testid={`like-btn-${post.id}`}
                      >
                        <Heart
                          className={`w-6 h-6 ${post.isLiked ? "fill-red-500 text-red-500" : "text-gray-700"}`}
                        />
                        {!post.likesHidden && (
                          <span className="text-sm text-gray-700">{post.likes.length}</span>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                          if (post.commentsDisabled) {
                            alert("Comments are turned off for this post");
                          } else {
                            setCommentingPost(post);
                            setShowCommentDialog(true);
                          }
                        }}
                        className="flex items-center gap-2 hover:scale-110 transition-transform"
                        data-testid={`comment-btn-${post.id}`}
                      >
                        <MessageCircle className="w-6 h-6 text-gray-700" />
                        <span className="text-sm text-gray-700">{post.comments.length}</span>
                      </button>
                      <button
                        onClick={() => handleSharePost(post.id)}
                        className="flex items-center gap-2 hover:scale-110 transition-transform"
                        data-testid={`share-btn-${post.id}`}
                      >
                        <Send className="w-6 h-6 text-gray-700" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleSavePost(post.id)}
                      className="hover:scale-110 transition-transform"
                      data-testid={`save-btn-${post.id}`}
                    >
                      <Bookmark
                        className={`w-6 h-6 ${post.isSaved ? "fill-pink-500 text-pink-500" : "text-gray-700"}`}
                      />
                    </button>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <p className="text-gray-800">
                      <span className="font-semibold mr-2">{post.username}</span>
                      <HashtagText text={post.caption} />
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Post Dialog */}
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent className="bg-white rounded-3xl" data-testid="create-post-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
              Create New Post
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Image/Video
              </label>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => handleImageUpload(e, "post")}
                className="w-full border border-gray-300 rounded-xl px-4 py-2"
              />
              {newPost.mediaUrl && (
                <div className="mt-4">
                  {newPost.mediaType === "video" ? (
                    <video src={newPost.mediaUrl} controls className="w-full rounded-xl max-h-64" />
                  ) : (
                    <img src={newPost.mediaUrl} alt="Preview" className="w-full rounded-xl max-h-64 object-contain" />
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Caption (Optional)
              </label>
              <Textarea
                value={newPost.caption}
                onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
                placeholder="Write a caption..."
                rows={3}
                className="border-gray-300 focus:border-pink-500 rounded-xl resize-none"
              />
            </div>
            <Button
              onClick={handleCreatePost}
              data-testid="submit-post-btn"
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-4 rounded-xl btn-hover"
            >
              Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Story Dialog */}
      <Dialog open={showCreateStory} onOpenChange={setShowCreateStory}>
        <DialogContent className="bg-white rounded-3xl" data-testid="create-story-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
              Add to Your Story
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Image/Video
              </label>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => handleImageUpload(e, "story")}
                className="w-full border border-gray-300 rounded-xl px-4 py-2"
              />
              {newStory.mediaUrl && (
                <div className="mt-4">
                  {newStory.mediaType === "video" ? (
                    <video src={newStory.mediaUrl} controls className="w-full rounded-xl max-h-64" />
                  ) : (
                    <img src={newStory.mediaUrl} alt="Preview" className="w-full rounded-xl max-h-64 object-contain" />
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Caption (Optional)
              </label>
              <Textarea
                value={newStory.caption}
                onChange={(e) => setNewStory({ ...newStory, caption: e.target.value })}
                placeholder="Add a caption..."
                rows={2}
                className="border-gray-300 focus:border-pink-500 rounded-xl resize-none"
              />
            </div>
            <Button
              onClick={handleCreateStory}
              data-testid="submit-story-btn"
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-4 rounded-xl btn-hover"
            >
              Add Story
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Story Viewer Modal */}
      <Dialog open={showStoryViewer} onOpenChange={setShowStoryViewer}>
        <DialogContent className="bg-black max-w-md p-0 rounded-3xl overflow-hidden" data-testid="story-viewer">
          {viewingStories && viewingStories.stories[currentStoryIndex] && (
            <div className="relative w-full h-[600px]">
              {/* Close Button */}
              <button
                onClick={() => setShowStoryViewer(false)}
                className="absolute top-4 right-4 z-50 bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-opacity"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* 3-Dot Menu (Only for own stories) */}
              {viewingStories.userId === user?.id && (
                <div className="absolute top-4 right-16 z-50">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-opacity"
                        data-testid="story-menu-btn"
                      >
                        <MoreVertical className="w-6 h-6 text-white" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-white rounded-xl shadow-lg w-48" align="end">
                      <DropdownMenuItem 
                        onClick={() => openDeleteConfirm(viewingStories.stories[currentStoryIndex].id)}
                        className="cursor-pointer hover:bg-red-50 text-red-600 rounded-lg"
                        data-testid="delete-story-btn"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={handleSaveVideo}
                        className="cursor-pointer hover:bg-pink-50 rounded-lg"
                        data-testid="save-video-btn"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Save Video
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={handleCopyLink}
                        className="cursor-pointer hover:bg-pink-50 rounded-lg"
                        data-testid="copy-link-btn"
                      >
                        <Link2 className="w-4 h-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={handleShareStory}
                        className="cursor-pointer hover:bg-pink-50 rounded-lg"
                        data-testid="share-story-btn"
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {/* Story Progress Bars */}
              <div className="absolute top-2 left-2 right-2 flex gap-1 z-40">
                {viewingStories.stories.map((_, index) => (
                  <div key={index} className="flex-1 h-1 bg-gray-400 bg-opacity-50 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-white transition-all duration-300 ${
                        index === currentStoryIndex ? "w-full" : index < currentStoryIndex ? "w-full" : "w-0"
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* User Info */}
              <div className="absolute top-6 left-4 flex items-center gap-2 z-40">
                <img
                  src={
                    viewingStories.userProfileImage 
                      ? (viewingStories.userProfileImage.startsWith('http') || viewingStories.userProfileImage.startsWith('data:')
                          ? viewingStories.userProfileImage 
                          : `${viewingStories.userProfileImage}`)
                      : "https://via.placeholder.com/40"
                  }
                  alt={viewingStories.username}
                  className="w-8 h-8 rounded-full border-2 border-white"
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/40";
                  }}
                />
                <span className="text-white font-semibold text-sm">{viewingStories.username}</span>
              </div>

              {/* Story Content */}
              <div
                className="w-full h-full flex items-center justify-center bg-black cursor-pointer"
                onClick={nextStory}
              >
                {viewingStories.stories[currentStoryIndex].mediaType === "video" ? (
                  <video
                    src={viewingStories.stories[currentStoryIndex].mediaUrl}
                    autoPlay
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <img
                    src={viewingStories.stories[currentStoryIndex].mediaUrl}
                    alt="Story"
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>

              {/* Caption */}
              {viewingStories.stories[currentStoryIndex].caption && (
                <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-2xl p-3">
                  <p className="text-white text-sm">{viewingStories.stories[currentStoryIndex].caption}</p>
                </div>
              )}

              {/* Navigation Areas */}
              <div className="absolute inset-0 flex">
                <div
                  className="w-1/2 h-full cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    previousStory();
                  }}
                />
                <div className="w-1/2 h-full cursor-pointer" onClick={nextStory} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-white rounded-3xl" data-testid="delete-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800 text-center">
              Delete Story?
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600 mt-4">
              Are you sure you want to delete this story? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button
              onClick={() => {
                setShowDeleteConfirm(false);
                setStoryToDelete(null);
              }}
              variant="outline"
              className="flex-1 border-2 border-gray-300 hover:bg-gray-50 rounded-xl py-6"
              data-testid="cancel-delete-btn"
            >
              No, Keep It
            </Button>
            <Button
              onClick={handleDeleteStory}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-6"
              data-testid="confirm-delete-btn"
            >
              Yes, Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Caption Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Edit Caption</DialogTitle>
          </DialogHeader>
          <Textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} rows={4} className="mt-4" />
          <div className="flex gap-3 mt-4">
            <Button onClick={() => setShowEditDialog(false)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleEditCaption} className="flex-1 bg-pink-500 hover:bg-pink-600">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Post Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Delete Post?</DialogTitle>
            <DialogDescription className="text-center mt-4">Are you sure you want to delete this post? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button onClick={() => setShowDeleteDialog(false)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleDeletePost} className="flex-1 bg-red-500 hover:bg-red-600">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent className="bg-white rounded-3xl" data-testid="comment-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
              Add Comment
            </DialogTitle>
          </DialogHeader>
          
          {commentingPost && (
            <div className="mt-4">
              {/* Post Preview */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                <img
                  src={
                    commentingPost.userProfileImage 
                      ? (commentingPost.userProfileImage.startsWith('http') || commentingPost.userProfileImage.startsWith('data:')
                          ? commentingPost.userProfileImage 
                          : `${commentingPost.userProfileImage}`)
                      : "https://via.placeholder.com/40"
                  }
                  alt={commentingPost.username}
                  className="w-10 h-10 rounded-full object-cover border-2 border-pink-200"
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/40";
                  }}
                />
                <div>
                  <p className="font-semibold text-gray-800">{commentingPost.username}</p>
                  {commentingPost.caption && (
                    <p className="text-sm text-gray-600 truncate max-w-xs">{commentingPost.caption}</p>
                  )}
                </div>
              </div>

              {/* Existing Comments */}
              {commentingPost.comments.length > 0 && (
                <div className="mb-4 max-h-48 overflow-y-auto space-y-3">
                  {commentingPost.comments.map((comment, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <img
                        src={
                          comment.profileImage 
                            ? (comment.profileImage.startsWith('http') || comment.profileImage.startsWith('data:')
                                ? comment.profileImage 
                                : `${comment.profileImage}`)
                            : "https://via.placeholder.com/32"
                        }
                        alt={comment.username || 'User'}
                        className="w-8 h-8 rounded-full object-cover border-2 border-pink-200 flex-shrink-0"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/32";
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-semibold text-gray-800">{comment.username || 'User'}</span>{" "}
                          <span className="text-gray-700">{comment.text}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment Input */}
              <div className="space-y-4">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  rows={3}
                  className="border-gray-300 focus:border-pink-500 rounded-xl resize-none"
                  data-testid="comment-input"
                />
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowCommentDialog(false);
                      setCommentingPost(null);
                      setCommentText("");
                    }}
                    variant="outline"
                    className="flex-1 border-2 border-gray-300 hover:bg-gray-50 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePostComment}
                    disabled={!commentText.trim()}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl"
                    data-testid="post-comment-btn"
                  >
                    Post
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Post Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-3xl max-w-md" data-testid="report-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white text-center">
              Report
            </DialogTitle>
            <DialogDescription className="text-gray-300 mt-2 text-center text-sm">
              Why are you reporting this post?<br />
              Your report is anonymous. If someone is in immediate danger, call the local emergency services — don't wait.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 mt-6 max-h-[400px] overflow-y-auto">
            <button
              onClick={() => handleReportPost("I just don't like it")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-dont-like"
            >
              I just don't like it
            </button>
            
            <button
              onClick={() => handleReportPost("Harassment or bullying")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-harassment"
            >
              Harassment or bullying
            </button>
            
            <button
              onClick={() => handleReportPost("Self-harm or dangerous content")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-self-harm"
            >
              Self-harm or dangerous content
            </button>
            
            <button
              onClick={() => handleReportPost("Hate speech or violence")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-hate"
            >
              Hate speech or violence
            </button>
            
            <button
              onClick={() => handleReportPost("Illegal activities")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-illegal"
            >
              Illegal activities
            </button>
            
            <button
              onClick={() => handleReportPost("Adult content")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-adult"
            >
              Adult content
            </button>
            
            <button
              onClick={() => handleReportPost("Spam or scam")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-spam"
            >
              Spam or scam
            </button>
            
            <button
              onClick={() => handleReportPost("Misinformation")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-misinformation"
            >
              Misinformation
            </button>
            
            <button
              onClick={() => handleReportPost("Copyright violation")}
              className="w-full text-left px-4 py-4 hover:bg-gray-700 rounded-lg transition-colors text-white"
              data-testid="report-copyright"
            >
              Copyright violation
            </button>
          </div>
          
          <div className="mt-4">
            <Button
              onClick={() => {
                setShowReportDialog(false);
                setReportingPost(null);
              }}
              variant="outline"
              className="w-full border-2 border-gray-600 hover:bg-gray-700 rounded-xl py-4 text-white"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;