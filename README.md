# Lyrico - Fill in the Lyrics Game

**Author:** Omer Dabby  
**Contact:** [lyrico.app@gmail.com](mailto:lyrico.app@gmail.com)  
**© 2026 Omer Dabby.** All rights reserved.

A fun web-based game where you guess song lyrics word by word! Type words to reveal lyrics as you play and fill in the blanks to complete the song.

## How to Play

### Game Modes

1. **Choose a Song**: Enter a song name to play a specific song
2. **Surprise Me**: Get a random popular song from 1960 to present
3. **Surprise by Artist**: Enter an artist name to get a random song by that artist

### Gameplay

1. Choose your game mode and load a song
2. Type words you think are in the lyrics
3. When you guess a correct word, it appears in all its positions automatically
4. Fill in all the words to win!
5. Use "Next Song" to continue playing in surprise mode
6. Click "Back to Main" to return to the lobby

## Features

### Core Gameplay
- 🎵 **Lyrics Fetching**: Fetches lyrics from multiple APIs (lyrics.ovh, LRCLIB)
- 📝 **Real-time Word Matching**: Words are revealed as you type
- ✨ **Smooth Animations**: Beautiful animations when words are revealed
- 📊 **Progress Tracking**: See how many words you've found (found words / total words)
- 🎉 **Victory Celebration**: Animated celebration when you complete the song
- 🎬 **YouTube Links**: Direct links to the song's music video
- 🎨 **Two-Column Layout**: Beautiful lyrics display with two-column sentence layout

### Smart Song Selection
- 🎲 **Optimized Random Selection**: Fast year-based song fetching (3-10x faster than fetching all songs)
- 📅 **Year-Based Selection**: Songs selected from 1960 to present with weighted probabilities
  - 1960-1980: Top 4 songs per year
  - 1980-2000: Top 10 songs per year
  - 2000-present: Top 15 songs per year
- 🎯 **Popular Songs Only**: Filters for original versions and English-only songs
- 🔄 **Retry Logic**: Automatically retries with different years if a fetch fails

### Surprise Modes
- 🎲 **Surprise Me**: Random popular songs from across decades
- 🎤 **Surprise by Artist**: Random songs by a specific artist
- ⚡ **Preloading**: Background preloading of upcoming songs for instant "Next Song" experience
  - Preloads 3 songs ahead for global surprise mode
  - Preloads 3 songs ahead for artist-specific mode
  - Maintains separate queues for each mode

### Special Features
- 🔤 **"Oh" Variants**: Automatically reveals all forms of "oh" (ooh, ohh, etc.) when any one is guessed
- 👁️ **Reveal Lyrics**: Toggle button to show/hide all lyrics (dev mode only)
- 🎭 **Hidden Song Info**: Song title and artist are hidden in surprise mode until you reveal them or complete the song
- 📋 **Song Selection Modal**: Beautiful popup when multiple songs match your search

### Developer Mode
- 🔧 **Dev Mode Toggle**: Enable developer mode to see additional information
- 📊 **Song Source Display**: See where the song came from (Last.fm, Apple chart, iTunes)
- 📅 **Year Display**: See the year the song was released
- 🏆 **Rank Display**: See the song's position in that year's top k list (e.g., "#3 of top 15")
- 📈 **Preload Counters**: See how many songs are ready in the preload queue
- ❌ **Failed Songs List**: Track songs that failed to load (dev mode only)

## Getting Started

### Local Development

Simply open `index.html` in a web browser. No installation or build process required!

### Deploying to GitHub Pages

1. **Create a GitHub repository:**
   - Go to [GitHub](https://github.com) and create a new repository
   - Name it `Lyrico` (or any name you prefer)
   - Don't initialize with README (we already have one)

2. **Push your code:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/Lyrico.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click "Settings" → "Pages"
   - Under "Source", select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click "Save"
   - Your site will be live at: `https://YOUR_USERNAME.github.io/Lyrico/`

### Updating the Live Version

When you want to update the public version:

```bash
git add .
git commit -m "Your update description"
git push
```

GitHub Pages will automatically update within a few minutes!

## How It Works

### Song Selection Algorithm

The game uses an optimized year-based selection algorithm:

1. **Weighted Year Selection**: Randomly selects a year from 1960 to present, weighted by the number of songs per year
2. **Year Fetching**: Fetches only the top k songs for that specific year (instead of all songs)
3. **Song Filtering**: Filters for original versions and English-only songs
4. **Retry Logic**: If a year fetch fails, automatically selects a new random year

This approach is **3-10x faster** than fetching all songs upfront while maintaining the same weighted probability distribution.

### Lyrics Processing

- Lyrics are fetched from multiple APIs (lyrics.ovh, LRCLIB) with fallback logic
- Lyrics are parsed into individual words while preserving line structure
- Words are normalized (lowercase, punctuation removed) for matching
- Special handling for "oh" variants (ooh, ohh, etc.) - guessing any reveals all

### Word Matching

- As you type words, the game checks if they match any unfound words in the lyrics
- Matching is case-insensitive and ignores punctuation
- Matching words are revealed in their correct positions with a smooth animation
- The game tracks your progress and celebrates when you complete the song

### Preloading System

- **Global Preload Queue**: Maintains 3 preloaded songs for "Surprise Me" mode
- **Artist Preload Queue**: Maintains 3 preloaded songs for "Surprise by Artist" mode
- Preloading runs in the background and doesn't interfere with user-initiated song loading
- Songs are preloaded one at a time to avoid overwhelming the API

## Technical Details

### APIs Used

- **Lyrics APIs**:
  - `lyrics.ovh` (primary)
  - `LRCLIB` (fallback)
  
- **Song Metadata APIs**:
  - iTunes Search API (for song metadata and popularity)
  - Last.fm API (for global popularity charts)
  - Apple Marketing Tools RSS API (fallback for charts)

### Performance Optimizations

- **Year-based fetching**: Only fetches 4-15 songs per request instead of 1000+
- **Caching**: Caches chart songs for 1 hour to reduce API calls
- **Preloading**: Background preloading for instant song switching
- **Retry logic**: Smart retry with different years if a fetch fails

### Browser Compatibility

Works best in modern browsers (Chrome, Firefox, Safari, Edge) that support:
- ES6+ JavaScript
- Fetch API
- CSS Grid and Flexbox
- Local Storage (for dev mode preferences)

## Version History

- **v1.6**: Developer attribution footer and contact email (lyrico.app@gmail.com); in-game layout so only the lyrics box scrolls (no page scroll); main screen tightened so it fits without scrolling; year and hidden attribution updates
- **v1.5**: Hint button (reveal random word, orange styling); end-game messages by completion % (Perfection! to encouraging); last-revealed word in center (guess=purple, hint=orange); Next Song pulse animation; songs list updated
- **v1.4**: Artist mode preload priority; surprise preload continues when artist queue is full and when returning to lobby; songs data refreshed
- **v1.3**: End-of-game stats replace guess area on victory/give up; year only in Surprise Me; lobby button fixes
- **v1.2**: Curated song list (songs-by-year.json), embedded list for local + live, Surprise Me uses curated list, preload limit 5
- **v1.1**: Optimized song selection with year-based fetching, dev mode improvements (year/rank/source display)
- **v1.0**: Initial release with core gameplay features

## License & Copyright

© 2026 Omer Dabby. All rights reserved.  
This project is open source and available for personal use.  
If you use or adapt this code, please attribute the original author (Omer Dabby) and link to the repository: https://github.com/FrostyDog8/Lyrico
