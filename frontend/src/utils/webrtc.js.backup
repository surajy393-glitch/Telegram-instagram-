// WebRTC configuration with Google STUN servers + OpenRelay TURN servers
const ICE_SERVERS = {
  iceServers: [
    // Google Public STUN servers (FREE) - for NAT traversal
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // OpenRelay TURN servers (FREE) - for same-device/same-network testing
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

// Global WebSocket connection manager to prevent multiple connections
class WebSocketManager {
  constructor() {
    this.connections = new Map(); // userId -> { ws, refCount, messageHandlers }
  }

  getConnection(userId, messageHandler) {
    if (this.connections.has(userId)) {
      // Reuse existing connection
      const conn = this.connections.get(userId);
      conn.refCount++;
      conn.messageHandlers.add(messageHandler);
      console.log(`♻️ Reusing WebSocket connection for user ${userId} (refCount: ${conn.refCount})`);
      return conn.ws;
    }

    // Create new connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/signaling/${userId}`;
    
    console.log('🔌 Creating new WebSocket connection:', wsUrl);
    const ws = new WebSocket(wsUrl);
    
    const connData = {
      ws,
      refCount: 1,
      messageHandlers: new Set([messageHandler]),
      reconnectAttempts: 0,
      reconnectTimer: null
    };
    
    this.connections.set(userId, connData);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      // Broadcast to all handlers
      connData.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason || 'none'}`);
      this.handleDisconnection(userId);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return ws;
  }

  handleDisconnection(userId) {
    const conn = this.connections.get(userId);
    if (!conn) return;

    // Attempt reconnection with exponential backoff
    if (conn.reconnectAttempts < 5) {
      const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts), 30000);
      console.log(`🔄 Reconnecting WebSocket in ${delay}ms (attempt ${conn.reconnectAttempts + 1}/5)`);
      
      conn.reconnectTimer = setTimeout(() => {
        console.log('Signaling disconnected, reconnecting...');
        conn.reconnectAttempts++;
        
        // Store handlers before recreating connection
        const handlers = Array.from(conn.messageHandlers);
        this.connections.delete(userId);
        
        // Recreate connection for each handler
        handlers.forEach(handler => {
          this.getConnection(userId, handler);
        });
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.connections.delete(userId);
    }
  }

  releaseConnection(userId, messageHandler) {
    const conn = this.connections.get(userId);
    if (!conn) return;

    conn.messageHandlers.delete(messageHandler);
    conn.refCount--;
    
    console.log(`📉 Released WebSocket connection for user ${userId} (refCount: ${conn.refCount})`);

    // Only close if no more references
    if (conn.refCount <= 0) {
      console.log(`🔌 Closing WebSocket connection for user ${userId}`);
      if (conn.reconnectTimer) {
        clearTimeout(conn.reconnectTimer);
      }
      if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close();
      }
      this.connections.delete(userId);
    }
  }
}

// Global singleton instance
const wsManager = new WebSocketManager();

export class WebRTCCall {
  constructor(localUserId, remoteUserId, callType = 'audio') {
    this.localUserId = localUserId;
    this.remoteUserId = remoteUserId;
    this.callType = callType; // 'audio' or 'video'
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.websocket = null;
    this.onRemoteStream = null;
    this.onCallEnd = null;
    this.onError = null;
    this.onIncomingCall = null; // Callback for incoming call notification
    this.isWebSocketReady = false;
    this.iceCandidateQueue = []; // Queue for ICE candidates received before remote description
  }

  async initialize() {
    try {
      // STEP 1: Get camera/microphone access FIRST
      const constraints = {
        audio: true,
        video: this.callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };
      
      console.log('📹 Requesting camera/microphone access...');
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Got local media stream');
      
      // STEP 2: Connect WebSocket for signaling (with timeout)
      console.log('🔌 Connecting to WebSocket signaling server...');
      await this.connectWebSocket();
      
      return this.localStream;
      
    } catch (error) {
      console.error('❌ Error initializing WebRTC:', error);
      
      // Specific error messages
      if (error.name === 'NotAllowedError') {
        if (this.onError) this.onError('Camera/microphone permission denied');
      } else if (error.name === 'NotFoundError') {
        if (this.onError) this.onError('Camera/microphone not found');
      } else if (error.name === 'NotReadableError') {
        if (this.onError) this.onError('Camera/microphone already in use');
      } else if (error.message === 'WebSocket connection timeout') {
        if (this.onError) this.onError('Connection timeout - Please try again');
      } else {
        if (this.onError) this.onError('Failed to start call. Please check permissions.');
      }
      throw error;
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      // Use global WebSocket manager to reuse connections
      this.websocketMessageHandler = async (message) => {
        await this.handleSignalingMessage(message);
      };
      
      this.websocket = wsManager.getConnection(this.localUserId, this.websocketMessageHandler);
      
      // Connection timeout (5 seconds)
      const timeout = setTimeout(() => {
        if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
          console.error('❌ WebSocket connection timeout');
          reject(new Error('WebSocket connection timeout'));
        } else {
          clearTimeout(timeout);
          console.log('✅ WebSocket connected successfully');
          this.isWebSocketReady = true;
          resolve();
        }
      }, 5000);
      
      // If already open, resolve immediately
      if (this.websocket.readyState === WebSocket.OPEN) {
        clearTimeout(timeout);
        console.log('✅ WebSocket already connected');
        this.isWebSocketReady = true;
        resolve();
      }
      
      // Listen for open event if connecting
      if (this.websocket.readyState === WebSocket.CONNECTING) {
        const onOpen = () => {
          clearTimeout(timeout);
          console.log('✅ WebSocket connected successfully');
          this.isWebSocketReady = true;
          this.websocket.removeEventListener('open', onOpen);
          resolve();
        };
        this.websocket.addEventListener('open', onOpen);
      }
    });
  }

  async startCall() {
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
      
      // Add local stream tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        console.log('✅ Received remote track');
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      };
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal('ice-candidate', { candidate: event.candidate });
        }
      };
      
      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection.connectionState);
        if (this.peerConnection.connectionState === 'disconnected' || 
            this.peerConnection.connectionState === 'failed') {
          this.endCall();
        }
      };
      
      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.sendSignal('offer', { offer: offer });
      console.log('✅ Sent call offer');
      
    } catch (error) {
      console.error('❌ Error starting call:', error);
      if (this.onError) this.onError('Failed to start call');
      throw error;
    }
  }

  async handleSignalingMessage(message) {
    try {
      const { type, data, fromUserId, callType } = message;
      
      console.log('📨 Received signal:', type, 'from:', fromUserId);
      
      // Allow messages from any user (don't restrict to remoteUserId for incoming calls)
      
      switch (type) {
        case 'offer':
          // This is an incoming call!
          console.log('📞 Incoming call from:', fromUserId, 'Type:', callType);
          
          // Notify parent component about incoming call
          if (this.onIncomingCall) {
            this.onIncomingCall({
              fromUserId,
              callType,
              offer: data.offer
            });
          }
          
          // Store offer for later (when user accepts)
          this.pendingOffer = { offer: data.offer, callType, fromUserId };
          break;
          
        case 'answer':
          if (fromUserId !== this.remoteUserId) return;
          await this.handleAnswer(data.answer);
          break;
          
        case 'ice-candidate':
          if (fromUserId !== this.remoteUserId) return;
          await this.handleIceCandidate(data.candidate);
          break;
          
        case 'call-end':
          if (fromUserId !== this.remoteUserId) return;
          this.endCall();
          break;
      }
    } catch (error) {
      console.error('❌ Error handling signaling message:', error);
    }
  }

  async acceptIncomingCall() {
    // Accept the incoming call
    if (!this.pendingOffer) {
      console.error('No pending offer to accept');
      return;
    }

    const { offer, callType, fromUserId } = this.pendingOffer;
    this.remoteUserId = fromUserId;
    this.callType = callType;
    
    // Get user media first
    const constraints = {
      audio: true,
      video: callType === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      } : false
    };
    
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ Got local media stream for incoming call');
    
    // Now handle the offer
    await this.handleOffer(offer, callType);
    
    return this.localStream;
  }

  rejectIncomingCall() {
    // Reject the incoming call
    if (this.pendingOffer) {
      this.sendSignal('call-end', {});
      this.pendingOffer = null;
    }
  }

  async handleOffer(offer, callType) {
    try {
      this.callType = callType;
      
      // Create peer connection if not exists
      if (!this.peerConnection) {
        this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
        
        // Add local stream tracks
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
        
        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
          console.log('✅ Received remote track');
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
          }
          this.remoteStream.addTrack(event.track);
          if (this.onRemoteStream) {
            this.onRemoteStream(this.remoteStream);
          }
        };
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendSignal('ice-candidate', { candidate: event.candidate });
          }
        };
      }
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Process any queued ICE candidates now that remote description is set
      await this.processQueuedIceCandidates();
      
      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.sendSignal('answer', { answer: answer });
      console.log('✅ Sent call answer');
      
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }

  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Set remote description from answer');
      
      // Process any queued ICE candidates now that remote description is set
      await this.processQueuedIceCandidates();
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      // Check if remote description is set before adding ICE candidate
      if (!this.peerConnection) {
        console.log('⏳ Queuing ICE candidate - peer connection not ready');
        this.iceCandidateQueue.push(candidate);
        return;
      }
      
      if (!this.peerConnection.remoteDescription) {
        console.log('⏳ Queuing ICE candidate - remote description not set');
        this.iceCandidateQueue.push(candidate);
        return;
      }
      
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ Added ICE candidate');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }
  
  async processQueuedIceCandidates() {
    // Process all queued ICE candidates after remote description is set
    console.log(`📦 Processing ${this.iceCandidateQueue.length} queued ICE candidates`);
    
    for (const candidate of this.iceCandidateQueue) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ Added queued ICE candidate');
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error);
      }
    }
    
    this.iceCandidateQueue = [];
  }

  sendSignal(type, data) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending signal:', type, 'to user:', this.remoteUserId);
      this.websocket.send(JSON.stringify({
        type,
        targetUserId: this.remoteUserId,
        callType: this.callType,
        data
      }));
    } else {
      console.error('❌ Cannot send signal - WebSocket not open. State:', this.websocket?.readyState);
      if (this.onError) {
        this.onError('WebSocket not connected');
      }
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  endCall() {
    console.log('🔚 Ending call...');
    
    try {
      // Send end call signal only if WebSocket is open
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.sendSignal('call-end', {});
        console.log('📤 Sent call-end signal');
      }
      
      // Stop all local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
          console.log('⏹️ Stopped track:', track.kind);
        });
        this.localStream = null;
      }
      
      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
        console.log('🔌 Peer connection closed');
      }
      
      // Release WebSocket connection from manager (don't close directly)
      if (this.websocket && this.websocketMessageHandler) {
        wsManager.releaseConnection(this.localUserId, this.websocketMessageHandler);
        this.websocket = null;
        this.websocketMessageHandler = null;
        console.log('🔌 WebSocket connection released');
      }
      
      // Reset flags
      this.isWebSocketReady = false;
      this.remoteStream = null;
      
      // Call end callback
      if (this.onCallEnd) {
        this.onCallEnd();
      }
      
      console.log('✅ Call ended successfully');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}
