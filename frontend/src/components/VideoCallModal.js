import React, { useState, useEffect, useCallback } from 'react';
import { useRoomConnection } from '@whereby.com/browser-sdk/react';
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff } from 'lucide-react';
import { httpClient } from '../utils/authClient';

// Internal component that uses the Whereby hook
const VideoCallContent = ({ roomUrl, onClose, otherUser, meetingId }) => {
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState('connecting');
  const [remoteJoined, setRemoteJoined] = useState(false);
  
  // Parse roomKey from URL (critical for host rights)
  let parsedRoomKey;
  try {
    const urlObj = new URL(roomUrl);
    parsedRoomKey = urlObj.searchParams.get('roomKey') || undefined;
  } catch {
    parsedRoomKey = undefined;
  }
  
  console.log('🔑 Parsed roomKey:', parsedRoomKey ? 'exists' : 'none');

  // Connect to Whereby room
  const { state, actions, components } = useRoomConnection(
    roomUrl,
    {
      localMediaOptions: {
        audio: true,
        video: true,
      },
      roomKey: parsedRoomKey,  // Critical: Pass roomKey for host rights
    }
  );

  const { localParticipant, remoteParticipants } = state || {};
  const { VideoView } = components || {};
  const { toggleCamera, toggleMicrophone, joinRoom, leaveRoom } = actions || {};
  
  // Derive audio/camera state from SDK (single source of truth)
  const isMicMuted = !localParticipant?.isAudioEnabled;
  const isCameraOff = !localParticipant?.isVideoEnabled;

  // Join the room on mount and leave on unmount
  useEffect(() => {
    if (joinRoom) {
      console.log('🎥 Joining Whereby room...', roomUrl);
      joinRoom();
    }

    return () => {
      if (leaveRoom) {
        console.log('🎥 Leaving Whereby room...');
        leaveRoom();
      }
    };
  }, [joinRoom, leaveRoom, roomUrl]);

  // Monitor for Whereby connection errors and retry automatically
  useEffect(() => {
    if (state?.error && joinRoom) {
      console.log('⚠️ Whereby connection error detected:', state.error);
      console.log('🔄 Retrying joinRoom in 1 second...');
      const retryTimer = setTimeout(() => {
        console.log('🔄 Attempting to rejoin room...');
        joinRoom();
      }, 1000);
      return () => clearTimeout(retryTimer);
    }
  }, [state?.error, joinRoom]);

  // Debug logging for Whereby state
  useEffect(() => {
    console.log('📹 VideoCallModal State:', {
      localParticipant: localParticipant ? 'exists' : 'null',
      localStream: localParticipant?.stream ? 'exists' : 'null',
      remoteParticipants: remoteParticipants?.length || 0,
      VideoView: VideoView ? 'exists' : 'null',
      connectionState
    });
  }, [localParticipant, remoteParticipants, VideoView, connectionState]);

  // Track call duration
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update connection state
  useEffect(() => {
    if (localParticipant?.stream && remoteParticipants?.length > 0) {
      setConnectionState('connected');
    } else if (localParticipant?.stream) {
      setConnectionState('waiting');
    }
  }, [localParticipant, remoteParticipants]);
  
  // Track when remote user joins
  useEffect(() => {
    if (remoteParticipants && remoteParticipants.length > 0) {
      setRemoteJoined(true);
    }
  }, [remoteParticipants]);
  
  // Auto-end call when remote user leaves (after they had joined)
  useEffect(() => {
    if (remoteJoined && (!remoteParticipants || remoteParticipants.length === 0)) {
      console.log('🚪 Remote participant left the call. Ending call in 3 seconds...');
      const timeout = setTimeout(() => {
        console.log('⏰ Remote participant did not rejoin. Ending call locally.');
        handleEndCall();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [remoteJoined, remoteParticipants]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleMic = useCallback(() => {
    if (toggleMicrophone) {
      toggleMicrophone();
      // SDK state updates automatically - no need for local state
    }
  }, [toggleMicrophone]);

  const handleToggleCamera = useCallback(() => {
    if (toggleCamera) {
      toggleCamera();
      // SDK state updates automatically - no need for local state
    }
  }, [toggleCamera]);

  const handleEndCall = useCallback(async () => {
    try {
      // Clean up streams
      if (localParticipant?.stream) {
        localParticipant.stream.getTracks().forEach(track => track.stop());
      }

      // Delete the room from Whereby
      if (meetingId) {
        await httpClient.delete(`/whereby/delete-room/${meetingId}`);
      }
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      onClose?.();
    }
  }, [localParticipant, meetingId, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {otherUser?.profileImage && (
            <img
              src={otherUser.profileImage}
              alt={otherUser.fullName}
              className="w-10 h-10 rounded-full object-cover"
            />
          )}
          <div>
            <h3 className="text-white font-semibold">{otherUser?.fullName || 'User'}</h3>
            <p className="text-sm text-gray-400">
              {connectionState === 'connecting' && 'Connecting...'}
              {connectionState === 'waiting' && 'Waiting for user to join...'}
              {connectionState === 'connected' && formatTime(callDuration)}
            </p>
          </div>
        </div>
        <button
          onClick={handleEndCall}
          className="text-gray-400 hover:text-white transition"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Video Grid */}
      <div className="flex-1 relative bg-black">
        {/* Remote Video (Full Screen) or Local Video While Waiting */}
        {remoteParticipants?.length > 0 && remoteParticipants[0]?.stream ? (
          /* Remote participant joined - show their video */
          <div className="absolute inset-0">
            {VideoView && (
              <VideoView
                stream={remoteParticipants[0].stream}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
          </div>
        ) : localParticipant?.stream && VideoView ? (
          /* No remote participant - show own video in main area */
          <div className="absolute inset-0">
            <VideoView
              stream={localParticipant.stream}
              muted
              mirror={true}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* Overlay message */}
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4 mx-auto animate-pulse">
                  <VideoIcon className="w-10 h-10" />
                </div>
                <p className="text-xl font-semibold">Waiting for {otherUser?.fullName || 'user'} to join...</p>
              </div>
            </div>
          </div>
        ) : (
          /* No video streams yet - show loading state */
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-900 to-purple-900">
            <div className="text-center text-white">
              {connectionState === 'connecting' && (
                <>
                  <div className="inline-block w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-lg">Connecting...</p>
                </>
              )}
              {connectionState === 'waiting' && (
                <>
                  <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <VideoIcon className="w-10 h-10" />
                  </div>
                  <p className="text-lg">Waiting for camera...</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Local Video (Picture in Picture) */}
        {localParticipant?.stream && (
          <div className="absolute bottom-20 right-4 w-32 h-44 bg-gray-900 rounded-lg overflow-hidden border-2 border-white shadow-lg">
            {VideoView && (
              <VideoView
                stream={localParticipant.stream}
                muted
                mirror={true}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
            {isCameraOff && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-6">
        <div className="flex items-center justify-center gap-4">
          {/* Mute/Unmute */}
          <button
            onClick={handleToggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              isMicMuted
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isMicMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Camera On/Off */}
          <button
            onClick={handleToggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              isCameraOff
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isCameraOff ? (
              <VideoOff className="w-6 h-6 text-white" />
            ) : (
              <VideoIcon className="w-6 h-6 text-white" />
            )}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Wrapper component that handles conditional rendering
const VideoCallModal = ({ isOpen, roomUrl, onClose, otherUser, meetingId }) => {
  // Don't render anything if modal is not open or no valid room URL
  if (!isOpen || !roomUrl) {
    return null;
  }

  return (
    <VideoCallContent
      roomUrl={roomUrl}
      onClose={onClose}
      otherUser={otherUser}
      meetingId={meetingId}
    />
  );
};

export default VideoCallModal;
