import React, { useState } from 'react';
import { X } from 'lucide-react';

const DeleteChatDialog = ({ isOpen, onClose, onConfirm, otherUserName }) => {
  const [deleteForBoth, setDeleteForBoth] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(deleteForBoth);
    setDeleteForBoth(false);
  };

  const handleClose = () => {
    setDeleteForBoth(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Delete chat</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-300 text-base mb-6">
            Permanently delete the chat with <span className="font-semibold text-white">{otherUserName}</span>?
          </p>

          {/* Checkbox */}
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteForBoth}
              onChange={(e) => setDeleteForBoth(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-700 checked:bg-pink-500 checked:border-pink-500 cursor-pointer focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            />
            <span className="text-gray-300 text-base">
              Also delete for <span className="font-medium text-white">{otherUserName}</span>
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end gap-4">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 text-blue-400 font-medium rounded-lg hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-pink-500 text-white font-medium rounded-lg hover:bg-pink-600 transition"
          >
            Delete chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteChatDialog;
