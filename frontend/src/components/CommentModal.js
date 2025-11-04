import React, { useState, useEffect } from 'react';
import { X, Heart, Send, MoreVertical } from 'lucide-react';
import { httpClient } from '../utils/authClient';

const CommentModal = ({ post, user, isOpen, onClose, onCommentAdded }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && post) {
      fetchComments();
    }
  }, [isOpen, post]);

  const fetchComments = async () => {
    try {
      const response = await httpClient.get(`/posts/${post.id}/comments?userId=${user.id}`);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('postId', post.id);
      formData.append('userId', user.id);
      formData.append('content', newComment);
      formData.append('isAnonymous', false);
      
      if (replyingTo) {
        formData.append('parentCommentId', replyingTo.id);
      }

      await httpClient.post(`/posts/${post.id}/comment`, formData);

      setNewComment('');
      setReplyingTo(null);
      fetchComments();
      if (onCommentAdded) onCommentAdded();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const formData = new FormData();
      formData.append('userId', user.id);
      
      await httpClient.post(`/social/comments/${commentId}/like`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        }
      });
      fetchComments();
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleUsernameClick = async (userId, username) => {
    // Direct navigation; Profile page handles privacy
    window.location.href = `/profile/${userId}`;
  };

  const renderComment = (comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-12 mt-2' : 'mt-4'}`}>
      <div className="flex gap-3 items-start">
        {/* Profile Image */}
        <img
          src={
            comment.userAvatar
              ? (comment.userAvatar.startsWith('data:') || comment.userAvatar.startsWith('http')
                  ? comment.userAvatar
                  : `${comment.userAvatar}`)
              : "https://via.placeholder.com/32"
          }
          alt={comment.username}
          className="w-8 h-8 rounded-full object-cover cursor-pointer flex-shrink-0"
          onClick={() => handleUsernameClick(comment.userId, comment.username)}
          onError={(e) => e.target.src = "https://via.placeholder.com/32"}
        />

        <div className="flex-1 min-w-0">
          {/* Username and Comment */}
          <div className="bg-gray-100 rounded-2xl px-4 py-2">
            <p
              className="font-semibold text-sm cursor-pointer hover:text-pink-600 inline"
              onClick={() => handleUsernameClick(comment.userId, comment.username)}
            >
              {comment.username}
            </p>
            <p className="text-sm text-gray-800 mt-1">{comment.content}</p>
          </div>

          {/* Comment Actions - Time and Reply */}
          <div className="flex items-center gap-4 mt-1 px-2 text-xs text-gray-500">
            <span>{comment.timeAgo || 'Just now'}</span>
            <button
              onClick={() => setReplyingTo(comment)}
              className="font-semibold hover:text-gray-700"
            >
              Reply
            </button>
          </div>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>

        {/* Heart Icon on Right Side */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            onClick={() => handleLikeComment(comment.id)}
            className="focus:outline-none"
          >
            <Heart
              className={`w-4 h-4 ${comment.userLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
            />
          </button>
          {comment.likesCount > 0 && (
            <span className="text-xs text-gray-600">{comment.likesCount}</span>
          )}
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Comments</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map(comment => renderComment(comment))
          )}
        </div>

        {/* Add Comment Input */}
        <div className="border-t p-4">
          {replyingTo && (
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
              <span>Replying to <strong>{replyingTo.username}</strong></span>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-pink-600 hover:text-pink-700"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <img
              src={
                user?.profileImage
                  ? (user.profileImage.startsWith('data:') || user.profileImage.startsWith('http')
                      ? user.profileImage
                      : `${user.profileImage}`)
                  : "https://via.placeholder.com/32"
              }
              alt="Your profile"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => e.target.src = "https://via.placeholder.com/32"}
            />
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Add a comment..."}
              className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
              disabled={loading}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || loading}
              className="p-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentModal;
