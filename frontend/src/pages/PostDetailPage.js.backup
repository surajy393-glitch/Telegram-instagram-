import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Send, Image as ImageIcon, MoreVertical, Trash2, Flag, Ban, Bookmark, Archive, Link as LinkIcon, Edit } from "lucide-react";
import axios from "axios";

const API = "/api";

const PostDetailPage = ({ user }) => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [showMenuFor, setShowMenuFor] = useState(null);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedCaption, setEditedCaption] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPostDetails();
    fetchComments();
  }, [postId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMenuFor(null);
      setShowPostMenu(false);
    };
    if (showMenuFor || showPostMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenuFor, showPostMenu]);

  const fetchPostDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPost(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching post:", error);
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/posts/${postId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data.comments || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
      setComments([]);
    }
  };

  const handleLike = async () => {
    if (!post) return;
    
    try {
      const token = localStorage.getItem("token");
      const isLiked = post.userLiked;
      const endpoint = isLiked ? 'unlike' : 'like';
      
      // Optimistic update
      setPost(prev => ({
        ...prev,
        userLiked: !isLiked,
        likesCount: isLiked ? Math.max(0, prev.likesCount - 1) : prev.likesCount + 1
      }));

      await axios.post(`${API}/posts/${postId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Error liking post:", error);
      // Rollback on error
      setPost(prev => ({
        ...prev,
        userLiked: !prev.userLiked,
        likesCount: prev.userLiked ? prev.likesCount + 1 : Math.max(0, prev.likesCount - 1)
      }));
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append('text', newComment);
      
      const response = await axios.post(
        `${API}/posts/${postId}/comment`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add new comment to list
      setComments(prev => [...prev, response.data.comment]);
      
      // Update comment count
      setPost(prev => ({
        ...prev,
        commentsCount: prev.commentsCount + 1
      }));

      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment");
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const token = localStorage.getItem("token");
      
      // Optimistic update
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          const likes = comment.likes || [];
          const userLiked = likes.includes(user.id);
          return {
            ...comment,
            likes: userLiked 
              ? likes.filter(id => id !== user.id)
              : [...likes, user.id],
            likesCount: userLiked ? (comment.likesCount || 0) - 1 : (comment.likesCount || 0) + 1
          };
        }
        return comment;
      }));

      // Make API call - for now we'll update the post's comments array
      const response = await axios.post(
        `${API}/posts/${postId}/comment/${commentId}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error("Error liking comment:", error);
    }
  };

  const handleReply = async (commentId) => {
    if (!replyText.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append('text', replyText);
      formData.append('parentCommentId', commentId);
      
      const response = await axios.post(
        `${API}/posts/${postId}/comment`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add reply to comments list
      setComments(prev => [...prev, response.data.comment]);
      
      setReplyText("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Error adding reply:", error);
      alert("Failed to add reply");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/posts/${postId}/comment/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Remove from local state
      setComments(prev => prev.filter(c => c.id !== commentId));
      
      // Update comment count
      setPost(prev => ({
        ...prev,
        commentsCount: Math.max(0, prev.commentsCount - 1)
      }));

      setShowMenuFor(null);
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment");
    }
  };

  const handleReportComment = async (commentId, commentUserId) => {
    const reason = window.prompt("Why are you reporting this comment?");
    if (!reason) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/posts/${postId}/comment/${commentId}/report`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Comment reported. We'll review it shortly.");
      setShowMenuFor(null);
    } catch (error) {
      console.error("Error reporting comment:", error);
      alert("Failed to report comment");
    }
  };

  const handleBlockUser = async (userId, username) => {
    if (!window.confirm(`Block ${username}? You won't see their posts or comments.`)) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/users/${userId}/block`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`${username} has been blocked`);
      
      // Remove all comments from blocked user
      setComments(prev => prev.filter(c => c.userId !== userId));
      setShowMenuFor(null);
    } catch (error) {
      console.error("Error blocking user:", error);
      alert("Failed to block user");
    }
  };

  const handleSavePost = async () => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = post?.isSaved ? 'unsave' : 'save';
      
      await axios.post(`${API}/posts/${postId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPost(prev => ({
        ...prev,
        isSaved: !prev.isSaved
      }));

      alert(post?.isSaved ? "Post removed from saved" : "Post saved!");
      setShowPostMenu(false);
    } catch (error) {
      console.error("Error saving post:", error);
      alert("Failed to save post");
    }
  };

  const handleArchivePost = async () => {
    if (!window.confirm("Archive this post? You can find it in your profile's archive tab.")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${postId}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("Post archived");
      navigate(-1);
    } catch (error) {
      console.error("Error archiving post:", error);
      alert("Failed to archive post");
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm("Delete this post permanently?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("Post deleted");
      navigate(-1);
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post");
    }
  };

  const handleReportPost = async () => {
    setShowReportModal(true);
    setShowPostMenu(false);
  };

  const submitReport = async () => {
    if (!reportReason.trim()) {
      alert("Please provide a reason for reporting");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/posts/${postId}/report`,
        { reason: reportReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Post reported. We'll review it shortly.");
      setShowReportModal(false);
      setReportReason("");
    } catch (error) {
      console.error("Error reporting post:", error);
      alert("Failed to report post");
    }
  };

  const handleHideLikes = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${postId}/hide-likes`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPost(prev => ({
        ...prev,
        likesHidden: !prev.likesHidden
      }));

      alert(post?.likesHidden ? "Like count now visible" : "Like count hidden");
      setShowPostMenu(false);
    } catch (error) {
      console.error("Error hiding likes:", error);
      alert("Failed to hide likes");
    }
  };

  const handleEditCaption = () => {
    setEditedCaption(post?.caption || "");
    setShowEditModal(true);
    setShowPostMenu(false);
  };

  const submitEditCaption = async () => {
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append('caption', editedCaption);
      
      await axios.put(`${API}/posts/${postId}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPost(prev => ({
        ...prev,
        caption: editedCaption
      }));

      alert("Caption updated!");
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating caption:", error);
      alert("Failed to update caption");
    }
  };

  const handleCopyLink = async () => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(postUrl);
      alert("Link copied to clipboard!");
      setShowPostMenu(false);
    } catch (error) {
      alert("Failed to copy link");
    }
  };

  const handleTurnOffComments = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/posts/${postId}/toggle-comments`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(post?.commentsDisabled ? "Comments enabled" : "Comments disabled");
      setPost(prev => ({
        ...prev,
        commentsDisabled: !prev.commentsDisabled
      }));
      setShowPostMenu(false);
    } catch (error) {
      console.error("Error toggling comments:", error);
      alert("Failed to toggle comments");
    }
  };


  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/post/${postId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post!',
          text: post?.caption || 'Check out this post on LuvHive',
          url: shareUrl
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard!");
      } catch (error) {
        alert("Failed to copy link");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Post not found</p>
          <button
            onClick={() => navigate(-1)}
            className="text-pink-600 hover:text-pink-700 font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header with Back Button */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Post</h1>
          </div>
          
          {/* 3-Dot Menu for Post */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPostMenu(!showPostMenu);
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreVertical className="w-6 h-6" />
            </button>
            
            {showPostMenu && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border z-20"
                onClick={(e) => e.stopPropagation()}
              >
                {post?.userId === user?.id ? (
                  // Own post options
                  <>
                    <button
                      onClick={handleEditCaption}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <Edit className="w-5 h-5" />
                      Edit caption
                    </button>
                    <button
                      onClick={handleHideLikes}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <Heart className="w-5 h-5" />
                      {post?.likesHidden ? "Show like count" : "Hide like count"}
                    </button>
                    <button
                      onClick={handleArchivePost}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <Archive className="w-5 h-5" />
                      Archive
                    </button>
                    <button
                      onClick={handleTurnOffComments}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <MessageCircle className="w-5 h-5" />
                      {post?.commentsDisabled ? "Turn on comments" : "Turn off comments"}
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <LinkIcon className="w-5 h-5" />
                      Copy link
                    </button>
                    <button
                      onClick={handleDeletePost}
                      className="w-full px-4 py-3 text-left text-red-600 hover:bg-gray-50 flex items-center gap-3"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete
                    </button>
                  </>
                ) : (
                  // Others' post options
                  <>
                    <button
                      onClick={handleSavePost}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <Bookmark className={`w-5 h-5 ${post?.isSaved ? 'fill-current' : ''}`} />
                      {post?.isSaved ? "Unsave" : "Save"}
                    </button>
                    <button
                      onClick={handleReportPost}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <Flag className="w-5 h-5" />
                      Report
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <LinkIcon className="w-5 h-5" />
                      Copy link
                    </button>
                    <button
                      onClick={() => handleBlockUser(post?.userId, post?.username)}
                      className="w-full px-4 py-3 text-left text-red-600 hover:bg-gray-50 flex items-center gap-3"
                    >
                      <Ban className="w-5 h-5" />
                      Block {post?.username}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="md:flex">
            {/* Post Image */}
            <div className="md:w-3/5 bg-black flex items-center justify-center">
              {post.imageUrl || post.mediaUrl ? (
                <img
                  src={post.imageUrl || post.mediaUrl}
                  alt={post.caption || "Post"}
                  className="w-full object-contain max-h-[80vh]"
                />
              ) : (
                <div className="w-full h-96 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                  <ImageIcon className="w-20 h-20 text-pink-300" />
                </div>
              )}
            </div>

            {/* Post Details */}
            <div className="md:w-2/5 flex flex-col max-h-[80vh]">
              {/* User Info */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  {post.userProfileImage ? (
                    <img
                      src={post.userProfileImage || "https://via.placeholder.com/40"}
                      alt={post.username}
                      className="w-10 h-10 rounded-full object-cover cursor-pointer"
                      onClick={() => navigate(`/profile/${post.userId}`)}
                      onError={(e) => e.target.src = "https://via.placeholder.com/40"}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-pink-200 flex items-center justify-center text-pink-600 font-semibold">
                      {post.username?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <span 
                    className="font-semibold text-gray-800 cursor-pointer hover:text-pink-600"
                    onClick={() => navigate(`/profile/${post.userId}`)}
                  >
                    {post.username}
                  </span>
                </div>
              </div>

              {/* Caption and Comments */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Caption */}
                {post.caption && (
                  <div className="flex gap-3 mb-6">
                    {post.userProfileImage ? (
                      <img
                        src={post.userProfileImage || "https://via.placeholder.com/40"}
                        alt={post.username}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => e.target.src = "https://via.placeholder.com/32"}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-pink-200 flex items-center justify-center text-pink-600 font-semibold text-sm">
                        {post.username?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold mr-2">{post.username}</span>
                      <span className="text-gray-800">{post.caption}</span>
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-4">
                  {comments.filter(c => !c.parentCommentId).map((comment) => {
                    const commentLikes = comment.likes || [];
                    const userLiked = commentLikes.includes(user?.id);
                    const replies = comments.filter(c => c.parentCommentId === comment.id);
                    
                    return (
                      <div key={comment.id}>
                        {/* Main Comment */}
                        <div className="flex gap-3">
                          {comment.userProfileImage ? (
                            <img
                              src={comment.userProfileImage || "https://via.placeholder.com/32"}
                              alt={comment.username}
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => e.target.src = "https://via.placeholder.com/32"}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-pink-200 flex items-center justify-center text-pink-600 font-semibold text-sm">
                              {comment.username?.[0]?.toUpperCase() || "U"}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <span className="font-semibold mr-2">{comment.username}</span>
                                <span className="text-gray-800">{comment.text}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleLikeComment(comment.id)}
                                  className="ml-2"
                                >
                                  <Heart 
                                    className={`w-4 h-4 ${userLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                                  />
                                </button>
                                
                                {/* 3-dot menu */}
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowMenuFor(showMenuFor === comment.id ? null : comment.id);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded-full"
                                  >
                                    <MoreVertical className="w-4 h-4 text-gray-500" />
                                  </button>
                                  
                                  {showMenuFor === comment.id && (
                                    <div 
                                      className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {comment.userId === user?.id ? (
                                        // Own comment - show delete
                                        <button
                                          onClick={() => handleDeleteComment(comment.id)}
                                          className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          Delete
                                        </button>
                                      ) : (
                                        // Others' comments - show report and block
                                        <>
                                          <button
                                            onClick={() => handleReportComment(comment.id, comment.userId)}
                                            className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                          >
                                            <Flag className="w-4 h-4" />
                                            Report
                                          </button>
                                          <button
                                            onClick={() => handleBlockUser(comment.userId, comment.username)}
                                            className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-50 flex items-center gap-2"
                                          >
                                            <Ban className="w-4 h-4" />
                                            Block User
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Now'}</span>
                              {comment.likesCount > 0 && (
                                <span className="font-semibold">{comment.likesCount} likes</span>
                              )}
                              <button 
                                onClick={() => setReplyingTo(comment.id)}
                                className="font-semibold hover:text-gray-700"
                              >
                                Reply
                              </button>
                            </div>
                            
                            {/* Reply Input */}
                            {replyingTo === comment.id && (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder={`Reply to ${comment.username}...`}
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleReply(comment.id)}
                                  className="flex-1 text-sm border-b border-gray-300 outline-none py-1"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleReply(comment.id)}
                                  className="text-pink-600 text-sm font-semibold"
                                >
                                  Post
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText("");
                                  }}
                                  className="text-gray-500 text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Replies */}
                        {replies.length > 0 && (
                          <div className="ml-11 mt-3 space-y-3">
                            {replies.map((reply) => {
                              const replyLikes = reply.likes || [];
                              const userLikedReply = replyLikes.includes(user?.id);
                              
                              return (
                                <div key={reply.id} className="flex gap-3">
                                  {reply.userProfileImage ? (
                                    <img
                                      src={reply.userProfileImage || "https://via.placeholder.com/32"}
                                      alt={reply.username}
                                      className="w-7 h-7 rounded-full object-cover"
                                      onError={(e) => e.target.src = "https://via.placeholder.com/28"}
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-pink-200 flex items-center justify-center text-pink-600 font-semibold text-xs">
                                      {reply.username?.[0]?.toUpperCase() || "U"}
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <span className="font-semibold mr-2 text-sm">{reply.username}</span>
                                        <span className="text-gray-800 text-sm">{reply.text}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={() => handleLikeComment(reply.id)}
                                          className="ml-2"
                                        >
                                          <Heart 
                                            className={`w-3 h-3 ${userLikedReply ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                                          />
                                        </button>
                                        
                                        {/* 3-dot menu for replies */}
                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setShowMenuFor(showMenuFor === reply.id ? null : reply.id);
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded-full"
                                          >
                                            <MoreVertical className="w-3 h-3 text-gray-500" />
                                          </button>
                                          
                                          {showMenuFor === reply.id && (
                                            <div 
                                              className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {reply.userId === user?.id ? (
                                                <button
                                                  onClick={() => handleDeleteComment(reply.id)}
                                                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-50 flex items-center gap-2 text-sm"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                  Delete
                                                </button>
                                              ) : (
                                                <>
                                                  <button
                                                    onClick={() => handleReportComment(reply.id, reply.userId)}
                                                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-sm"
                                                  >
                                                    <Flag className="w-3 h-3" />
                                                    Report
                                                  </button>
                                                  <button
                                                    onClick={() => handleBlockUser(reply.userId, reply.username)}
                                                    className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-50 flex items-center gap-2 text-sm"
                                                  >
                                                    <Ban className="w-3 h-3" />
                                                    Block User
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                      <span>{reply.createdAt ? new Date(reply.createdAt).toLocaleDateString() : 'Now'}</span>
                                      {reply.likesCount > 0 && (
                                        <span className="font-semibold">{reply.likesCount} likes</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t">
                <div className="flex items-center gap-4 mb-3">
                  <button 
                    onClick={handleLike}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Heart className={`w-7 h-7 ${post.userLiked ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                  <button className="hover:opacity-70 transition-opacity">
                    <MessageCircle className="w-7 h-7" />
                  </button>
                  <button 
                    onClick={handleShare}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Send className="w-7 h-7" />
                  </button>
                </div>
                <p className="font-semibold text-sm mb-1">{post.likesCount || 0} likes</p>
                <p className="text-gray-500 text-xs mb-3">
                  {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Recently'}
                </p>

                {/* Add Comment Input */}
                <div className="flex items-center gap-2 border-t pt-3">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    className="flex-1 outline-none text-sm"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className={`text-sm font-semibold ${newComment.trim() ? 'text-pink-600 hover:text-pink-700' : 'text-gray-300'}`}
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowReportModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Report Post</h2>
            <p className="text-gray-600 mb-4">Why are you reporting this post?</p>
            
            <div className="space-y-2 mb-4">
              {["Spam", "Inappropriate content", "Harassment", "False information", "Violence", "Hate speech", "Other"].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={`w-full px-4 py-3 text-left rounded-lg border transition-colors ${
                    reportReason === reason 
                      ? 'border-pink-600 bg-pink-50 text-pink-600' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                disabled={!reportReason}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  reportReason 
                    ? 'bg-pink-600 text-white hover:bg-pink-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Caption Modal */}
      {showEditModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Edit Caption</h2>
            
            <textarea
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              placeholder="Write a caption..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none outline-none focus:border-pink-600"
              maxLength={2200}
            />
            <p className="text-xs text-gray-500 mt-1">{editedCaption.length}/2,200</p>
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditedCaption("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitEditCaption}
                className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostDetailPage;
