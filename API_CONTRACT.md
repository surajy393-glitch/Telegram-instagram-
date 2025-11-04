# LuvHive API Communication Standards

## ✅ CORRECT PATTERN - Always Use This

```javascript
import { httpClient } from '@/utils/authClient';

// GET request
const response = await httpClient.get('/posts');

// POST request
const response = await httpClient.post('/auth/login', { username, password });

// PUT request
const response = await httpClient.put('/profile', profileData);

// DELETE request
const response = await httpClient.delete('/posts/123');
```

## ❌ WRONG PATTERN - Never Use This

```javascript
// DON'T DO THIS - No centralized token handling
const API = "/api";
const response = await axios.post(`${API}/auth/login`, data);
```

## Why Use httpClient?

1. **Automatic token injection** - No manual Authorization headers
2. **Automatic 401 handling** - Auto-logout on expired tokens
3. **Centralized configuration** - One place to change baseURL
4. **Telegram-scoped storage** - Proper session isolation

## API Endpoints Reference

### Authentication
- `POST /auth/login` - Username/password login
- `POST /auth/telegram-signin` - Telegram ID login (step 1)
- `POST /auth/verify-telegram-otp` - Telegram OTP verification (step 2)
- `POST /auth/telegram-webapp` - Telegram WebApp auto-login
- `POST /auth/register` - New user registration

### Posts & Feed
- `GET /posts` - Get all posts (feed)
- `POST /posts` - Create new post
- `PUT /posts/{id}` - Update post
- `DELETE /posts/{id}` - Delete post
- `POST /posts/{id}/like` - Like/unlike post
- `POST /posts/{id}/comment` - Add comment

### Profile
- `GET /profile/{username}` - Get user profile
- `PUT /profile` - Update own profile
- `POST /profile/photo` - Upload profile photo
- `POST /profile/banner` - Upload banner photo

### Notifications
- `GET /notifications` - Get user notifications
- `PUT /notifications/{id}/read` - Mark notification as read

### Messages
- `GET /messages` - Get message threads
- `GET /messages/{userId}` - Get conversation with user
- `POST /messages` - Send message

## Migration Checklist

When you see `const API = "/api"` in a file:
1. Remove the `const API = "/api"` line
2. Import httpClient: `import { httpClient } from '@/utils/authClient';`
3. Replace `axios.post(\`${API}/endpoint\`, data)` with `httpClient.post('/endpoint', data)`
4. Remove `import axios from 'axios'` if no longer needed
5. Test the feature thoroughly
