# Emergency Rollback Procedure

## When to Use This
- Migration breaks login functionality
- App won't compile after changes
- Features stop working after migration
- Any critical error in production

## Quick Rollback (Single File)

```bash
# Step 1: Identify the broken file
# Example: LoginPage.js

# Step 2: Restore from backup
cp /app/frontend/src/pages/LoginPage.js.backup /app/frontend/src/pages/LoginPage.js

# Step 3: Rebuild
cd /app/frontend
npm run build

# Step 4: Restart frontend
sudo supervisorctl restart frontend

# Step 5: Verify
curl http://localhost:3000 | grep -i "luvhive"
```

## Full Rollback (Multiple Files)

```bash
# Step 1: Stop frontend
sudo supervisorctl stop frontend

# Step 2: Restore all backups
cd /app/frontend/src/pages
for file in *.backup; do
  cp "$file" "${file%.backup}"
done

cd /app/frontend/src/components
for file in *.backup; do
  cp "$file" "${file%.backup}"
done

# Step 3: Clear cache and rebuild
cd /app/frontend
rm -rf node_modules/.cache
rm -rf build
npm run build

# Step 4: Restart
sudo supervisorctl start frontend

# Step 5: Verify all features
# - Login works
# - Feed loads
# - Profile accessible
```

## Nuclear Option (Complete Reset)

```bash
# Only use if everything is broken
cd /app/frontend

# Restore from git (if using version control)
git checkout -- src/

# Or restore from a known good state
# (Make sure you have a backup!)

# Rebuild everything
rm -rf node_modules
npm install
npm run build

# Restart
sudo supervisorctl restart frontend
```

## Verification Checklist

After rollback, verify:
- [ ] App loads without errors
- [ ] Login page accessible
- [ ] Can login with username/password
- [ ] Can login with Telegram
- [ ] Feed page loads
- [ ] Profile page loads
- [ ] No console errors

## Prevention

Before making changes:
1. Always create backups: `cp file.js file.js.backup`
2. Test in development first
3. Migrate one file at a time
4. Keep MIGRATION_TRACKER.md updated
5. Have this rollback procedure ready
