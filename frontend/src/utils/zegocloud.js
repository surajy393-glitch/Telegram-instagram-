// frontend/src/utils/zegocloud.js

import ZegoExpressEngine from 'zego-express-engine-webrtc';
import { httpClient } from './authClient';

/**
 * ZegoCloud Video/Audio Calling Service
 * Handles complete video calling functionality with ZegoCloud SDK
 */
export class ZegoCloudCall {
  constructor(localUserId, remoteUserId, callType = 'video') {
    // Log the received userId for debugging
    console.log('🔍 ZegoCloudCall constructor - received localUserId:', localUserId, 'type:', typeof localUserId);
    
    // Fallback to a random guest ID if no valid user ID is provided.
    if (typeof localUserId !== 'string' || localUserId.trim() === '') {
      console.warn('⚠️ Empty or invalid localUserId received, generating guest ID');
      localUserId = `guest_${Math.random().toString(36).slice(2, 11)}`;
    }
    this.localUserId = localUserId;
    console.log('✅ Using localUserId:', this.localUserId);
    this.remoteUserId = remoteUserId;
    this.callType = callType; // 'video' or 'audio'
    this.roomId = this.generateRoomId(localUserId, remoteUserId);
    
    // ZegoCloud configuration - TOKEN-ONLY MODE
    const envAppId = parseInt(process.env.REACT_APP_ZEGO_APP_ID, 10);
    this.appId = Number.isInteger(envAppId) ? envAppId : 2106710509;
    
    // State management
    this.zg = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isInRoom = false;
    this.isPublishing = false;
    this.isAudioEnabled = true;
    this.isVideoEnabled = callType === 'video';
    
    // Event callbacks
    this.onRemoteStream = null;
    this.onCallEnd = null;
    this.onError = null;
    this.onIncomingCall = null;
    
    // Bind methods to preserve context
    this.handleUserAdd = this.handleUserAdd.bind(this);
    this.handleUserDelete = this.handleUserDelete.bind(this);
    this.handleStreamAdd = this.handleStreamAdd.bind(this);
    this.handleStreamDelete = this.handleStreamDelete.bind(this);
    this.handleRoomStateUpdate = this.handleRoomStateUpdate.bind(this);
  }

  /**
   * Generate consistent room ID from user IDs
   */
  generateRoomId(userId1, userId2) {
    const sortedIds = [userId1, userId2].sort();
    return `call_${sortedIds[0]}_${sortedIds[1]}`;
  }

  /**
   * Fetch authentication token from backend
   */
  async fetchToken() {
    try {
      console.log('Fetching ZegoCloud token for:', { userId: this.localUserId, roomId: this.roomId });
      
      const response = await httpClient.post('/zego/token', {
        userId: this.localUserId,
        roomId: this.roomId
      });
      
      console.log('Token response:', response.data);
      
      if (response.data && response.data.token) {
        let token = response.data.token;
        
        // The API should return a simple string. However, defensive
        // programming is important: if the backend inadvertently wraps the
        // token in an object (e.g. { token: '04...' }), extract the string.
        if (typeof token !== 'string') {
          // If a nested `token` field exists, use it. Otherwise report an
          // explicit error so that developers can correct the API response.
          if (token && typeof token.token === 'string') {
            token = token.token;
          } else {
            throw new Error(`Token is not a string, received: ${typeof token}`);
          }
        }
        
        // Ensure the token starts with the expected "04" prefix (Token04)
        if (!token.startsWith('04')) {
          throw new Error('Invalid Token04 format - should start with "04"');
        }
        
        console.log('✅ Valid Token04 received:', token.substring(0, 20) + '...');
        return token;
      }
      
      throw new Error('Invalid token response from server');
    } catch (error) {
      console.error('❌ Failed to fetch ZegoCloud token:', error);
      throw new Error(`Token fetch failed: ${error.message}`);
    }
  }

  /**
   * Initialize ZegoCloud engine - CORRECTED SYNTAX FOR WEB SDK v3.21.0+
   */
  async initializeEngine() {
    try {
      if (!this.appId) {
        throw new Error('ZegoCloud App ID not configured');
      }

      console.log('🔧 Initializing ZegoCloud engine...');
      console.log('   AppID:', this.appId);
      console.log('   Mode: Token-only authentication');
      
      // CORRECT createEngine syntax for Web SDK v3.21.0+
      // Use profile object instead of deprecated 5-parameter syntax
      this.zg = ZegoExpressEngine.createEngine({
        appID: this.appId,                    // appID (number)
        scenario: ZegoScenario.Communication, // Use Communication for video calls
        eventHandler: {
          // Stream management events
          onRoomStreamUpdate: (roomID, updateType, streamList) => {
            console.log('roomStreamUpdate:', roomID, updateType, streamList);
            if (updateType === 'ADD') {
              this.handleStreamAdd(roomID, streamList);
            } else if (updateType === 'DELETE') {
              this.handleStreamDelete(roomID, streamList);
            }
          },
          
          // User management events
          onRoomUserUpdate: (roomID, updateType, userList) => {
            console.log('roomUserUpdate:', roomID, updateType, userList);
            if (updateType === 'ADD') {
              this.handleUserAdd(roomID, userList);
            } else if (updateType === 'DELETE') {
              this.handleUserDelete(roomID, userList);
            }
          },
          
          // Room state events
          onRoomStateUpdate: this.handleRoomStateUpdate
        }
      });
      
      console.log('✅ ZegoCloud engine initialized successfully');
      console.log('   AppID:', this.appId);
      console.log('   Scenario: Communication (video calling optimized)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ZegoCloud engine:', error);
      this.handleError('Engine initialization failed', error);
      return false;
    }
  }

  /**
   * Get user media using ZegoCloud createStream (camera/microphone)
   */
  async getUserMedia() {
    try {
      if (!this.zg) {
        throw new Error('ZegoCloud engine not initialized');
      }

      // Use ZegoCloud's createStream method
      const config = {
        camera: {
          audio: true,
          video: this.isVideoEnabled ? {
            width: 1280,
            height: 720,
            frameRate: 30
          } : false
        }
      };

      const stream = await this.zg.createStream(config);
      this.localStream = stream;
      
      console.log('ZegoCloud stream created successfully');
      return stream;
    } catch (error) {
      console.error('Failed to create ZegoCloud stream:', error);
      
      // Handle specific permission errors
      if (error.msg && error.msg.includes('permission')) {
        throw new Error('Camera/microphone permission denied');
      } else if (error.msg && error.msg.includes('not found')) {
        throw new Error('Camera/microphone not found');
      }
      
      throw new Error(`Stream creation failed: ${error.msg || error.message}`);
    }
  }

  /**
   * Start a call (join room and publish stream)
   */
  async startCall() {
    try {
      // Initialize engine if not already done
      if (!this.zg) {
        const initialized = await this.initializeEngine();
        if (!initialized) {
          throw new Error('Failed to initialize ZegoCloud engine');
        }
      }

      // Get authentication token
      const token = await this.fetchToken();
      
      // Get user media
      await this.getUserMedia();
      
      // Login to room
      await this.joinRoom(token);
      
      // Publish local stream
      await this.publishStream();
      
      console.log('Call started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start call:', error);
      this.handleError('Call start failed', error);
      await this.cleanup();
      return false;
    }
  }

  /**
   * Join ZegoCloud room - CORRECTED TOKEN SYNTAX
   */
  async joinRoom(token) {
    try {
      if (!this.zg) {
        throw new Error('ZegoCloud engine not initialized');
      }

      // Validate token
      if (!token || typeof token !== 'string') {
        throw new Error(`Invalid token: expected string, got ${typeof token}. Value: ${token}`);
      }

      console.log('Joining room with token type:', typeof token, 'starts with 04:', token.startsWith('04'));

      // CORRECT loginRoom syntax for token-based authentication
      const result = await this.zg.loginRoom(this.roomId, {
        token: token,  // Token for authentication
        user: {
          userID: this.localUserId,
          userName: this.localUserId
        }
      });

      console.log('loginRoom result:', result);

      if (result === true || (result && result.errorCode === 0)) {
        this.isInRoom = true;
        console.log(`✅ Joined room successfully: ${this.roomId}`);
      } else {
        throw new Error(`Failed to join room: ${result.errorCode || JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error('❌ Room join failed:', error);
      throw error;
    }
  }

  /**
   * Publish local stream
   */
  async publishStream() {
    try {
      if (!this.zg) {
        throw new Error('ZegoCloud engine not available');
      }
      
      if (!this.localStream) {
        throw new Error('Local stream not available');
      }

      // Validate stream has tracks
      const tracks = this.localStream.getTracks();
      if (!tracks || tracks.length === 0) {
        throw new Error('Local stream has no media tracks');
      }

      console.log('Publishing stream with tracks:', tracks.map(t => `${t.kind}(${t.label})`));

      const streamId = `${this.localUserId}_stream`;
      
      await this.zg.startPublishingStream(streamId, this.localStream);
      this.isPublishing = true;
      
      console.log(`✅ Publishing stream: ${streamId}`);
    } catch (error) {
      console.error('❌ Failed to publish stream:', error);
      throw error;
    }
  }

  /**
   * Subscribe to remote stream
   */
  async subscribeToStream(streamId, userId) {
    try {
      if (!this.zg) {
        throw new Error('ZegoCloud engine not initialized');
      }

      // startPlayingStream with video element or callback
      const remoteStream = await this.zg.startPlayingStream(streamId, {
        video: true,
        audio: true
      });
      
      this.remoteStream = remoteStream;
      
      console.log(`Subscribed to stream: ${streamId}`);
      
      // Notify callback
      if (this.onRemoteStream) {
        this.onRemoteStream(remoteStream, userId);
      }
      
      return remoteStream;
    } catch (error) {
      console.error('Failed to subscribe to stream:', error);
      this.handleError('Stream subscription failed', error);
    }
  }

  /**
   * Toggle audio on/off
   */
  async toggleAudio() {
    try {
      if (!this.localStream) {
        throw new Error('Local stream not available');
      }

      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioEnabled = audioTrack.enabled;
        
        console.log(`Audio ${this.isAudioEnabled ? 'enabled' : 'disabled'}`);
        return this.isAudioEnabled;
      }
    } catch (error) {
      console.error('Failed to toggle audio:', error);
      this.handleError('Audio toggle failed', error);
    }
    return this.isAudioEnabled;
  }

  /**
   * Toggle video on/off
   */
  async toggleVideo() {
    try {
      if (!this.localStream) {
        throw new Error('Local stream not available');
      }

      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoEnabled = videoTrack.enabled;
        
        console.log(`Video ${this.isVideoEnabled ? 'enabled' : 'disabled'}`);
        return this.isVideoEnabled;
      }
    } catch (error) {
      console.error('Failed to toggle video:', error);
      this.handleError('Video toggle failed', error);
    }
    return this.isVideoEnabled;
  }

  /**
   * End the call
   */
  async endCall() {
    try {
      console.log('Ending call...');
      
      // Stop publishing
      if (this.isPublishing && this.zg) {
        await this.zg.stopPublishingStream(`${this.localUserId}_stream`);
        this.isPublishing = false;
      }
      
      // Leave room
      if (this.isInRoom && this.zg) {
        await this.zg.logoutRoom(this.roomId);
        this.isInRoom = false;
      }
      
      // Cleanup
      await this.cleanup();
      
      // Notify callback
      if (this.onCallEnd) {
        this.onCallEnd();
      }
      
      console.log('Call ended successfully');
    } catch (error) {
      console.error('Error ending call:', error);
      await this.cleanup(); // Force cleanup even if there are errors
    }
  }

  /**
   * Complete cleanup of resources
   */
  async cleanup() {
    try {
      // Stop local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
        });
        this.localStream = null;
      }
      
      // Stop remote stream
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => {
          track.stop();
        });
        this.remoteStream = null;
      }
      
      // Destroy ZegoCloud engine
      if (this.zg) {
        this.zg.destroyEngine();
        this.zg = null;
      }
      
      // Reset state
      this.isInRoom = false;
      this.isPublishing = false;
      
      console.log('Cleanup completed');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Event handler: User joined room
   */
  handleUserAdd(roomId, updateUserList) {
    console.log('Users joined:', updateUserList);
    
    // Check if remote user joined
    const remoteUser = updateUserList.find(user => user.userID === this.remoteUserId);
    if (remoteUser && this.onIncomingCall) {
      this.onIncomingCall(remoteUser);
    }
  }

  /**
   * Event handler: User left room
   */
  handleUserDelete(roomId, updateUserList) {
    console.log('Users left:', updateUserList);
    
    // Check if remote user left
    const remoteUser = updateUserList.find(user => user.userID === this.remoteUserId);
    if (remoteUser) {
      this.endCall();
    }
  }

  /**
   * Event handler: Stream added
   */
  handleStreamAdd(roomId, updateStreamList) {
    console.log('Streams added:', updateStreamList);
    
    // Subscribe to remote user's stream
    updateStreamList.forEach(stream => {
      if (stream.user.userID === this.remoteUserId) {
        this.subscribeToStream(stream.streamID, stream.user.userID);
      }
    });
  }

  /**
   * Event handler: Stream removed
   */
  handleStreamDelete(roomId, updateStreamList) {
    console.log('Streams removed:', updateStreamList);
    
    // Handle remote stream removal
    updateStreamList.forEach(stream => {
      if (stream.user.userID === this.remoteUserId) {
        if (this.remoteStream) {
          this.remoteStream.getTracks().forEach(track => track.stop());
          this.remoteStream = null;
        }
      }
    });
  }

  /**
   * Event handler: Room state update
   */
  handleRoomStateUpdate(roomId, state, errorCode, extendedData) {
    console.log('Room state update:', { roomId, state, errorCode, extendedData });
    
    if (errorCode !== 0) {
      this.handleError(`Room state error: ${errorCode}`, { roomId, state, extendedData });
    }
  }

  /**
   * Error handler
   */
  handleError(message, error) {
    console.error('ZegoCloud error:', message, error);
    
    if (this.onError) {
      this.onError(message, error);
    }
  }

  /**
   * Get current call state
   */
  getCallState() {
    return {
      isInRoom: this.isInRoom,
      isPublishing: this.isPublishing,
      isAudioEnabled: this.isAudioEnabled,
      isVideoEnabled: this.isVideoEnabled,
      roomId: this.roomId,
      localUserId: this.localUserId,
      remoteUserId: this.remoteUserId,
      callType: this.callType
    };
  }

  /**
   * Set event callbacks
   */
  setCallbacks({ onRemoteStream, onCallEnd, onError, onIncomingCall }) {
    this.onRemoteStream = onRemoteStream;
    this.onCallEnd = onCallEnd;
    this.onError = onError;
    this.onIncomingCall = onIncomingCall;
  }
}

/**
 * Utility function to create a new call instance
 */
export function createZegoCall(localUserId, remoteUserId, callType = 'video') {
  return new ZegoCloudCall(localUserId, remoteUserId, callType);
}

/**
 * Check if ZegoCloud is supported in current browser
 */
export function isZegoCloudSupported() {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection &&
    window.WebSocket
  );
}

export default ZegoCloudCall;
