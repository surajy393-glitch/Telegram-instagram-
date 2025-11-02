// frontend/src/utils/authClient.js

/*
 * Robust token handling for API calls.
 * Ensures tokens never contain extra quotes and always have the "Bearer " prefix.
 * Also stores tokens in a Telegram-scoped key when running inside Telegram.
 */

import axios from 'axios';

function getTelegramUserId() {
  try {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return window.Telegram.WebApp.initDataUnsafe.user.id;
    }
  } catch (e) {
    // Not in Telegram context
  }
  return 'default';
}

// Read the persisted JWT and remove extraneous quotes.
// Only checks Telegram-scoped storage (tg_<id>_token) for strict session isolation.
export function getToken() {
  const telegramUserId = getTelegramUserId();
  const telegramKey = `tg_${telegramUserId}_token`;
  let stored = localStorage.getItem(telegramKey);
  if (!stored) return null;
  return stored.replace(/^"+|"+$/g, '');
}

// Store token in both regular and Telegram-scoped locations.
// If token is null, clears both locations.
export function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
    const telegramUserId = getTelegramUserId();
    const telegramKey = `tg_${telegramUserId}_token`;
    localStorage.setItem(telegramKey, token);
  } else {
    localStorage.removeItem('token');
    const telegramUserId = getTelegramUserId();
    const telegramKey = `tg_${telegramUserId}_token`;
    localStorage.removeItem(telegramKey);
  }
}

// Create an axios instance that automatically adds Authorization header.
// Handles 401 responses globally by removing invalid tokens and redirecting to login.
export function createHttpClient(
  baseURL = process.env.REACT_APP_BACKEND_URL || '/api',
) {
  const http = axios.create({ baseURL });

  http.interceptors.request.use(
    (config) => {
      const token = getToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  http.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        const telegramUserId = getTelegramUserId();
        const telegramKey = `tg_${telegramUserId}_token`;
        const telegramUserKey = `tg_${telegramUserId}_user`;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem(telegramKey);
        localStorage.removeItem(telegramUserKey);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    },
  );

  return http;
}

// Default configured instance
export const httpClient = createHttpClient();
