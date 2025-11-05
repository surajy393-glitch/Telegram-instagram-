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
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws/signaling/${this.localUserId}`;
      
      console.log('🔌 WebSocket URL:', wsUrl);
      
      // Connection timeout (5 seconds)
      const timeout = setTimeout(() => {
        if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
          console.error('❌ WebSocket connection timeout');
          this.websocket.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        clearTimeout(timeout);
        console.log('✅ WebSocket connected successfully');
        this.isWebSocketReady = true;
        resolve();
      };
      
      this.websocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleSignalingMessage(message);
      };
      
      this.websocket.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };
      
      this.websocket.onclose = (event) => {
        clearTimeout(timeout);
        console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        this.isWebSocketReady = false;
      };
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
      
      if (fromUserId !== this.remoteUserId) return;
      
      switch (type) {
        case 'offer':
          await this.handleOffer(data.offer, callType);
          break;
          
        case 'answer':
          await this.handleAnswer(data.answer);
          break;
          
        case 'ice-candidate':
          await this.handleIceCandidate(data.candidate);
          break;
          
        case 'call-end':
          this.endCall();
          break;
      }
    } catch (error) {
      console.error('❌ Error handling signaling message:', error);
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
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ Added ICE candidate');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
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
      
      // Close WebSocket
      if (this.websocket) {
        if (this.websocket.readyState === WebSocket.OPEN || 
            this.websocket.readyState === WebSocket.CONNECTING) {
          this.websocket.close();
        }
        this.websocket = null;
        console.log('🔌 WebSocket closed');
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
