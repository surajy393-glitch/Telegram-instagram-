// Utility for managing camera/microphone permissions in Telegram WebApp

/**
 * Check if camera/microphone permissions are granted
 */
export async function checkMediaPermissions() {
  try {
    // Try to query permission state
    if (navigator.permissions && navigator.permissions.query) {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' });
      const micPermission = await navigator.permissions.query({ name: 'microphone' });
      
      return {
        camera: cameraPermission.state,
        microphone: micPermission.state,
        granted: cameraPermission.state === 'granted' && micPermission.state === 'granted'
      };
    }
  } catch (error) {
    console.log('Permission query not supported:', error);
  }
  
  // Fallback - check localStorage cache
  const cached = localStorage.getItem('media_permissions_granted');
  return {
    camera: cached ? 'granted' : 'prompt',
    microphone: cached ? 'granted' : 'prompt',
    granted: !!cached
  };
}

/**
 * Pre-request camera/microphone permissions
 * This creates a temporary stream to trigger browser permission prompt
 * Then immediately releases it to save resources
 */
export async function requestMediaPermissions(videoOnly = false) {
  try {
    console.log('🎥 Pre-requesting media permissions...');
    
    // Request minimal quality stream just to get permission
    const constraints = {
      video: true,
      audio: !videoOnly
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Immediately stop all tracks - we just wanted the permission
    stream.getTracks().forEach(track => {
      track.stop();
      console.log(`✅ Permission granted for ${track.kind}, track stopped`);
    });
    
    // Cache permission grant for this session (5 minutes)
    const expiryTime = Date.now() + (5 * 60 * 1000);
    localStorage.setItem('media_permissions_granted', expiryTime.toString());
    
    return {
      success: true,
      message: 'Camera and microphone access granted'
    };
    
  } catch (error) {
    console.error('❌ Permission request failed:', error);
    
    // Clear any cached permission
    localStorage.removeItem('media_permissions_granted');
    
    if (error.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'denied',
        message: 'Camera/microphone access denied. Please allow access in browser settings.'
      };
    } else if (error.name === 'NotFoundError') {
      return {
        success: false,
        error: 'not_found',
        message: 'No camera or microphone found. Please connect a device.'
      };
    } else {
      return {
        success: false,
        error: 'unknown',
        message: error.message || 'Failed to access camera/microphone'
      };
    }
  }
}

/**
 * Check if cached permission is still valid
 */
export function hasValidPermissionCache() {
  const cached = localStorage.getItem('media_permissions_granted');
  if (!cached) return false;
  
  const expiryTime = parseInt(cached, 10);
  const now = Date.now();
  
  if (now > expiryTime) {
    // Cache expired
    localStorage.removeItem('media_permissions_granted');
    return false;
  }
  
  return true;
}

/**
 * Clear permission cache
 */
export function clearPermissionCache() {
  localStorage.removeItem('media_permissions_granted');
  console.log('🧹 Permission cache cleared');
}
