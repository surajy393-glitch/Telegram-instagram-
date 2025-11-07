import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { httpClient, getUser } from '../utils/authClient';
import { ArrowLeft, Send, Image as ImageIcon, Smile, Check, X } from 'lucide-react';

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

  // Call state management
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callType, setCallType] = useState('video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [callStartTime, setCallStartTime] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  
  // WebSocket reference for call signaling
  const wsRef = useRef(null);
  const sseRef = useRef(null);
  const permissionRequested = useRef(false);

  // WebSocket Signaling Connection (with SSE fallback)
  useEffect(() => {
    if (!currentUser?.id) return;
    
    // Get backend URL
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '/api';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}${backendUrl}/ws/signaling/${currentUser.id}`;
    
    console.log('🔌 Attempting WebSocket signaling:', wsUrl);
    
    let wsConnected = false;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('✅ WebSocket signaling connected');
        wsConnected = true;
      };
      
      ws.onmessage = (event) => {
        try {
          const signal = JSON.parse(event.data);
          console.log('📨 Received signaling message:', signal);
          handleSignalReceived(signal);
        } catch (error) {
          console.error('❌ WebSocket message parse error:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket signaling error:', error);
        // Fallback to SSE if WebSocket fails
        if (!wsConnected && !sseRef.current) {
          console.log('🔄 Falling back to SSE for notifications...');
          setupSSE();
        }
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket signaling disconnected');
      };
      
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      // Fallback to SSE
      setupSSE();
    }
    
    // SSE Fallback Setup
    function setupSSE() {
      const sseUrl = `${backendUrl}/calls/events/${currentUser.id}`;
      console.log('📡 Connecting to SSE:', sseUrl);
      
      const eventSource = new EventSource(sseUrl);
      sseRef.current = eventSource;
      
      eventSource.onopen = () => {
        console.log('✅ SSE connection established');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const signal = JSON.parse(event.data);
          console.log('📨 Received SSE event:', signal);
          handleSignalReceived(signal);
        } catch (error) {
          console.error('❌ SSE message parse error:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
      };
    }
    
    // Common signal handler for both WebSocket and SSE
    function handleSignalReceived(signal) {
      // Handle incoming call signal
      if (signal.type === 'incoming_call') {
        console.log('📞 Incoming call from:', signal.fromUserId);
        setIncomingCall({
          callType: signal.callType || 'video',
          callerUser: {
            id: signal.fromUserId,
            fullName: signal.data?.callerName || 'Unknown User',
            username: signal.data?.callerUsername || 'unknown',
            profileImage: signal.data?.callerImage
          }
        });
      }
      
      // Handle call ended signal
      if (signal.type === 'call_ended') {
        console.log('📵 Call ended signal received');
        handleCallEnd();
      }
      
      // Handle call accepted signal
      if (signal.type === 'call_accepted') {
        console.log('✅ Call accepted by remote user');
      }
      
      // Handle call rejected signal
      if (signal.type === 'call_rejected') {
        console.log('❌ Call rejected by remote user');
        handleCallEnd();
      }
    }
    
    return () => {
      if (wsRef.current) {
        console.log('🔌 Closing WebSocket signaling');
        wsRef.current.close();
      }
      if (sseRef.current) {
        console.log('📡 Closing SSE connection');
        sseRef.current.close();
      }
    };
  }, [currentUser?.id]);

  useEffect(() => {
    fetchMessages();
    fetchCallHistory();
    
    // Poll for new messages every 3 seconds
    const messageInterval = setInterval(fetchMessages, 3000);
    
    // Poll for incoming calls every 2 seconds
    const callInterval = setInterval(checkForIncomingCalls, 2000);
    
    return () => {
      clearInterval(messageInterval);
      clearInterval(callInterval);
      // Cleanup call if active
      if (currentCall) {
        currentCall.endCall();
      }
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
      setMessages(response.data.messages || []);
      setOtherUser(response.data.otherUser);
      
      // Get conversation ID from response
      if (response.data.conversationId) {
        setConversationId(response.data.conversationId);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  };

  const fetchCallHistory = async () => {
    try {
      const response = await httpClient.get(`/calls/history/${userId}`);
      setCallHistory(response.data.calls || []);
    } catch (error) {
      console.error('Error fetching call history:', error);
    }
  };

  const checkForIncomingCalls = async () => {
    // Mock incoming call check - in real implementation this would check for actual incoming calls
    // For demo purposes, we'll skip this to avoid constant notifications
    // In production, this would check a real-time notification system
  };

  const logCall = async (callData) => {
    try {
      // Generate unique callId
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await httpClient.post('/calls/log', {
        callId: callId,
        callerId: currentUser.id,
        receiverId: userId,
        callType: callData.callType,
        status: callData.status,
        duration: callData.duration || 0,
        startedAt: callData.startedAt,
        endedAt: callData.endedAt
      });
      
      console.log('✅ Call logged successfully:', callId);
      
      // Refresh call history
      await fetchCallHistory();
    } catch (error) {
      console.error('Error logging call:', error);
    }
  };

  const startCall = async (type = 'video') => {
    try {
      setCallType(type);
      setIsCallActive(true);
      setCallStartTime(new Date()); // Track actual call start time
      
      console.log('🎥 startCall - currentUser:', currentUser);
      console.log('🎥 startCall - currentUser.id:', currentUser?.id);
      
      // Make sure a user is logged in before starting a call.
      if (!currentUser || !currentUser.id) {
        console.error('❌ No valid currentUser or currentUser.id');
        throw new Error('Current user ID is not available. Please sign in again.');
      }
      
      // Send incoming call signal via WebSocket OR HTTP POST
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const callSignal = {
            type: 'incoming_call',
            targetUserId: userId,
            fromUserId: currentUser.id,
            callType: type,
            data: {
              callerName: currentUser.fullName || currentUser.username,
              callerUsername: currentUser.username,
              callerImage: currentUser.profileImage
            }
          };
          wsRef.current.send(JSON.stringify(callSignal));
          console.log('📤 Sent incoming call signal via WebSocket to:', userId);
        } else {
          // Fallback to HTTP POST if WebSocket not available
          console.log('📤 Sending incoming call signal via HTTP POST to:', userId);
          await httpClient.post('/calls/signal', {
            targetUserId: userId,
            type: 'incoming_call',
            callType: type,
            data: {
              callerName: currentUser.fullName || currentUser.username,
              callerUsername: currentUser.username,
              callerImage: currentUser.profileImage
            }
          });
          console.log('✅ Signal sent successfully via HTTP');
        }
      } catch (signalError) {
        console.error('⚠️ Failed to send call signal:', signalError);
        // Continue with call even if signal fails
      }
      
      // TODO: Implement Whereby video calling
      console.log('🎥 Starting call with userId:', currentUser.id, 'remoteUserId:', userId);
      
      // Placeholder for Whereby implementation
      alert('Video calling feature is being migrated to Whereby. Coming soon!');
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Please check your camera/microphone permissions.');
      handleCallEnd();
    }
  };

  const handleCallEnd = async () => {
    try {
      const callEndTime = new Date();
      
      // Send call ended signal (WebSocket or HTTP fallback)
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'call_ended',
            targetUserId: userId,
            fromUserId: currentUser?.id
          }));
          console.log('📤 Sent call ended signal via WebSocket');
        } else {
          await httpClient.post('/calls/signal', {
            targetUserId: userId,
            type: 'call_ended'
          });
          console.log('📤 Sent call ended signal via HTTP');
        }
      } catch (signalError) {
        console.error('⚠️ Failed to send call ended signal:', signalError);
      }
      
      // Log call - even if it failed or currentCall is null
      const actualDuration = callStartTime 
        ? Math.floor((callEndTime - callStartTime) / 1000) 
        : 0;
      
      const callStatus = currentCall && actualDuration > 0 ? 'completed' : 'missed';
      
      await logCall({
        callType: callType,  // Use state variable instead of callState
        status: callStatus,
        duration: actualDuration,
        startedAt: callStartTime ? callStartTime.toISOString() : new Date().toISOString(),
        endedAt: callEndTime.toISOString()
      });
      
      // Refresh call history to show the new call
      await fetchCallHistory();
      
      // Cleanup call if it exists
      if (currentCall) {
        await currentCall.endCall();
      }
      
      // Reset call state
      setIsCallActive(false);
      setCurrentCall(null);
      setLocalStream(null);
      setRemoteStream(null);
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);
      setCallStartTime(null);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const toggleAudio = async () => {
    if (currentCall) {
      const enabled = await currentCall.toggleAudio();
      setIsAudioEnabled(enabled);
      return enabled;
    }
    return isAudioEnabled;
  };

  const toggleVideo = async () => {
    if (currentCall) {
      const enabled = await currentCall.toggleVideo();
      setIsVideoEnabled(enabled);
      return enabled;
    }
    return isVideoEnabled;
  };

  const handleAcceptIncomingCall = async () => {
    if (incomingCall) {
      // Send call accepted signal (WebSocket or HTTP fallback)
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'call_accepted',
            targetUserId: incomingCall.callerUser.id,
            fromUserId: currentUser?.id
          }));
          console.log('📤 Sent call accepted signal via WebSocket');
        } else {
          await httpClient.post('/calls/signal', {
            targetUserId: incomingCall.callerUser.id,
            type: 'call_accepted',
            callType: incomingCall.callType
          });
          console.log('📤 Sent call accepted signal via HTTP');
        }
      } catch (error) {
        console.error('⚠️ Failed to send accept signal:', error);
      }
      
      await startCall(incomingCall.callType);
      setIncomingCall(null);
    }
  };

  const handleRejectIncomingCall = async () => {
    if (incomingCall) {
      // Send call rejected signal (WebSocket or HTTP fallback)
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'call_rejected',
            targetUserId: incomingCall.callerUser.id,
            fromUserId: currentUser?.id
          }));
          console.log('📤 Sent call rejected signal via WebSocket');
        } else {
          await httpClient.post('/calls/signal', {
            targetUserId: incomingCall.callerUser.id,
            type: 'call_rejected',
            callType: incomingCall.callType
          });
          console.log('📤 Sent call rejected signal via HTTP');
        }
      } catch (error) {
        console.error('⚠️ Failed to send reject signal:', error);
      }
      
      setIncomingCall(null);
    }
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
    
    messages.forEach(msg => {
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
        ) : messages.length === 0 && callHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center mb-4">
              <Send className="w-10 h-10 text-pink-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
            <p className="text-gray-500">Send a message to start the conversation</p>
          </div>
        ) : (
          <>
            {/* Call History Section */}
            {callHistory.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-center mb-3">
                  <span className="bg-pink-50 px-3 py-1 rounded-full text-xs text-pink-600 font-medium border border-pink-200">
                    Recent Calls
                  </span>
                </div>
                {callHistory.slice(0, 5).map((call) => (
                  <div key={call.callId || call._id} className="flex items-center justify-center gap-3 mb-3 p-3 bg-white rounded-lg border border-pink-100 shadow-sm">
                    <div className={`p-2 rounded-full ${
                      call.status === 'completed' ? 'bg-green-100' : 
                      call.status === 'missed' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      {call.callType === 'video' ? (
                        <Video className="w-4 h-4 text-gray-700" />
                      ) : (
                        <Phone className="w-4 h-4 text-gray-700" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {call.callerId === currentUser?.id ? 'Outgoing' : 'Incoming'} {call.callType} call
                      </p>
                      <p className="text-xs text-gray-500">
                        {call.status === 'completed' 
                          ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
                          : call.status}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(call.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
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
    </div>
  );
};

export default ChatPage;
