import React, { useState, useEffect, useCallback } from 'react';
import { useRoomConnection } from '@whereby.com/browser-sdk/react';
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff } from 'lucide-react';
import { httpClient } from '../utils/authClient';

// Internal component that uses the Whereby hook
const VideoCallContent = ({ roomUrl, onClose, otherUser, meetingId }) => {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState('connecting');

  // Connect to Whereby room
  const { state, actions, components } = useRoomConnection(
    roomUrl,
    {
      localMediaOptions: {
        audio: true,
        video: true,
      },
    }
  );

  const { localParticipant, remoteParticipants } = state || {};
  const { VideoView } = components || {};
  const { toggleCamera, toggleMicrophone, joinRoom, leaveRoom } = actions || {};

  // Join the room on mount and leave on unmount
  useEffect(() => {
    if (joinRoom) {
      console.log('🎥 Joining Whereby room...');
      joinRoom();
    }

    return () => {
      if (leaveRoom) {
        console.log('🎥 Leaving Whereby room...');
        leaveRoom();
      }
    };
  }, [joinRoom, leaveRoom]);

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

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleMic = useCallback(() => {
    if (toggleMicrophone) {
      toggleMicrophone();
      setIsMicMuted(!isMicMuted);
    }
  }, [isMicMuted, toggleMicrophone]);

  const handleToggleCamera = useCallback(() => {
    if (toggleCamera) {
      toggleCamera();
      setIsCameraOff(!isCameraOff);
    }
  }, [isCameraOff, toggleCamera]);

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
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
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
        {/* Remote Video (Full Screen) */}
        {remoteParticipants?.length > 0 && remoteParticipants[0]?.stream ? (
          <div className="absolute inset-0">
            {VideoView && (
              <VideoView
                stream={remoteParticipants[0].stream}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
          </div>
        ) : (
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
                  <p className="text-lg">Waiting for {otherUser?.fullName || 'user'} to join...</p>
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
