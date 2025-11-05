import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { httpClient } from '../utils/authClient';
import { ArrowLeft, MessageCircle, Search, Check, X, ChevronDown, Pin, Trash2, BellOff, PhoneOff } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../components/ui/context-menu';

const MessagesPage = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('messages'); // 'messages' or 'requests'
  const [expandedRequestId, setExpandedRequestId] = useState(null); // Track expanded request

  useEffect(() => {
    fetchConversations();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await httpClient.get('/messages/conversations');
      setConversations(response.data.conversations || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
    }
  };

  // Separate conversations into messages and requests
  const regularMessages = conversations.filter(conv => !conv.isRequest);
  const requestMessages = conversations.filter(conv => conv.isRequest);

  const activeConversations = activeTab === 'messages' ? regularMessages : requestMessages;
  
  const filteredConversations = activeConversations.filter(conv =>
    conv.otherUser.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherUser.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAcceptRequest = async (conversationId, e) => {
    e.stopPropagation(); // Prevent navigation
    try {
      await httpClient.post('/messages/request/accept', { conversationId });
      // Refresh conversations to move from requests to messages
      await fetchConversations();
      alert('Request accepted!');
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request');
    }
  };

  const handleDeclineRequest = async (conversationId, e) => {
    e.stopPropagation(); // Prevent navigation
    if (!window.confirm('Delete this conversation?')) return;
    
    try {
      await httpClient.post('/messages/request/decline', { conversationId });
      // Remove from local state immediately
      setConversations(prev => prev.filter(c => c.conversationId !== conversationId));
      alert('Request declined');
    } catch (error) {
      console.error('Error declining request:', error);
      alert('Failed to decline request');
    }
  };

  const handleConversationAction = async (conversationId, action) => {
    try {
      // Optimistic update
      setConversations(prev => prev.map(conv => {
        if (conv.conversationId !== conversationId) return conv;
        
        switch (action) {
          case 'pin':
          case 'unpin':
            return { ...conv, isPinned: action === 'pin' };
          case 'mute_messages':
          case 'unmute_messages':
            return { ...conv, messagesMuted: action === 'mute_messages' };
          case 'mute_calls':
          case 'unmute_calls':
            return { ...conv, callsMuted: action === 'mute_calls' };
          default:
            return conv;
        }
      }));

      // Make API call
      const response = await httpClient.post('/messages/conversation/action', {
        conversationId,
        action
      });

      // If delete action, remove from list
      if (action === 'delete') {
        setConversations(prev => prev.filter(c => c.conversationId !== conversationId));
      }

      // Re-fetch to get latest state and proper sorting
      await fetchConversations();
    } catch (error) {
      console.error('Error performing conversation action:', error);
      // Revert optimistic update on error
      await fetchConversations();
      alert('Failed to perform action');
    }
  };

  const handlePin = (conversationId, isPinned) => {
    handleConversationAction(conversationId, isPinned ? 'unpin' : 'pin');
  };

  const handleDelete = (conversationId) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      handleConversationAction(conversationId, 'delete');
    }
  };

  const handleMuteMessages = (conversationId, messagesMuted) => {
    handleConversationAction(conversationId, messagesMuted ? 'unmute_messages' : 'mute_messages');
  };

  const handleMuteCalls = (conversationId, callsMuted) => {
    handleConversationAction(conversationId, callsMuted ? 'unmute_calls' : 'mute_calls');
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    // Timestamp is in UTC, convert to milliseconds for comparison
    const date = new Date(timestamp);
    const now = new Date();
    
    // Calculate difference directly (both are Date objects)
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-white border-b border-pink-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="hover:bg-pink-50 p-2 rounded-full transition"
              >
                <ArrowLeft className="w-5 h-5 text-pink-600" />
              </button>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
                Messages
              </h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-pink-200 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        </div>
      </div>

      {/* Tabs: Messages & Requests */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex border-b border-pink-200">
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-3 text-center font-semibold transition-colors ${
              activeTab === 'messages'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-gray-500 hover:text-pink-500'
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 text-center font-semibold transition-colors ${
              activeTab === 'requests'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-gray-500 hover:text-pink-500'
            }`}
          >
            Requests {requestMessages.length > 0 && `(${requestMessages.length})`}
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {searchQuery ? 'No conversations found' : activeTab === 'requests' ? 'No requests' : 'No messages yet'}
            </h3>
            <p className="text-gray-500">
              {searchQuery 
                ? 'Try searching with a different name' 
                : 'Start a conversation by visiting someone\'s profile'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.conversationId}
                className="block bg-white rounded-lg p-4 border border-pink-100"
              >
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:bg-pink-50 -m-4 p-4 rounded-lg transition"
                  onClick={() => {
                    if (activeTab === 'messages') {
                      navigate(`/chat/${conversation.otherUser.id}`);
                    } else {
                      // In requests tab, open chat page with request state
                      navigate(`/chat/${conversation.otherUser.id}`, { 
                        state: { 
                          isRequest: true,
                          conversationId: conversation.conversationId 
                        } 
                      });
                    }
                  }}
                >
                  {/* Profile Image */}
                  <img
                    src={
                      conversation.otherUser.profileImage
                        ? conversation.otherUser.profileImage.startsWith('http') ||
                          conversation.otherUser.profileImage.startsWith('data:')
                          ? conversation.otherUser.profileImage
                          : conversation.otherUser.profileImage
                        : 'https://via.placeholder.com/48'
                    }
                    alt={conversation.otherUser.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />

                  {/* Message Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {conversation.otherUser.fullName}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                        {conversation.lastMessage}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="ml-2 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
