# API Pattern Migration Tracker

## Status: 🟡 Ready to Start

### Files Needing Migration (14 total)

#### Priority 1 - Authentication (CRITICAL)
- [ ] `/app/frontend/src/pages/LoginPage.js` - Lines 11, 73, 127, 177, 218, 256, 294, 327, 355
- [ ] `/app/frontend/src/pages/RegisterPage.js` - Line 18
- [ ] `/app/frontend/src/components/TelegramAuthHandler.js` - Lines 7, 41

#### Priority 2 - Core Features (HIGH)
- [ ] `/app/frontend/src/pages/HomePage.js` - Line 24
- [ ] `/app/frontend/src/pages/FeedPage.js` - Line 8
- [ ] `/app/frontend/src/pages/ProfilePage.js` - Line 24
- [ ] `/app/frontend/src/pages/MyProfilePage.js` - Line 11

#### Priority 3 - Secondary Features (MEDIUM)
- [ ] `/app/frontend/src/pages/NotificationsPage.js` - Line 7
- [ ] `/app/frontend/src/pages/StoriesPage.js` - Line 6
- [ ] `/app/frontend/src/pages/DatingRegisterPage.js` - Line 10
- [ ] `/app/frontend/src/components/VibeCompatibility.js` - Line 4

#### Priority 4 - Legacy/Unused (LOW)
- [ ] `/app/frontend/src/pages/ChatPage_OLD.js` - Line 15 (Consider deleting if unused)

### Migration Progress
- **Completed**: 0/14 (0%)
- **In Progress**: 0/14
- **Remaining**: 14/14

### Next Steps
1. Start with Priority 1 (Authentication files)
2. Test each file after migration
3. Update this tracker as you complete each file
4. Run full test suite after each priority level

### Testing Checklist (After Each Migration)
- [ ] Login via username/password works
- [ ] Login via Telegram works
- [ ] Protected routes require authentication
- [ ] Token persists across page refreshes
- [ ] Logout clears token properly
- [ ] 401 errors trigger automatic logout

### Migration Instructions

For each file:
1. Backup: `cp [file] [file].backup`
2. Remove: `const API = "/api";`
3. Update import: `import { httpClient } from '@/utils/authClient';`
4. Replace: `axios.post(\`${API}/endpoint\`)` → `httpClient.post('/endpoint')`
5. Test thoroughly using checklist above
6. Mark as complete in this tracker

### Rollback Procedure
If migration breaks functionality:
```bash
cp [file].backup [file]
cd /app/frontend && npm run build
sudo supervisorctl restart frontend
```

Last Updated: Not started yet
