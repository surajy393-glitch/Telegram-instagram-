import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, MessageCircle, UserPlus } from "lucide-react";
import axios from "axios";

const API = "/api";

const getRelativeTime = (dateString) => {
  const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
  const postDate = new Date(utcString);
  const now = new Date();
  const diffInMs = now.getTime() - postDate.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  
  if (diffInSeconds < 0) return "just now";
  if (diffInSeconds < 60) return "just now";
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;
  
  return `${Math.floor(diffInDays / 7)}w`;
};

const NotificationsPage = ({ user, onLogout }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications || []);
      
      // Mark all as read
      await axios.post(`${API}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptFollowRequest = async (fromUserId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/${fromUserId}/accept-follow-request`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove notification from list
      setNotifications(prev => prev.filter(n => !(n.type === 'follow_request' && n.fromUserId === fromUserId)));
      
      alert("Follow request accepted!");
    } catch (error) {
      console.error("Error accepting follow request:", error);
      alert("Failed to accept follow request");
    }
  };

  const handleRejectFollowRequest = async (fromUserId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/${fromUserId}/reject-follow-request`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove notification from list
      setNotifications(prev => prev.filter(n => !(n.type === 'follow_request' && n.fromUserId === fromUserId)));
      
    } catch (error) {
      console.error("Error rejecting follow request:", error);
      alert("Failed to reject follow request");
    }
  };

  const handleFollowBack = async (fromUserId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/${fromUserId}/follow`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove notification from list after following back
      setNotifications(prev => prev.filter(n => !(n.type === 'started_following' && n.fromUserId === fromUserId)));
      
    } catch (error) {
      console.error("Error following back:", error);
      alert("Failed to follow back");
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "like":
        return <Heart className="w-10 h-10 text-red-500 fill-red-500" />;
      case "comment":
        return <MessageCircle className="w-10 h-10 text-blue-500" />;
      case "follow":
      case "follow_request":
      case "follow_request_accepted":
      case "started_following":
        return <UserPlus className="w-10 h-10 text-pink-500" />;
      default:
        return <Heart className="w-10 h-10 text-gray-500" />;
    }
  };

  const getNotificationText = (notif) => {
    switch (notif.type) {
      case "like":
        return "liked your post";
      case "comment":
        return "commented on your post";
      case "follow":
      case "started_following":
        return "started following you";
      case "follow_request":
        return "requested to follow you";
      case "follow_request_accepted":
        return "accepted your follow request";
      default:
        return "interacted with you";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <div className="text-2xl text-pink-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100" data-testid="notifications-page">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 border-b border-pink-100">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/home">
            <Button variant="ghost" className="hover:bg-pink-50">
              <ArrowLeft className="w-5 h-5 text-pink-600" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
            Notifications
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {notifications.length === 0 ? (
          <div className="text-center py-16 glass-effect rounded-3xl">
            <div className="text-6xl mb-4">🔔</div>
            <p className="text-gray-600 text-lg font-semibold mb-2">No Notifications Yet</p>
            <p className="text-gray-500">When someone likes or comments on your posts, you'll see it here.</p>
          </div>
        ) : (
          <div className="space-y-1 animate-fadeIn">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`glass-effect p-4 hover:bg-pink-50 transition-colors cursor-pointer ${
                  !notif.isRead ? "bg-pink-50/50" : ""
                }`}
                data-testid={`notification-${notif.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <img
                    src={notif.fromUserImage || "https://via.placeholder.com/40"}
                    alt={notif.fromUsername}
                    className="w-10 h-10 rounded-full object-cover border-2 border-pink-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800">
                      <span 
                        className="font-semibold cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${notif.fromUserId}`);
                        }}
                      >
                        {notif.fromUsername}
                      </span>{" "}
                      <span className="text-gray-600">{getNotificationText(notif)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getRelativeTime(notif.createdAt)}
                    </p>
                    
                    {/* Follow Request Actions */}
                    {notif.type === 'follow_request' && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptFollowRequest(notif.fromUserId);
                          }}
                          className="bg-pink-500 hover:bg-pink-600 text-white text-sm py-1 px-4 rounded-lg"
                        >
                          Confirm
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectFollowRequest(notif.fromUserId);
                          }}
                          variant="outline"
                          className="border-gray-300 text-gray-700 hover:bg-gray-100 text-sm py-1 px-4 rounded-lg"
                        >
                          Delete
                        </Button>
                      </div>
                    )}

                    {/* Follow Back Button for when someone starts following you */}
                    {notif.type === 'started_following' && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowBack(notif.fromUserId);
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 px-6 rounded-lg font-medium"
                        >
                          Follow back
                        </Button>
                      </div>
                    )}
                  </div>
                  {notif.postId && (
                    <div className="w-12 h-12 flex-shrink-0">
                      {/* Placeholder for post thumbnail */}
                      <div className="w-full h-full bg-gray-200 rounded-lg"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
