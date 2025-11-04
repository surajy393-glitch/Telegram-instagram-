# LuvHive Development Guide

## 🎯 Golden Rules

### 1. API Communication
- **ALWAYS** use `httpClient` from `@/utils/authClient`
- **NEVER** create new axios instances
- **NEVER** hardcode `const API = "/api"`

### 2. Token Management
- **ALWAYS** use `setToken()` and `getToken()` from authClient
- **NEVER** access localStorage directly for tokens
- Tokens are automatically Telegram-scoped

### 3. User Data Storage
- **ALWAYS** use `setUser()` and `getUser()` from authClient
- **NEVER** access localStorage directly for user data
- User data is automatically Telegram-scoped

## 🔧 Common Tasks

### Adding a New API Endpoint

```javascript
// ✅ CORRECT
import { httpClient } from '@/utils/authClient';

const handleNewFeature = async () => {
  try {
    const response = await httpClient.post('/new-endpoint', { data });
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error.response?.data?.detail);
  }
};
```

### Handling Authentication

```javascript
// ✅ CORRECT - Login flow
import { setToken, setUser } from '@/utils/authClient';

const handleLogin = async (credentials) => {
  const response = await httpClient.post('/auth/login', credentials);
  setToken(response.data.access_token);
  setUser(response.data.user);
  navigate('/home');
};
```

### Making Authenticated Requests

```javascript
// ✅ CORRECT - Token automatically added
import { httpClient } from '@/utils/authClient';

const fetchUserData = async () => {
  // No need to manually add Authorization header
  const response = await httpClient.get('/profile/me');
  return response.data;
};
```

## 🚫 Anti-Patterns to Avoid

### ❌ Don't Create New Axios Instances
```javascript
// WRONG
const api = axios.create({ baseURL: '/api' });
```

### ❌ Don't Hardcode API Paths
```javascript
// WRONG
const API = "/api";
axios.post(`${API}/login`, data);
```

### ❌ Don't Manually Add Auth Headers
```javascript
// WRONG
axios.post('/api/posts', data, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### ❌ Don't Access localStorage Directly
```javascript
// WRONG
localStorage.setItem('token', token);
const token = localStorage.getItem('token');
```

## 📝 Code Review Checklist

Before submitting code, verify:
- [ ] No `const API = "/api"` declarations
- [ ] No direct axios imports (except in authClient.js)
- [ ] No direct localStorage access for tokens/user data
- [ ] All API calls use `httpClient`
- [ ] All token operations use `setToken()`/`getToken()`
- [ ] All user data operations use `setUser()`/`getUser()`

## 🧪 Testing After Changes

After modifying any API-related code, test:
1. Login via username/password
2. Login via Telegram
3. View feed (requires auth)
4. View profile (requires auth)
5. Create post (requires auth)
6. Logout and verify token cleared
7. Try accessing protected route without login (should redirect)

## 📚 File Structure

```
/app/frontend/src/
├── utils/
│   └── authClient.js          # ✅ ONLY place for axios config
├── pages/
│   ├── LoginPage.js           # 🔄 Needs migration
│   ├── HomePage.js            # 🔄 Needs migration
│   └── ...                    # 🔄 Check each file
└── components/
    └── ...                    # 🔄 Check each file
```

## 🆘 When in Doubt

1. Check `/app/API_CONTRACT.md` for endpoint reference
2. Look at `authClient.js` for token/user utilities
3. Search codebase for existing examples: `grep -r "httpClient" /app/frontend/src`
4. Test in Telegram WebApp context if feature is Telegram-related
