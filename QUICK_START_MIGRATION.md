# 🚀 Quick Start: API Pattern Migration

## What's This About?

Your app currently has **two different ways** of making API calls:
1. ❌ **Old way**: `const API = "/api"; axios.post(\`${API}/login\`)`
2. ✅ **New way**: `httpClient.post('/login')` (with automatic auth)

This causes confusion and makes maintenance harder. We're standardizing on the **new way**.

## 30-Minute Setup (Do This First)

### ✅ Step 1: Verify Documentation Created (2 min)
```bash
ls -la /app/*.md | grep -E "API_CONTRACT|DEVELOPMENT_GUIDE|MIGRATION_TRACKER|ROLLBACK"
```

You should see:
- API_CONTRACT.md
- DEVELOPMENT_GUIDE.md
- MIGRATION_TRACKER.md
- ROLLBACK_PROCEDURE.md

### ✅ Step 2: Read the Guides (15 min)
```bash
# Read these in order:
cat /app/API_CONTRACT.md          # Learn the correct pattern
cat /app/DEVELOPMENT_GUIDE.md     # Learn the rules
cat /app/MIGRATION_TRACKER.md     # See what needs to be done
```

### ✅ Step 3: Add Startup Validation (5 min)
```bash
# Check if validation file exists
ls -la /app/frontend/src/utils/startupValidation.js

# If it exists, you're good!
# The validation will run automatically when the app starts
```

### ✅ Step 4: Understand the Rollback (5 min)
```bash
cat /app/ROLLBACK_PROCEDURE.md
```

### ✅ Step 5: Review Current State (3 min)
```bash
# See all files that need migration
grep -r "const API = " /app/frontend/src --include="*.js" | wc -l

# Should show 14 files
```

## Your First Migration (1 Hour)

### Example: LoginPage.js

**Step 1: Backup**
```bash
cp /app/frontend/src/pages/LoginPage.js /app/frontend/src/pages/LoginPage.js.backup
```

**Step 2: Open the file and make these changes:**

**BEFORE:**
```javascript
import axios from "axios";
import { setToken } from "@/utils/authClient";

const API = "/api";

// Later...
const response = await axios.post(`${API}/auth/login`, formData);
```

**AFTER:**
```javascript
import { httpClient, setToken } from "@/utils/authClient";

// Remove: const API = "/api";
// Remove: import axios from "axios";

// Later...
const response = await httpClient.post('/auth/login', formData);
```

**Step 3: Find and replace ALL occurrences:**
- `axios.post(\`${API}/` → `httpClient.post('/`
- `axios.get(\`${API}/` → `httpClient.get('/`
- Remove the closing backtick and replace with `'`

**Step 4: Test**
```bash
# Rebuild
cd /app/frontend
npm run build

# Restart
sudo supervisorctl restart frontend

# Test login manually:
# 1. Go to login page
# 2. Try username/password login
# 3. Try Telegram login
# 4. Verify both work
```

**Step 5: If it works, update tracker:**
```bash
# Edit /app/MIGRATION_TRACKER.md
# Change [ ] to [x] for LoginPage.js
```

**Step 6: If it breaks, rollback:**
```bash
cp /app/frontend/src/pages/LoginPage.js.backup /app/frontend/src/pages/LoginPage.js
cd /app/frontend && npm run build
sudo supervisorctl restart frontend
```

## Migration Order (Do in This Sequence)

### Week 1: Priority 1 - Authentication (CRITICAL)
1. LoginPage.js
2. RegisterPage.js
3. TelegramAuthHandler.js

**Why first?** If auth breaks, nothing works.

### Week 2: Priority 2 - Core Features
4. HomePage.js
5. FeedPage.js
6. ProfilePage.js
7. MyProfilePage.js

**Why second?** These are the most-used features.

### Week 3: Priority 3 - Secondary Features
8. NotificationsPage.js
9. StoriesPage.js
10. DatingRegisterPage.js
11. VibeCompatibility.js

**Why third?** Less critical, can be done carefully.

### Week 4: Cleanup
12. Review ChatPage_OLD.js (delete if unused)
13. Remove all .backup files
14. Final testing

## Testing Checklist (After EACH File)

```
[ ] App compiles without errors
[ ] Login via username/password works
[ ] Login via Telegram works
[ ] Feed loads correctly
[ ] Profile page accessible
[ ] Can create posts
[ ] Can like/comment
[ ] Logout works
[ ] No console errors
```

## Red Flags (Stop and Rollback If You See These)

- ❌ "Cannot find module 'httpClient'"
- ❌ "Unexpected token" errors
- ❌ Login page shows blank screen
- ❌ "Network Error" on all API calls
- ❌ Token not persisting after login

**If you see any of these:** Use ROLLBACK_PROCEDURE.md immediately!

## Success Criteria

You're done when:
- ✅ All 14 files migrated
- ✅ No `const API = "/api"` in codebase
- ✅ All features working
- ✅ All tests passing
- ✅ Documentation updated

## Need Help?

1. Check `/app/API_CONTRACT.md` for examples
2. Check `/app/DEVELOPMENT_GUIDE.md` for rules
3. Check `/app/ROLLBACK_PROCEDURE.md` if broken
4. Search for existing examples: `grep -r "httpClient" /app/frontend/src`

## Pro Tips

- ✅ **Do**: Migrate one file at a time
- ✅ **Do**: Test after each file
- ✅ **Do**: Keep backups until everything works
- ❌ **Don't**: Migrate multiple files at once
- ❌ **Don't**: Skip testing
- ❌ **Don't**: Delete backups too early

Good luck! 🚀
