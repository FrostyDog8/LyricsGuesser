# Quick Setup Instructions

## First Time Setup (Do this once)

### Step 1: Create GitHub Repository

1. Go to https://github.com and sign in (create account if needed)
2. Click the **"+"** icon → **"New repository"**
3. Repository name: `lyrics-figure`
4. **Leave everything else unchecked** (no README, no .gitignore, no license)
5. Click **"Create repository"**

### Step 2: Connect Your Local Code

Open PowerShell in this folder and run:

```powershell
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/lyrics-figure.git
git push -u origin main
```

You'll be asked for your GitHub username and password (use a Personal Access Token if 2FA is enabled).

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**:
   - Branch: `main`
   - Folder: `/ (root)`
4. Click **Save**
5. Wait 1-2 minutes, then visit: `https://YOUR_USERNAME.github.io/lyrics-figure/`

## Daily Workflow

### Work Locally
- Edit files normally
- Open `index.html` in your browser (double-click or drag into browser). Surprise Me uses the curated list from `embedded-songs.js`.
- **After editing `songs-by-year.json`:** run `node build-embedded-songs.js` to update `embedded-songs.js`, then commit both files.
- Nothing changes on the live site until you push

### Update Live Site (When Ready)

**Option 1: Use the script**
```powershell
.\update-github.ps1
```

**Option 2: Manual commands**
```powershell
git add .
git commit -m "Your update description"
git push
```

That's it! Your changes go live in 1-2 minutes.

## Need Help?

- Check `DEPLOY.md` for detailed instructions
- GitHub Pages docs: https://docs.github.com/en/pages
