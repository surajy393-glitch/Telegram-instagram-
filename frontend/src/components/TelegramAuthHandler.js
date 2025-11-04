import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '../utils/authClient';
import { isTelegramWebApp, getTelegramInitData, expandTelegramWebApp } from '../utils/telegramWebApp';
import { setToken, setUser as setUserStorage } from '../utils/authClient';

const TelegramAuthHandler = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleTelegramAuth = async () => {
      // Wait a bit for Telegram SDK to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!isTelegramWebApp()) {
        console.log('Not running in Telegram WebApp - redirecting to landing');
        navigate('/', { replace: true });
        return;
      }

      console.log('✅ Telegram WebApp detected');
      expandTelegramWebApp();

      const initData = getTelegramInitData();
      
      if (!initData) {
        console.error('No initData available');
        setError('Failed to get Telegram data');
        return;
      }

      try {
        console.log('🔐 Authenticating with Telegram WebApp...');
        
        const formData = new FormData();
        formData.append('initData', initData);
        
        const response = await httpClient.post('/auth/telegram-webapp', formData);
        
        if (response.data.success) {
          console.log('✅ Telegram authentication successful');
          
          // Store token and user in Telegram-scoped storage
          setToken(response.data.access_token);
          setUserStorage(response.data.user);
          
          // Call success callback
          if (onAuthSuccess) {
            onAuthSuccess(response.data.user);
          }
          
          // Navigate to home
          setTimeout(() => navigate('/home', { replace: true }), 100);
        }
      } catch (error) {
        console.error('❌ Telegram authentication failed:', error);
        console.error('Error details:', error.response?.data);
        setError(error.response?.data?.detail || 'Authentication failed');
      }
    };

    handleTelegramAuth();
  }, [navigate, onAuthSuccess]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">❌ {error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-pink-600 text-white rounded-full"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Authenticating with Telegram...</p>
        <p className="text-gray-500 text-sm mt-2">Please wait</p>
      </div>
    </div>
  );
};

export default TelegramAuthHandler;
