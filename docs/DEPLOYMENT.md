# Deployment Guide

## GitHub Pages Deployment

The Marathon Training Tracker is configured for automatic deployment to GitHub Pages.

### Automatic Deployment

**Every push to `main` branch automatically triggers deployment via GitHub Actions.**

The workflow:
1. Builds the app with Vite
2. Uploads build artifacts
3. Deploys to GitHub Pages
4. App available at: `https://wandersoncferreira.github.io/marathon-tracker/`

### Setup (One-Time)

#### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select:
   - Source: **GitHub Actions**
   - (No need to select a branch when using Actions)
4. Click **Save**

#### 2. Verify Workflow Permissions

1. Go to **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, ensure:
   - ✅ "Read and write permissions" is selected
   - ✅ "Allow GitHub Actions to create and approve pull requests" is checked
3. Click **Save**

### Deployment Process

#### Automatic (Recommended)

Simply push to main:

```bash
git add .
git commit -m "Your changes"
git push
```

GitHub Actions will automatically:
- Install dependencies
- Build the app
- Deploy to GitHub Pages

#### Manual Trigger

You can also manually trigger deployment:

1. Go to **Actions** tab in GitHub
2. Select **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

### Verifying Deployment

#### Check Workflow Status

1. Go to **Actions** tab in GitHub
2. Click on the most recent workflow run
3. Verify all steps completed successfully:
   - ✅ Checkout
   - ✅ Setup Node
   - ✅ Install dependencies
   - ✅ Build
   - ✅ Upload artifact
   - ✅ Deploy to GitHub Pages

#### Test the Deployment

Visit your app:
```
https://wandersoncferreira.github.io/marathon-tracker/
```

Expected behavior:
- ✅ App loads without errors
- ✅ All tabs work (Dashboard, Log, Coach, Progress, Settings)
- ✅ Can configure API settings
- ✅ Database auto-imports if JSON file present

### Database Auto-Import

The app will automatically import the database on first load if:
- ✅ `public/database/marathon-tracker-db.json` exists in the repository
- ✅ Local browser IndexedDB is empty (first visit or cleared cache)

#### Including Database in Deployment

**To deploy with pre-populated database:**

1. Export database locally:
   ```bash
   # Open app: http://localhost:3000
   # Settings → Database Sync
   # Click "📤 Export Database to JSON"
   # Save as: public/database/marathon-tracker-db.json
   ```

2. Commit and push:
   ```bash
   git add public/database/marathon-tracker-db.json
   git commit -m "Add database for auto-import"
   git push
   ```

3. Deployment will include the database file
4. Users visiting the app will auto-import on first load

**Warning**: Database files are large (~400 MB). Consider:
- Use Git LFS for large files
- Or provide manual import instructions instead

### Build Configuration

The app is configured in `vite.config.js`:

```javascript
export default defineConfig({
  base: '/marathon-tracker/', // GitHub Pages subfolder
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

**Important**: The `base` path must match your repository name.

### Deployment Workflow File

Located at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    # Checkout, install, build, upload
  deploy:
    # Deploy to GitHub Pages
```

### Troubleshooting

#### Deployment Fails: Permission Denied

**Cause**: GitHub Actions doesn't have Pages permissions

**Solution**:
1. Settings → Actions → General
2. Workflow permissions → "Read and write permissions"
3. Save and re-run workflow

#### 404 Error After Deployment

**Cause**: Wrong base path in `vite.config.js`

**Solution**:
1. Check your repository name: `marathon-tracker`
2. Update `vite.config.js`:
   ```javascript
   base: '/marathon-tracker/' // Must match repo name
   ```
3. Commit and push

#### App Loads But Routes Don't Work

**Cause**: Client-side routing not configured for GitHub Pages

**Solution**: Already configured with hash-based navigation in `App.jsx`

#### Database Not Auto-Importing

**Cause**: JSON file not in correct location or too large

**Check**:
1. File exists at `public/database/marathon-tracker-db.json`
2. File is valid JSON (not corrupted)
3. File size <100 MB (GitHub limit) or using Git LFS
4. Browser console shows: "✅ Database auto-imported on startup"

**Solution**:
- Verify file location: `public/database/marathon-tracker-db.json`
- Check browser console (F12) for import status
- If file too large, use manual import in Settings

#### Build Fails: Out of Memory

**Cause**: Large database file causing build issues

**Solution**:
1. Remove database from repository (too large)
2. Provide manual import instructions instead
3. Or use Git LFS:
   ```bash
   git lfs install
   git lfs track "public/database/*.json"
   git add .gitattributes
   git push
   ```

### Local Preview

Test the production build locally before deploying:

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Open: http://localhost:4173
```

This tests the build exactly as it will appear on GitHub Pages.

### Custom Domain (Optional)

To use a custom domain:

1. Add `CNAME` file to `public/` folder:
   ```
   marathon.yourdomain.com
   ```

2. Configure DNS:
   - Add CNAME record: `marathon` → `wandersoncferreira.github.io`

3. GitHub Pages will automatically use your custom domain

### Deployment Checklist

Before deploying:

- [ ] All tests pass locally
- [ ] App runs correctly with `npm run preview`
- [ ] Database export saved (if including auto-import)
- [ ] Commit message describes changes
- [ ] Base path in `vite.config.js` matches repo name
- [ ] GitHub Pages enabled in repository settings
- [ ] Workflow permissions configured

After deploying:

- [ ] Check Actions tab for successful workflow
- [ ] Visit deployed URL
- [ ] Test all tabs work
- [ ] Verify database auto-imports (if included)
- [ ] Test on mobile browser

### Deployment URL

**Production**: https://wandersoncferreira.github.io/marathon-tracker/

**Repository**: https://github.com/wandersoncferreira/marathon-tracker

---

**Your app will now automatically deploy to GitHub Pages on every push to main!** 🚀
