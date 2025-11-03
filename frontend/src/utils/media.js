// Utility functions for constructing correct media URLs across the app

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

/** Normalize a raw media URL returned from the backend. */
export function getMediaSrc(url) {
  if (!url) return '';
  
  // Absolute URLs (http/https) and data URIs should be returned unchanged
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) {
    return url;
  }
  
  let path = url;
  
  // Ensure path starts with a single slash
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  
  // Prepend backend URL if provided (e.g. production domain)
  if (BACKEND_URL) {
    return `${BACKEND_URL}${path}`;
  }
  return path;
}

/**
 * Determine the appropriate media URL for a post.
 *
 * Posts may originate from different backend endpoints. Posts created via
 * `/api/posts/create` often include a `telegramFileId` alongside a
 * `mediaUrl` pointing directly at Telegram's CDN. Loading Telegram URLs
 * from the browser can trigger CORS errors or playback issues. When a
 * `telegramFileId` exists, this helper constructs a proxy URL
 * (`/api/media/{fileId}`) which serves the media through our backend.
 * Only if no Telegram ID is present does the helper fall back to the
 * `mediaUrl` or `imageUrl` fields.
 *
 * The selected URL is then normalized via `getMediaSrc()` to handle
 * relative upload paths and optional backend domain configuration.
 */
export function getPostMediaUrl(post) {
  if (!post) return null;
  
  // Proxy Telegram-hosted media via our backend
  if (post.telegramFileId) {
    return getMediaSrc(`/api/media/${post.telegramFileId}`);
  }
  
  let url = null;
  // Prefer the `mediaUrl` field when present and non-empty
  if (post.mediaUrl && typeof post.mediaUrl === 'string' && post.mediaUrl.trim().length > 0) {
    url = post.mediaUrl;
  } else if (post.imageUrl && typeof post.imageUrl === 'string' && post.imageUrl.trim().length > 0) {
    // Legacy posts fallback to `imageUrl`
    url = post.imageUrl;
  }
  
  return url ? getMediaSrc(url) : null;
}
