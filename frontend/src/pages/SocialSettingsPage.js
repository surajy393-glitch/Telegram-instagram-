import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Lock, Eye, Heart, MessageCircle, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import axios from 'axios';

const API = "/api";

const SocialSettingsPage = ({ user, onLogout }) => {
  const navigate = useNavigate();
  // Fetch from env; fallback to empty string if not set
  const BOT_USERNAME = process.env.REACT_APP_TELEGRAM_BOT_USERNAME || "Loveekisssbot";
  
  // Multi-tier premium invoice slugs (store slugs only, construct URLs in JS)
  const PREMIUM_INVOICE_SLUGS = {
    '1week': process.env.REACT_APP_PREMIUM_INVOICE_SLUG_1WEEK || "",
    '1month': process.env.REACT_APP_PREMIUM_INVOICE_SLUG_1MONTH || "",
    '6months': process.env.REACT_APP_PREMIUM_INVOICE_SLUG_6MONTHS || "",
    '12months': process.env.REACT_APP_PREMIUM_INVOICE_SLUG_12MONTHS || ""
  };
  
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [settings, setSettings] = useState({
    privateProfile: false,
    allowAnonymousMessages: true,
    showOnlineStatus: true,
    allowStoryReplies: true,
    notifyOnLikes: true,
    notifyOnComments: true,
    notifyOnFollows: true,
  });
  const [loading, setLoading] = useState(true);

  // Fetch user settings on mount
  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Map backend settings to frontend state
      setSettings({
        privateProfile: response.data.isPrivate || false,
        allowAnonymousMessages: response.data.allowDirectMessages !== false,
        showOnlineStatus: response.data.showOnlineStatus !== false,
        allowStoryReplies: response.data.allowStoryReplies !== false,
        notifyOnLikes: response.data.pushNotifications !== false,
        notifyOnComments: response.data.pushNotifications !== false,
        notifyOnFollows: response.data.pushNotifications !== false,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key) => {
    const newValue = !settings[key];
    
    // Optimistically update UI
    setSettings({ ...settings, [key]: newValue });
    
    try {
      const token = localStorage.getItem('token');
      
      // Map frontend setting key to backend setting key
      const settingMap = {
        privateProfile: 'isPrivate',
        allowAnonymousMessages: 'allowDirectMessages',
        showOnlineStatus: 'showOnlineStatus',
        allowStoryReplies: 'allowStoryReplies',
        notifyOnLikes: 'pushNotifications',
        notifyOnComments: 'pushNotifications',
        notifyOnFollows: 'pushNotifications',
      };
      
      const backendKey = settingMap[key];
      
      // Save to backend
      await axios.put(`${API}/auth/settings`, 
        { [backendKey]: newValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log(`Setting ${key} updated to ${newValue}`);
    } catch (error) {
      console.error('Error updating setting:', error);
      // Revert on error
      setSettings({ ...settings, [key]: !newValue });
      alert('Failed to update settings. Please try again.');
    }
  };

  const handleBuyPremiumTier = (tier) => {
    const tg = window.Telegram?.WebApp;
    const canOpenInvoice = tg && typeof tg.openInvoice === "function";
    const invoiceSlug = PREMIUM_INVOICE_SLUGS[tier];

    // Debug logging
    console.log("=== Premium Purchase Debug ===");
    console.log("Tier:", tier);
    console.log("Telegram WebApp exists:", !!window.Telegram?.WebApp);
    console.log("openInvoice available:", canOpenInvoice);
    console.log("Invoice Slug:", invoiceSlug);

    // Validate slug
    if (!invoiceSlug) {
      console.error("Invalid invoice slug for tier:", tier);
      alert("Payment configuration error. Please contact support.");
      return;
    }

    // Build proper Telegram Stars invoice URL: https://t.me/$/invoice/<slug>
    const invoiceUrl = `https://t.me/$/invoice/${invoiceSlug}`;
    console.log("Constructed Invoice URL:", invoiceUrl);

    // If inside Telegram and we have a valid invoice URL
    if (canOpenInvoice && invoiceUrl) {
      try {
        // Telegram Stars uses openInvoice with URL string (not object)
        console.log("Calling openInvoice with URL:", invoiceUrl);
        tg.openInvoice(invoiceUrl, (status) => {
          console.log("Payment status:", status);
          // status can be 'paid', 'cancelled', or 'failed'
          if (status === "paid") {
            // Refresh to re-fetch isPremium from /auth/me
            window.location.reload();
          } else if (status === "cancelled") {
            alert("Payment was cancelled. You can try again.");
          } else if (status === "failed") {
            alert("Payment failed. Please try again later.");
          }
        });
        return;
      } catch (err) {
        console.error("openInvoice error:", err);
        alert(`Error opening payment: ${err.message}`);
      }
    } else {
      console.log("Falling back to bot link - openInvoice not available");
    }

    // Fallback: open bot purchase link in new tab
    window.open(`https://t.me/${BOT_USERNAME}?start=premium_web`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-pink-600"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Social Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* LuvHive Verified Button */}
        <button
          onClick={() => navigate('/verification-status')}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg shadow-md p-4 flex items-center justify-between transition-all"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg">LuvHive Verified</h3>
              <p className="text-sm text-blue-100">Get your verification badge</p>
            </div>
          </div>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Premium Button */}
        <button
          onClick={() => setPremiumDialogOpen(true)}
          className="w-full bg-white border border-pink-200 rounded-lg shadow-md p-4 flex items-center justify-between hover:bg-pink-50 transition"
        >
          <div className="flex items-center space-x-3">
            <Zap className="text-pink-600" size={24} />
            <div className="text-left">
              <h3 className="font-semibold text-lg text-gray-800">Premium</h3>
              <p className="text-sm text-pink-600">See benefits & pricing</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Privacy Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Lock className="text-pink-600" size={24} />
            <h2 className="text-lg font-semibold">Privacy</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Private Profile</h3>
                <p className="text-sm text-gray-500">Only followers can see your posts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.privateProfile}
                  onChange={() => handleToggle('privateProfile')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Show Online Status</h3>
                <p className="text-sm text-gray-500">Let others see when you're active</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showOnlineStatus}
                  onChange={() => handleToggle('showOnlineStatus')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Posts & Stories */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Eye className="text-pink-600" size={24} />
            <h2 className="text-lg font-semibold">Posts & Stories</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Allow Story Replies</h3>
                <p className="text-sm text-gray-500">Anyone can reply to your stories</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowStoryReplies}
                  onChange={() => handleToggle('allowStoryReplies')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Anonymous Messages</h3>
                <p className="text-sm text-gray-500">Receive anonymous messages</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowAnonymousMessages}
                  onChange={() => handleToggle('allowAnonymousMessages')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Bell className="text-pink-600" size={24} />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Heart size={20} className="text-gray-400" />
                <div>
                  <h3 className="font-medium">Likes</h3>
                  <p className="text-sm text-gray-500">When someone likes your post</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnLikes}
                  onChange={() => handleToggle('notifyOnLikes')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageCircle size={20} className="text-gray-400" />
                <div>
                  <h3 className="font-medium">Comments</h3>
                  <p className="text-sm text-gray-500">When someone comments</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnComments}
                  onChange={() => handleToggle('notifyOnComments')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <User size={20} className="text-gray-400" />
                <div>
                  <h3 className="font-medium">New Followers</h3>
                  <p className="text-sm text-gray-500">When someone follows you</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnFollows}
                  onChange={() => handleToggle('notifyOnFollows')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* Premium Dialog */}
      <Dialog open={premiumDialogOpen} onOpenChange={setPremiumDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">👑 Premium Membership</DialogTitle>
            <DialogDescription className="text-center">
              Choose your premium duration
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {/* Premium Benefits */}
            <div className="bg-pink-50 p-3 rounded-lg mb-4">
              <h3 className="font-semibold text-pink-900 mb-2">Premium Features:</h3>
              <ul className="text-sm text-pink-800 space-y-1">
                <li>✨ Start unlimited conversations</li>
                <li>📸 Send photos, videos & voice notes</li>
                <li>✓ Read receipts & typing indicators</li>
                <li>⭐ Priority placement in message requests</li>
                <li>🎯 Gender, age & city filters (bot)</li>
              </ul>
            </div>

            {/* 1 Week Tier */}
            <button
              onClick={() => handleBuyPremiumTier('1week')}
              className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <div className="font-bold text-lg">1 Week</div>
                  <div className="text-sm opacity-90">100 Stars / $1.99</div>
                </div>
                <div className="text-2xl">⚡</div>
              </div>
            </button>

            {/* 1 Month Tier */}
            <button
              onClick={() => handleBuyPremiumTier('1month')}
              className="w-full p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <div className="font-bold text-lg">1 Month</div>
                  <div className="text-sm opacity-90">250 Stars / $3.99</div>
                </div>
                <div className="text-2xl">🔥</div>
              </div>
            </button>

            {/* 6 Months Tier */}
            <button
              onClick={() => handleBuyPremiumTier('6months')}
              className="w-full p-4 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <div className="font-bold text-lg">6 Months</div>
                  <div className="text-sm opacity-90">600 Stars / $9.99</div>
                </div>
                <div className="text-2xl">💎</div>
              </div>
            </button>

            {/* 12 Months Tier */}
            <button
              onClick={() => handleBuyPremiumTier('12months')}
              className="w-full p-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <div className="font-bold text-lg">12 Months</div>
                  <div className="text-sm opacity-90">1000 Stars / $19.99</div>
                </div>
                <div className="text-2xl">👑</div>
              </div>
            </button>

            {/* Fallback Link */}
            <div className="pt-2 text-center">
              <a
                href={`https://t.me/${BOT_USERNAME}?start=premium_web`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Or open in Telegram
              </a>
            </div>

            <p className="text-xs text-gray-400 text-center pt-2">
              Payments are processed via Telegram Stars. Premium status syncs across both bot and webapp.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SocialSettingsPage;
