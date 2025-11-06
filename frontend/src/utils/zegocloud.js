// frontend/src/utils/zegocloud.js

import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { httpClient } from './authClient';

/**
 * SINGLETON PATTERN: Global ZegoCloud Engine Instance
 * SDK v3.11.0 requires single engine instance to prevent memory leaks
 */
let zegoEngineInstance = null;
let activeCallsCount = 0;

/**
 * Initialize global ZegoCloud engine (singleton pattern)
 */
async function initializeGlobalEngine(appId) {
  if (zegoEngineInstance) {
    console.log('♻️ Reusing existing ZegoCloud engine instance');
    activeCallsCount++;
    return zegoEngineInstance;
  }

  try {
    // Ensure appID is a NUMBER (critical for SDK v3.11.0)
    const appIdNumber = Number(appId);
    if (!Number.isInteger(appIdNumber) || appIdNumber <= 0) {
      throw new Error(`Invalid appID: must be a positive integer, got ${appId} (type: ${typeof appId})`);
    }

    // Ensure server is a STRING (critical for SDK v3.11.0)
    const serverString = String('wss://webliveroom-api.zego.im/ws');

    console.log('🔧 Creating global ZegoCloud engine (singleton)...');
    console.log('   AppID:', appIdNumber, '(type:', typeof appIdNumber, ')');
    console.log('   Server:', serverString, '(type:', typeof serverString, ')');
    console.log('   SDK Version: 3.11.0');
    
    // Create engine instance - SINGLETON
    zegoEngineInstance = new ZegoExpressEngine(appIdNumber, serverString);
    activeCallsCount = 1;
    
    console.log('✅ Global ZegoCloud engine created successfully');
    return zegoEngineInstance;
  } catch (error) {
    console.error('❌ Failed to create global ZegoCloud engine:', error);
    throw error;
  }
}

/**
 * Destroy global ZegoCloud engine (only when no active calls)
 */
function destroyGlobalEngine() {
  activeCallsCount = Math.max(0, activeCallsCount - 1);
  
  if (activeCallsCount === 0 && zegoEngineInstance) {
    console.log('🗑️ Destroying global ZegoCloud engine...');
    try {
      // Use INSTANCE method, not static method for Web SDK v3.11.0
      zegoEngineInstance.destroyEngine();
      zegoEngineInstance = null;
      console.log('✅ Global ZegoCloud engine destroyed');
    } catch (error) {
      console.error('❌ Error destroying engine:', error);
    }
  } else {
    console.log(`⏳ Not destroying engine - ${activeCallsCount} active call(s) remaining`);
  }
}

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
    // CRITICAL: Ensure appID is a NUMBER (not string) for SDK v3.11.0
    const envAppId = process.env.REACT_APP_ZEGO_APP_ID;
    let parsedAppId;
    
    if (typeof envAppId === 'string') {
      parsedAppId = parseInt(envAppId, 10);
    } else if (typeof envAppId === 'number') {
      parsedAppId = envAppId;
    } else {
      parsedAppId = 2106710509; // Fallback default
    }
    
    // Final validation: ensure it's a valid positive integer
    this.appId = (Number.isInteger(parsedAppId) && parsedAppId > 0) ? parsedAppId : 2106710509;
    
    console.log('🔧 ZegoCloud appID configured:', this.appId, '(type:', typeof this.appId, ')');
    
    // State management
    this.zg = null;
    this.localStream = null;
    this.remoteStream = null;
    this.remoteStreamId = null; // Track remote stream ID for cleanup
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
      
      // Check if response has token field
      if (!response.data || !response.data.token) {
        throw new Error(`Invalid token response structure: ${JSON.stringify(response.data)}`);
      }
      
      let token = response.data.token;
      
      // Explicit null/undefined check FIRST
      if (token === null || token === undefined) {
        throw new Error('Token is null or undefined in response');
      }
      
      // Then check if it's a string
      if (typeof token !== 'string') {
        // Handle nested token object (defensive programming)
        if (token && typeof token.token === 'string') {
          token = token.token;
        } else {
          throw new Error(`Token is not a string, received type: ${typeof token}, value: ${JSON.stringify(token)}`);
        }
      }
      
      // Ensure token is not empty
      if (token.trim() === '') {
        throw new Error('Token is an empty string');
      }
      
      // Validate Token04 format
      if (!token.startsWith('04')) {
        throw new Error(`Invalid Token04 format - should start with "04", received: ${token.substring(0, 10)}...`);
      }
      
      console.log('✅ Valid Token04 received:', token.substring(0, 20) + '...');
      return token;
      
    } catch (error) {
      console.error('❌ Failed to fetch ZegoCloud token:', error);
      
      // Enhanced error logging for backend responses
      if (error.response) {
        console.error('Backend error response:', error.response.data);
        throw new Error(`Token fetch failed: ${error.response.data.detail || error.message}`);
      }
      
      throw new Error(`Token fetch failed: ${error.message}`);
    }
  }

  /**
   * Initialize ZegoCloud engine - SDK v3.11.0 compatible (SINGLETON PATTERN)
   */
  async initializeEngine() {
    try {
      if (!this.appId) {
        throw new Error('ZegoCloud App ID not configured');
      }

      console.log('🔧 Initializing ZegoCloud engine (singleton mode)...');
      console.log('   Mode: Token-only authentication');
      console.log('   SDK Version: 3.11.0');
      
      // Use singleton pattern - reuse existing engine or create new one
      this.zg = await initializeGlobalEngine(this.appId);
      
      // Set up event listeners for this call instance
      this.setupEventListeners();
      
      console.log('✅ ZegoCloud engine ready');
      console.log('   Active calls:', activeCallsCount);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ZegoCloud engine:', error);
      console.error('   Error details:', {
        message: error.message,
        appId: this.appId,
        appIdType: typeof this.appId
      });
      this.handleError('Engine initialization failed', error);
      return false;
    }
  }

  /**
   * Set up ZegoCloud event listeners
   */
  setupEventListeners() {
    if (!this.zg) return;

    // Stream management events
    this.zg.on('roomStreamUpdate', (roomID, updateType, streamList) => {
      console.log('roomStreamUpdate:', roomID, updateType, streamList);
      if (updateType === 'ADD') {
        this.handleStreamAdd(roomID, streamList);
      } else if (updateType === 'DELETE') {
        this.handleStreamDelete(roomID, streamList);
      }
    });
    
    // User management events
    this.zg.on('roomUserUpdate', (roomID, updateType, userList) => {
      console.log('roomUserUpdate:', roomID, updateType, userList);
      if (updateType === 'ADD') {
        this.handleUserAdd(roomID, userList);
      } else if (updateType === 'DELETE') {
        this.handleUserDelete(roomID, userList);
      }
    });
    
    // Room state events
    this.zg.on('roomStateUpdate', this.handleRoomStateUpdate);
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
  /**
   * Join ZegoCloud room - CORRECTED FOR SDK v3.11.0
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

      // CORRECT loginRoom syntax for SDK v3.11.0: 3 separate parameters
      // loginRoom(roomID: string, token: string, user: object, config?: object)
      const user = {
        userID: String(this.localUserId),
        userName: String(this.localUserId)
      };

      const config = {
        userUpdate: true
      };

      console.log('loginRoom parameters:', {
        roomId: this.roomId,
        tokenType: typeof token,
        user: user,
        config: config
      });

      const result = await this.zg.loginRoom(
        this.roomId,  // 1st param: roomID as string
        token,        // 2nd param: token as string (NOT in object!)
        user,         // 3rd param: user object
        config        // 4th param: config object (optional)
      );

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

      console.log(`📥 Subscribing to stream: ${streamId} from user: ${userId}`);

      // Track remote stream ID for cleanup
      this.remoteStreamId = streamId;

      // startPlayingStream with video element or callback
      const remoteStream = await this.zg.startPlayingStream(streamId, {
        video: true,
        audio: true
      });
      
      this.remoteStream = remoteStream;
      
      console.log(`✅ Subscribed to stream: ${streamId}`);
      
      // Notify callback
      if (this.onRemoteStream) {
        this.onRemoteStream(remoteStream, userId);
      }
      
      return remoteStream;
    } catch (error) {
      console.error('❌ Failed to subscribe to stream:', error);
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
      console.log('🧹 Starting cleanup...');
      
      // Stop remote stream using SDK method FIRST (before stopping tracks)
      if (this.remoteStreamId && this.zg) {
        try {
          console.log(`Stopping remote stream: ${this.remoteStreamId}`);
          await this.zg.stopPlayingStream(this.remoteStreamId);
          this.remoteStreamId = null;
        } catch (error) {
          console.warn('Error stopping remote stream:', error);
        }
      }
      
      // Stop local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          console.log(`Stopping local ${track.kind} track`);
          track.stop();
        });
        this.localStream = null;
      }
      
      // Stop remote stream tracks (if still exist)
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => {
          console.log(`Stopping remote ${track.kind} track`);
          track.stop();
        });
        this.remoteStream = null;
      }
      
      // Destroy global engine using singleton pattern
      destroyGlobalEngine();
      this.zg = null;
      
      // Reset state
      this.isInRoom = false;
      this.isPublishing = false;
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
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
  async handleStreamDelete(roomId, updateStreamList) {
    console.log('📤 Streams removed:', updateStreamList);
    
    // Handle remote stream removal
    for (const stream of updateStreamList) {
      if (stream.user.userID === this.remoteUserId) {
        try {
          // Stop playing stream using SDK method FIRST
          if (this.zg && stream.streamID) {
            console.log(`Stopping remote stream via SDK: ${stream.streamID}`);
            await this.zg.stopPlayingStream(stream.streamID);
          }
          
          // Then stop MediaStreamTracks
          if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => {
              console.log(`Stopping remote ${track.kind} track`);
              track.stop();
            });
            this.remoteStream = null;
          }
          
          this.remoteStreamId = null;
        } catch (error) {
          console.error('Error handling stream delete:', error);
        }
      }
    }
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
 * Destroy global ZegoCloud engine (for emergency cleanup)
 */
export function destroyZegoEngine() {
  if (zegoEngineInstance) {
    console.log('🚨 Emergency engine destroy called');
    try {
      ZegoExpressEngine.destroyEngine();
      zegoEngineInstance = null;
      activeCallsCount = 0;
      console.log('✅ Engine destroyed successfully');
    } catch (error) {
      console.error('❌ Error destroying engine:', error);
    }
  }
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
