# Lyrics Puzzle - Fill in the Lyrics Game

A fun web-based game where you guess song lyrics word by word!

## How to Play

1. Enter a song name or click "Surprise Me!" for a random song
2. Type words you think are in the lyrics
3. When you guess a correct word, it appears in all its positions automatically
4. Fill in all the words to win!

## Features

- 🎵 Fetch lyrics from lyrics.ovh API
- 🎲 Surprise Me mode - random popular songs
- 📝 Real-time word matching as you type
- ✨ Smooth animations when words are revealed
- 📊 Progress tracking (found words / total words)
- 🎉 Victory celebration when you complete the song
- 🎬 Direct YouTube video links
- 🎨 Beautiful two-column lyrics display

## Getting Started

### Local Development

Simply open `index.html` in a web browser. No installation or build process required!

### Deploying to GitHub Pages

1. **Create a GitHub repository:**
   - Go to [GitHub](https://github.com) and create a new repository
   - Name it `lyrics-figure` (or any name you prefer)
   - Don't initialize with README (we already have one)

2. **Push your code:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/lyrics-figure.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click "Settings" → "Pages"
   - Under "Source", select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click "Save"
   - Your site will be live at: `https://YOUR_USERNAME.github.io/lyrics-figure/`

### Updating the Live Version

When you want to update the public version:

```bash
git add .
git commit -m "Your update description"
git push
```

GitHub Pages will automatically update within a few minutes!

## How It Works

- The game fetches lyrics using the lyrics.ovh API
- Lyrics are parsed into individual words while preserving line structure
- As you type words, the game checks if they match any unfound words in the lyrics
- Matching words are revealed in their correct positions with a smooth animation
- The game tracks your progress and celebrates when you complete the song

## Browser Compatibility

Works best in modern browsers (Chrome, Firefox, Safari, Edge) that support ES6+ JavaScript and Fetch API.
