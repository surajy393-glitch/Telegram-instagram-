// Startup validation to catch common configuration issues
export function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Check required environment variables
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  
  if (!backendUrl) {
    warnings.push('REACT_APP_BACKEND_URL not set - using default "/api"');
  } else if (backendUrl.includes('preview.emergentagent.com')) {
    errors.push('⚠️ CRITICAL: REACT_APP_BACKEND_URL contains preview.emergentagent.com - will break in production!');
  } else if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
    warnings.push('REACT_APP_BACKEND_URL points to localhost - only works in development');
  }

  // Check for common anti-patterns in code (development mode only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Development mode - checking for code anti-patterns...');
    // This is just a reminder, actual checking would need build-time tools
    console.log('📋 Remember to check:');
    console.log('  - No "const API = \\"/api\\"" in new files');
    console.log('  - Use httpClient from authClient.js');
    console.log('  - See /app/API_CONTRACT.md for guidelines');
  }

  return { errors, warnings };
}

export function logValidationResults() {
  const { errors, warnings } = validateEnvironment();
  
  if (errors.length > 0) {
    console.error('❌ CONFIGURATION ERRORS:');
    errors.forEach(err => console.error(`  ${err}`));
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ CONFIGURATION WARNINGS:');
    warnings.forEach(warn => console.warn(`  ${warn}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Environment validation passed');
  }
  
  return errors.length === 0;
}
