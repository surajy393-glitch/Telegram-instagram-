import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { httpClient, getUser } from '../utils/authClient';
import { ArrowLeft, Send, Image as ImageIcon, Smile, Check, X, Phone, Video } from 'lucide-react';
import VideoCallModal from '../components/VideoCallModal';
import IncomingCallModal from '../components/IncomingCallModal';

const ChatPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRequest, setIsRequest] = useState(location.state?.isRequest || false);
  const [conversationId, setConversationId] = useState(location.state?.conversationId || null);
  const messagesEndRef = useRef(null);
  const prevMessageCount = useRef(0);
  const currentUser = getUser();

  // Video call state
  const [isCallActive, setIsCallActive] = useState(false);
  const [callRoomUrl, setCallRoomUrl] = useState(null);
  const [callMeetingId, setCallMeetingId] = useState(null);
  
  // Incoming call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false);

  useEffect(() => {
    fetchMessages();
    
    // Poll for new messages every 3 seconds
    const messageInterval = setInterval(fetchMessages, 3000);
    
    return () => {
      clearInterval(messageInterval);
    };
  }, [userId]);

  useEffect(() => {
    // Only scroll if new messages were added
    if (messages.length > prevMessageCount.current) {
      scrollToBottom();
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const response = await httpClient.get(`/messages/conversation/${userId}`);
      const fetchedMessages = response.data.messages || [];
      setMessages(fetchedMessages);
      setOtherUser(response.data.otherUser);
      
      // Get conversation ID from response
      if (response.data.conversationId) {
        setConversationId(response.data.conversationId);
      }
      
      // Check for incoming call notifications from the other user
      console.log('🔍 Checking for call notifications...');
      console.log('  Total messages:', fetchedMessages.length);
      console.log('  Current user ID:', currentUser?.id);
      console.log('  Other user ID (userId):', userId);
      
      const callNotifications = fetchedMessages.filter(msg => msg.type === 'call_notification');
      console.log('  Call notification messages:', callNotifications.length, callNotifications);
      
      const unreadCallNotifications = callNotifications.filter(msg => !msg.status?.read);
      console.log('  Unread call notifications:', unreadCallNotifications.length);
      
      const incomingCallNotifications = unreadCallNotifications.filter(msg => msg.sender_id === userId);
      console.log('  Incoming call notifications (from other user):', incomingCallNotifications.length);
      
      const latestCallNotification = incomingCallNotifications
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      
      console.log('  Latest call notification:', latestCallNotification);
      
      if (latestCallNotification && latestCallNotification.metadata) {
        console.log('✅ Incoming call detected! Setting up modal...');
        console.log('  Metadata:', latestCallNotification.metadata);
        setIncomingCall({
          messageId: latestCallNotification._id,
          callType: latestCallNotification.metadata.callType,
          roomUrl: latestCallNotification.metadata.roomUrl,
          meetingId: latestCallNotification.metadata.meetingId,
          caller: response.data.otherUser
        });
        setShowIncomingCallModal(true);
        console.log('  IncomingCallModal should now be visible!');
      } else {
        console.log('❌ No incoming call notifications found');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  };

  const startVideoCall = async () => {
    try {
      console.log('Starting video call with user:', userId);
      
      const response = await httpClient.post('/whereby/create-room', {
        participantUserId: userId,
        callType: 'video'
      });

      console.log('Room created:', response.data);
      
      // Call initiator uses hostRoomUrl for host privileges, receiver gets roomUrl
      setCallRoomUrl(response.data.hostRoomUrl || response.data.roomUrl);
      setCallMeetingId(response.data.meetingId);
      setIsCallActive(true);

      // Send a message to notify the other user (they get regular roomUrl)
      try {
        await httpClient.post('/messages/send', {
          receiverId: userId,
          content: `📹 Video Call`,
          type: 'call_notification',
          metadata: {
            callType: 'video',
            roomUrl: response.data.roomUrl, // Receiver gets regular roomUrl
            meetingId: response.data.meetingId
          }
        });
        console.log('✅ Call notification sent to user');
      } catch (notifError) {
        console.error('Failed to send call notification:', notifError);
      }

    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start video call. Please try again.');
    }
  };

  const startVoiceCall = async () => {
    try {
      console.log('Starting voice call with user:', userId);
      
      const response = await httpClient.post('/whereby/create-room', {
        participantUserId: userId,
        callType: 'audio'
      });

      console.log('Room created:', response.data);
      
      setCallRoomUrl(response.data.roomUrl);
      setCallMeetingId(response.data.meetingId);
      setIsCallActive(true);

      // Send a message to notify the other user
      try {
        await httpClient.post('/messages/send', {
          receiverId: userId,
          content: `📞 Voice Call: ${response.data.roomUrl}`,
          type: 'call_notification',
          metadata: {
            callType: 'audio',
            roomUrl: response.data.roomUrl,
            meetingId: response.data.meetingId
          }
        });
        console.log('✅ Call notification sent to user');
      } catch (notifError) {
        console.error('Failed to send call notification:', notifError);
      }

    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start voice call. Please try again.');
    }
  };

  const handleCallEnd = () => {
    setIsCallActive(false);
    setCallRoomUrl(null);
    setCallMeetingId(null);
  };

  const handleAcceptIncomingCall = async () => {
    if (incomingCall) {
      console.log('✅ Accepting incoming call');
      
      // Mark the notification message as read
      try {
        if (conversationId) {
          await httpClient.post('/messages/mark-read', { conversationId });
        }
      } catch (error) {
        console.error('Error marking call notification as read:', error);
      }
      
      // Join the call
      setCallRoomUrl(incomingCall.roomUrl);
      setCallMeetingId(incomingCall.meetingId);
      setIsCallActive(true);
      setShowIncomingCallModal(false);
      setIncomingCall(null);
    }
  };

  const handleRejectIncomingCall = async () => {
    console.log('❌ Rejecting incoming call');
    
    // Mark the notification message as read
    try {
      if (conversationId) {
        await httpClient.post('/messages/mark-read', { conversationId });
      }
    } catch (error) {
      console.error('Error marking call notification as read:', error);
    }
    
    setShowIncomingCallModal(false);
    setIncomingCall(null);
  };

  const handleAcceptRequest = async () => {
    try {
      await httpClient.post('/messages/request/accept', { conversationId });
      setIsRequest(false); // Change to regular chat instantly
      alert('Request accepted! You can now chat.');
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request');
    }
  };

  const handleDeclineRequest = async () => {
    if (!window.confirm('Delete this conversation?')) return;
    
    try {
      await httpClient.post('/messages/request/decline', { conversationId });
      navigate('/messages'); // Go back to messages list
    } catch (error) {
      console.error('Error declining request:', error);
      alert('Failed to delete request');
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
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset
    
    // Filter out call_notification messages - they should only trigger IncomingCallModal, not appear in chat
    const chatMessages = messages.filter(msg => msg.type !== 'call_notification');
    
    chatMessages.forEach(msg => {
      const date = new Date(msg.createdAt);
      const istDate = new Date(date.getTime() + istOffset);
      const dateKey = istDate.toDateString();
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    
    return groups;
  };

  const getDateLabel = (dateString) => {
    const date = new Date(dateString);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const today = new Date();
    const istToday = new Date(today.getTime() + istOffset);
    const yesterday = new Date(istToday);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === istToday.toDateString()) {
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

                {/* Call Buttons */}
                {!isRequest && (
                  <div className="flex items-center gap-2">
                    {/* Voice Call Button */}
                    <button
                      onClick={startVoiceCall}
                      className="p-2 rounded-full hover:bg-pink-50 text-pink-600 hover:text-pink-700 transition"
                      title="Voice Call"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    
                    {/* Video Call Button */}
                    <button
                      onClick={startVideoCall}
                      className="p-2 rounded-full hover:bg-pink-50 text-pink-600 hover:text-pink-700 transition"
                      title="Video Call"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                  </div>
                )}
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
          <>
            {/* Messages by Date */}
            {Object.keys(messageGroups).map((dateKey) => (
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
                    className={`flex flex-col mb-4 ${message.isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        message.isMine
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                          : 'bg-white border border-pink-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm break-words">
                        {message.content && typeof message.content === 'string' 
                          ? message.content 
                          : '[Empty message]'}
                      </p>
                      <div className={`flex items-center justify-end gap-1 mt-1`}>
                        <span
                          className={`text-xs ${
                            message.isMine ? 'text-pink-100' : 'text-gray-400'
                          }`}
                        >
                          {formatTimestamp(message.createdAt)}
                        </span>
                      </div>
                    </div>
                    {/* Instagram-style "Seen" status */}
                    {message.isMine && message.status?.read && message.readAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Seen {formatTimestamp(message.readAt)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </>
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
            
            {/* Conditional Input: Show Accept/Delete for requests, regular input for messages */}
            {isRequest ? (
              // Request Actions - Replace input with buttons
              <div className="flex-1 flex gap-3">
                <button
                  onClick={handleDeclineRequest}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold"
                >
                  <X className="w-5 h-5" />
                  Delete
                </button>
                <button
                  onClick={handleAcceptRequest}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all font-semibold"
                >
                  <Check className="w-5 h-5" />
                  Accept & Chat
                </button>
              </div>
            ) : (
              // Regular message input
              <>
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
              </>
            )}
          </form>
        </div>
      </div>

      {/* Incoming Call Modal */}
      <IncomingCallModal
        isOpen={showIncomingCallModal}
        callType={incomingCall?.callType}
        callerUser={incomingCall?.caller}
        onAccept={handleAcceptIncomingCall}
        onReject={handleRejectIncomingCall}
      />

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={isCallActive}
        roomUrl={callRoomUrl}
        onClose={handleCallEnd}
        otherUser={otherUser}
        meetingId={callMeetingId}
      />
    </div>
  );
};

export default ChatPage;
