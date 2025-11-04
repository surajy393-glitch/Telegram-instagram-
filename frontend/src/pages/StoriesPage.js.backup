import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, X, Eye, ArrowLeft, Image as ImageIcon } from 'lucide-react';

const API = '/api';

const StoriesPage = ({ user }) => {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [newStory, setNewStory] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [viewingStory, setViewingStory] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  useEffect(() => {
    if (user) {
      fetchStories();
    }
  }, [user]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/social/stories?userId=${user.id}&limit=50`);
      if (response.data.success) {
        setStories(response.data.stories);
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = async () => {
    // Allow story with just image (no caption required)
    if (!newStory.trim() && !selectedImage) {
      alert('Please add some content or an image');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('content', newStory || 'Story image');  // Default text if empty
      formData.append('userId', user.id);
      formData.append('storyType', selectedImage ? 'image' : 'text');
      formData.append('isAnonymous', isAnonymous);
      
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const response = await axios.post(`${API}/social/stories`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setNewStory('');
        setSelectedImage(null);
        setIsAnonymous(false);
        setShowCreateStory(false);
        fetchStories();
      }
    } catch (error) {
      console.error('Error creating story:', error);
      alert('Failed to create story');
    }
  };

  const viewStory = async (story, index) => {
    setViewingStory(story);
    setCurrentStoryIndex(index);

    // Mark as viewed
    try {
      const formData = new FormData();
      formData.append('userId', user.id);
      await axios.post(`${API}/social/stories/${story.id}/view`, formData);
      
      // Update local state
      setStories(stories.map(s => 
        s.id === story.id 
          ? { ...s, userViewed: true, views: s.views + (s.userViewed ? 0 : 1) }
          : s
      ));
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const nextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      viewStory(stories[currentStoryIndex + 1], currentStoryIndex + 1);
    } else {
      setViewingStory(null);
    }
  };

  const prevStory = () => {
    if (currentStoryIndex > 0) {
      viewStory(stories[currentStoryIndex - 1], currentStoryIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-pink-600"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Stories
            </h1>
          </div>
          <button
            onClick={() => setShowCreateStory(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600"
          >
            <Plus size={20} />
            <span>Create Story</span>
          </button>
        </div>
      </div>

      {/* Stories Grid */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {stories.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500 mb-4">No stories yet. Be the first to share!</p>
            <button
              onClick={() => setShowCreateStory(true)}
              className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg"
            >
              Create First Story
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stories.map((story, index) => (
              <div
                key={story.id}
                onClick={() => viewStory(story, index)}
                className="relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer group"
              >
                {story.imageUrl ? (
                  <img
                    src={story.imageUrl}
                    alt="Story"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center p-4">
                    <p className="text-white text-center font-semibold">{story.content}</p>
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                
                {/* User Info */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                      {story.isAnonymous ? '?' : story.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">
                        {story.isAnonymous ? 'Anonymous' : story.username}
                      </p>
                      <p className="text-white/80 text-xs">{story.timeAgo}</p>
                    </div>
                  </div>
                  
                  {/* Views */}
                  <div className="flex items-center space-x-1 text-white/90 text-xs">
                    <Eye size={14} />
                    <span>{story.views}</span>
                  </div>
                </div>

                {/* Viewed Indicator */}
                {story.userViewed && (
                  <div className="absolute top-2 right-2 w-3 h-3 bg-pink-500 rounded-full border-2 border-white"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Story Modal */}
      {showCreateStory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Create Story</h2>
              <button
                onClick={() => {
                  setShowCreateStory(false);
                  setNewStory('');
                  setSelectedImage(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <textarea
              value={newStory}
              onChange={(e) => setNewStory(e.target.value)}
              placeholder="Share something on your mind..."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 resize-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              rows="4"
            />

            {selectedImage && (
              <div className="mb-4 relative">
                <img
                  src={URL.createObjectURL(selectedImage)}
                  alt="Preview"
                  className="w-full rounded-lg max-h-64 object-cover"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center space-x-2 cursor-pointer text-gray-600 hover:text-pink-600">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedImage(e.target.files[0])}
                  className="hidden"
                />
                <ImageIcon size={20} />
                <span>Add Photo</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Post Anonymously</span>
              </label>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Stories disappear after 24 hours
            </p>

            <button
              onClick={handleCreateStory}
              disabled={!newStory.trim() && !selectedImage}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              Share Story
            </button>
          </div>
        </div>
      )}

      {/* Story Viewer */}
      {viewingStory && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button
            onClick={() => setViewingStory(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X size={32} />
          </button>

          {/* Navigation */}
          {currentStoryIndex > 0 && (
            <button
              onClick={prevStory}
              className="absolute left-4 text-white hover:text-gray-300 z-10"
            >
              <ArrowLeft size={32} />
            </button>
          )}
          
          {currentStoryIndex < stories.length - 1 && (
            <button
              onClick={nextStory}
              className="absolute right-4 text-white hover:text-gray-300 z-10"
            >
              <ArrowLeft size={32} className="rotate-180" />
            </button>
          )}

          {/* Story Content */}
          <div className="max-w-md w-full h-full flex flex-col">
            {/* Progress Bar */}
            <div className="flex space-x-1 p-2">
              {stories.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full ${
                    index < currentStoryIndex ? 'bg-white' :
                    index === currentStoryIndex ? 'bg-white' :
                    'bg-white/30'
                  }`}
                ></div>
              ))}
            </div>

            {/* Story Image/Text */}
            <div className="flex-1 flex items-center justify-center p-4">
              {viewingStory.imageUrl ? (
                <img
                  src={viewingStory.imageUrl}
                  alt="Story"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <div className="bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg p-8 max-w-md">
                  <p className="text-white text-2xl font-semibold text-center">
                    {viewingStory.content}
                  </p>
                </div>
              )}
            </div>

            {/* Story Info */}
            <div className="p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {viewingStory.isAnonymous ? '?' : viewingStory.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {viewingStory.isAnonymous ? 'Anonymous' : viewingStory.username}
                    </p>
                    <p className="text-sm text-white/80">{viewingStory.timeAgo}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Eye size={20} />
                  <span>{viewingStory.views}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoriesPage;
