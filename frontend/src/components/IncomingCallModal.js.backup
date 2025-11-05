import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';

const IncomingCallModal = ({ 
  isOpen, 
  callType,
  callerUser,
  onAccept,
  onReject 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-pulse">
        {/* Caller Info */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 ring-4 ring-white/30">
            {callerUser?.profileImage ? (
              <img
                src={callerUser.profileImage}
                alt={callerUser.fullName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-4xl text-white">
                {callerUser?.fullName?.charAt(0) || '?'}
              </span>
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            {callerUser?.fullName || 'Unknown'}
          </h2>
          
          <div className="flex items-center justify-center gap-2 text-white/90">
            {callType === 'video' ? (
              <>
                <Video className="w-5 h-5" />
                <span>Incoming Video Call</span>
              </>
            ) : (
              <>
                <Phone className="w-5 h-5" />
                <span>Incoming Voice Call</span>
              </>
            )}
          </div>
        </div>

        {/* Call Actions */}
        <div className="flex items-center justify-center gap-6">
          {/* Reject Button */}
          <button
            onClick={onReject}
            className="p-6 bg-red-500 rounded-full hover:bg-red-600 transition transform hover:scale-110 shadow-lg"
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="p-6 bg-green-500 rounded-full hover:bg-green-600 transition transform hover:scale-110 shadow-lg animate-bounce"
          >
            <Phone className="w-8 h-8 text-white" />
          </button>
        </div>

        <p className="text-center text-white/70 text-sm mt-6">
          Swipe to answer
        </p>
      </div>
    </div>
  );
};

export default IncomingCallModal;
