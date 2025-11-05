import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';

const CallModal = ({ 
  isOpen, 
  callType, 
  localStream, 
  remoteStream, 
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  otherUser 
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(callType === 'video');
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState('Connecting...');

  // Set up local video
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set up remote video
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      setCallStatus('Connected');
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (remoteStream) {
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [remoteStream]);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleAudio = () => {
    const enabled = onToggleAudio();
    setAudioEnabled(enabled);
  };

  const handleToggleVideo = () => {
    const enabled = onToggleVideo();
    setVideoEnabled(enabled);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-xl font-semibold">{otherUser?.fullName || 'Unknown'}</h2>
            <p className="text-sm text-gray-300">
              {remoteStream ? formatDuration(callDuration) : callStatus}
            </p>
          </div>
          <button
            onClick={onEndCall}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative">
        {/* Remote Video (Full Screen) */}
        {callType === 'video' && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {/* Audio Call - Show Profile Image */}
        {callType === 'audio' && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600">
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                {otherUser?.profileImage ? (
                  <img
                    src={otherUser.profileImage}
                    alt={otherUser.fullName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-6xl text-white">
                    {otherUser?.fullName?.charAt(0) || '?'}
                  </span>
                )}
              </div>
              <h2 className="text-2xl text-white font-semibold mb-2">
                {otherUser?.fullName || 'Unknown'}
              </h2>
              <p className="text-white/80">
                {remoteStream ? formatDuration(callDuration) : callStatus}
              </p>
            </div>
          </div>
        )}

        {/* Local Video (Picture in Picture) */}
        {callType === 'video' && localStream && (
          <div className="absolute top-20 right-6 w-32 h-40 bg-gray-800 rounded-lg overflow-hidden shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-center gap-6">
          {/* Mute/Unmute */}
          <button
            onClick={handleToggleAudio}
            className={`p-4 rounded-full transition ${
              audioEnabled 
                ? 'bg-white/20 hover:bg-white/30' 
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {audioEnabled ? (
              <Mic className="w-6 h-6 text-white" />
            ) : (
              <MicOff className="w-6 h-6 text-white" />
            )}
          </button>

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="p-5 bg-red-500 rounded-full hover:bg-red-600 transition"
          >
            <Phone className="w-7 h-7 text-white transform rotate-[135deg]" />
          </button>

          {/* Video On/Off (only for video calls) */}
          {callType === 'video' && (
            <button
              onClick={handleToggleVideo}
              className={`p-4 rounded-full transition ${
                videoEnabled 
                  ? 'bg-white/20 hover:bg-white/30' 
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {videoEnabled ? (
                <Video className="w-6 h-6 text-white" />
              ) : (
                <VideoOff className="w-6 h-6 text-white" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
