import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { httpClient, getUser } from '../utils/authClient';
import { ArrowLeft, Send, Image as ImageIcon, Smile } from 'lucide-react';

const ChatPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const currentUser = getUser();

  useEffect(() => {
    fetchMessages();
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const response = await httpClient.get(`/messages/conversation/${userId}`);
      setMessages(response.data.messages || []);
      setOtherUser(response.data.otherUser);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await httpClient.post('/messages/send', {
        receiverId: userId,
        content: newMessage.trim(),
        type: 'text'
      });
      
      setNewMessage('');
      // Fetch messages immediately to show the new message
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const groupMessagesByDate = (messages) => {
    const groups = {};
    
    messages.forEach(msg => {
      const date = new Date(msg.createdAt);
      const dateKey = date.toDateString();
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    
    return groups;
  };

  const getDateLabel = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-white border-b border-pink-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="hover:bg-pink-50 p-2 rounded-full transition"
            >
              <ArrowLeft className="w-5 h-5 text-pink-600" />
            </button>
            
            {otherUser && (
              <>
                <img
                  src={
                    otherUser.profileImage
                      ? otherUser.profileImage.startsWith('http') ||
                        otherUser.profileImage.startsWith('data:')
                        ? otherUser.profileImage
                        : otherUser.profileImage
                      : 'https://via.placeholder.com/40'
                  }
                  alt={otherUser.username}
                  className="w-10 h-10 rounded-full object-cover cursor-pointer"
                  onClick={() => navigate(`/profile/${otherUser.id}`)}
                />
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => navigate(`/profile/${otherUser.id}`)}
                >
                  <h2 className="font-semibold text-gray-900">{otherUser.fullName}</h2>
                  <p className="text-xs text-gray-500">@{otherUser.username}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="inline-block w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center mb-4">
              <Send className="w-10 h-10 text-pink-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
            <p className="text-gray-500">Send a message to start the conversation</p>
          </div>
        ) : (
          Object.keys(messageGroups).map((dateKey) => (
            <div key={dateKey}>
              {/* Date Separator */}
              <div className="flex justify-center my-4">
                <span className="bg-white px-3 py-1 rounded-full text-xs text-gray-500 border border-pink-100">
                  {getDateLabel(dateKey)}
                </span>
              </div>
              
              {/* Messages */}
              {messageGroups[dateKey].map((message) => (
                <div
                  key={message.id}
                  className={`flex mb-4 ${message.isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                      message.isMine
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                        : 'bg-white border border-pink-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm break-words">{message.content}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1`}>
                      <span
                        className={`text-xs ${
                          message.isMine ? 'text-pink-100' : 'text-gray-400'
                        }`}
                      >
                        {formatTimestamp(message.createdAt)}
                      </span>
                      {message.isMine && (
                        <span className="text-xs text-pink-100">
                          {message.status?.read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-pink-100 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <button
              type="button"
              className="hover:bg-pink-50 p-2 rounded-full transition"
              disabled
            >
              <Smile className="w-5 h-5 text-gray-400" />
            </button>
            
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-pink-200 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500"
              disabled={sending}
            />
            
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className={`p-2 rounded-full transition ${
                newMessage.trim() && !sending
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
