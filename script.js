// Dev mode state
let devMode = false;

// Game state
let gameState = {
    lyrics: [],
    words: [],
    foundWords: new Set(),
    userGuessedWords: new Set(), // Track words guessed by user (not reveal button)
    totalWords: 0,
    foundCount: 0,
    songTitle: '',
    songArtist: '',
    songYear: null, // Track song year for dev mode
    songRank: null, // Track song rank in year's top k (1-based)
    songYearTopK: null, // Track total top k for that year (e.g., 15 for 2012)
    lyricsRevealed: false, // Track if lyrics are currently revealed
    isSurpriseSong: false, // Track if this is a surprise song
    titleRevealed: false, // Track if song title is revealed
    yearRevealed: false, // Track if song year is revealed
    yearRevealedBySong: false, // Track if year was revealed because song was revealed (vs manual reveal)
    surpriseArtistName: '', // When set, Next Song picks another random song by this artist
    requestedArtistName: '' // The original artist name requested by user (for display in banner, without collaborations)
};

// Initialize the game – attach lobby buttons so they always work
function initLobbyButtons() {
    const startBtn = document.getElementById('startBtn');
    const songInput = document.getElementById('songInput');
    const surpriseBtn = document.getElementById('surpriseBtn');
    const surpriseByArtistBtn = document.getElementById('surpriseByArtistBtn');
    const artistInput = document.getElementById('artistInput');
    if (startBtn) startBtn.addEventListener('click', startGame);
    if (songInput) songInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') startGame(); });
    if (surpriseBtn) surpriseBtn.addEventListener('click', surpriseMe);
    if (surpriseByArtistBtn) surpriseByArtistBtn.addEventListener('click', surpriseByArtist);
    if (artistInput) artistInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') surpriseByArtist(); });
}

// Run when DOM is ready (handles both late and already-ready)
function onDomReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

onDomReady(() => {
    // Attach lobby button listeners first so they always work
    initLobbyButtons();

    const wordInput = document.getElementById('wordInput');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const devModeBtn = document.getElementById('devModeBtn');
    
    // Dev mode toggle
    if (devModeBtn) {
        devModeBtn.addEventListener('click', toggleDevMode);
    }
    try {
        updateDevModeUI();
    } catch (e) {
        console.warn('updateDevModeUI failed:', e);
    }
    
    // Preload a random surprise song in the background so it's ready when user clicks "Surprise Me"
    preloadNextSurpriseSong();
    
    // Track input as user types and auto-check for matches
    if (wordInput) {
        wordInput.addEventListener('input', (e) => {
        const inputValue = e.target.value;
        
        if (!inputValue || inputValue.length === 0) return;
        
        // Split by spaces to handle multiple words
        const words = inputValue.trim().split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 0) {
            e.target.value = '';
            return;
        }
        
        // Check each word individually
        const remainingWords = [];
        let foundAny = false;
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const wasFound = checkWord(word, false); // Don't clear input here
            
            if (wasFound) {
                foundAny = true;
                // Don't add this word to remaining words since it was found
            } else {
                // Keep words that weren't found (or already found)
                remainingWords.push(word);
            }
        }
        
        // Update input field - keep only words that weren't found
        if (foundAny) {
            const newValue = remainingWords.join(' ');
            e.target.value = newValue;
        }
        });
    }

    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
        revealBtn.addEventListener('click', toggleRevealLyrics);
    }

    const revealTitleBtn = document.getElementById('revealTitleBtn');
    if (revealTitleBtn) {
        revealTitleBtn.addEventListener('click', toggleSongTitle);
    }
    
    const revealYearBtn = document.getElementById('revealYearBtn');
    if (revealYearBtn) {
        revealYearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleYear();
        });
    } else {
        console.warn('revealYearBtn not found during initialization');
    }

    const nextSongBtn = document.getElementById('nextSongBtn');
    if (nextSongBtn) {
        nextSongBtn.addEventListener('click', nextSurpriseSong);
    }

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
        // Reset game state
        gameState.isSurpriseSong = false;
        gameState.surpriseArtistName = '';
        gameState.requestedArtistName = '';
        preloadedArtistSongs = [];
        preloadedArtistName = '';
        gameState.titleRevealed = false;
        gameState.yearRevealed = false;
        gameState.yearRevealedBySong = false;
        gameState.lyricsRevealed = false;
        
        // Hide help button in game area
        const helpGameplayBtnGame = document.getElementById('helpGameplayBtnGame');
        if (helpGameplayBtnGame) helpGameplayBtnGame.style.display = 'none';
        
        // Hide artist mode banner
        const artistModeBanner = document.getElementById('artistModeBanner');
        if (artistModeBanner) artistModeBanner.style.display = 'none';
        
        // Reset UI elements
        const revealTitleBtn = document.getElementById('revealTitleBtn');
        if (revealTitleBtn) {
            revealTitleBtn.style.display = 'none';
            revealTitleBtn.textContent = 'Reveal Song';
        }
        const nextSongBtn = document.getElementById('nextSongBtn');
        if (nextSongBtn) nextSongBtn.style.display = 'none';
        
        const revealBtn = document.getElementById('revealBtn');
        if (revealBtn) {
            revealBtn.textContent = 'Reveal Lyrics';
        }
        
        // Hide game area and show setup
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('gameSetup').style.display = 'block';
        document.getElementById('songInput').value = '';
        document.getElementById('songInput').focus();
        
        // Reset error message (but keep failed songs visible)
        document.getElementById('errorMessage').classList.remove('show');
        const songSelectionOverlay = document.getElementById('songSelectionOverlay');
        if (songSelectionOverlay) songSelectionOverlay.style.display = 'none';
        
        // Update failed songs display to show in lobby screen
        updateFailedSongsDisplay(globalFailedSongs);
        
        // Reset button states
        const startBtn = document.getElementById('startBtn');
        const surpriseBtn = document.getElementById('surpriseBtn');
        const surpriseByArtistBtn = document.getElementById('surpriseByArtistBtn');
        if (startBtn) {
            startBtn.innerHTML = 'Start Game';
            startBtn.disabled = false;
        }
        if (surpriseBtn) {
            surpriseBtn.innerHTML = '🎲 Surprise Me!';
            surpriseBtn.disabled = false;
        }
        if (surpriseByArtistBtn) {
            surpriseByArtistBtn.innerHTML = '🎤 Random Song';
            surpriseByArtistBtn.disabled = false;
        }
        });
    }

    const giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) {
        giveUpBtn.addEventListener('click', showGiveUpConfirmation);
    }

    // Help modal handlers
    const helpModal = document.getElementById('helpModal');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const helpSurpriseBtn = document.getElementById('helpSurpriseBtn');
    const helpArtistBtn = document.getElementById('helpArtistBtn');
    const helpGameplayBtn = document.getElementById('helpGameplayBtn');

    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', () => {
            if (helpModal) helpModal.classList.remove('show');
        });
    }
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.classList.remove('show');
            }
        });
    }
    if (helpSurpriseBtn) {
        helpSurpriseBtn.addEventListener('click', () => {
            showHelp('Surprise Me Mode', `
                <p><strong>Surprise Me</strong> gives you a random popular song from our curated list.</p>
                <h4>How it works:</h4>
                <ul>
                    <li>Click "Surprise Me!" to get a random song</li>
                    <li>The song title and artist are hidden until you complete the lyrics</li>
                    <li>Use "Reveal Song" to see what song you're playing</li>
                    <li>Use "Next Song" to skip to another random song</li>
                </ul>
                <p>Perfect for testing your general music knowledge!</p>
            `);
        });
    }
    if (helpArtistBtn) {
        helpArtistBtn.addEventListener('click', () => {
            showHelp('Surprise by Artist Mode', `
                <p><strong>Surprise by Artist</strong> gives you random songs from a specific artist.</p>
                <h4>How it works:</h4>
                <ul>
                    <li>Enter an artist name and click "Random Song"</li>
                    <li>You'll get a random song by that artist</li>
                    <li>The song title is hidden until you complete it</li>
                    <li>Use "Next Song" to get another song by the same artist</li>
                </ul>
                <p>Perfect for testing your knowledge of a specific artist!</p>
            `);
        });
    }
    // Help button in setup area
    if (helpGameplayBtn) {
        helpGameplayBtn.addEventListener('click', () => {
            showHelp('How to Play', `
                <p>Type words that appear in the song lyrics to reveal them!</p>
                <h4>Gameplay:</h4>
                <ul>
                    <li><strong>Type words:</strong> Enter any word from the song. If it's in the lyrics, all instances will be revealed</li>
                    <li><strong>Multiple words:</strong> You can type multiple words at once, separated by spaces</li>
                    <li><strong>Reveal Song:</strong> Click to see the song title and artist (hidden in surprise modes)</li>
                    <li><strong>Give Up:</strong> Ends the game and shows your progress</li>
                </ul>
                <h4>Tips:</h4>
                <ul>
                    <li>Start with common words like "the", "and", "you", "I"</li>
                    <li>Look for repeated words or phrases</li>
                    <li>Try words that might appear in the chorus</li>
                </ul>
            `);
        });
    }
    
    const helpGameplayBtnGame = document.getElementById('helpGameplayBtnGame');
    if (helpGameplayBtnGame) {
        helpGameplayBtnGame.addEventListener('click', () => {
            showHelp('How to Play', `
                <p>Type words that appear in the song lyrics to reveal them!</p>
                <h4>Gameplay:</h4>
                <ul>
                    <li><strong>Type words:</strong> Enter any word from the song. If it's in the lyrics, all instances will be revealed</li>
                    <li><strong>Multiple words:</strong> You can type multiple words at once, separated by spaces</li>
                    <li><strong>Reveal Song:</strong> Click to see the song title and artist (hidden in surprise modes)</li>
                    <li><strong>Reveal Year:</strong> Click to see the song's year (hidden in surprise modes)</li>
                    <li><strong>Give Up:</strong> Ends the game and shows your progress</li>
                </ul>
                <h4>Tips:</h4>
                <ul>
                    <li>Start with common words like "the", "and", "you", "I"</li>
                    <li>Look for repeated words or phrases</li>
                    <li>Try words that might appear in the chorus</li>
                </ul>
            `);
        });
    }

    const confirmGiveUpBtn = document.getElementById('confirmGiveUpBtn');
    const cancelGiveUpBtn = document.getElementById('cancelGiveUpBtn');
    const giveUpConfirmationModal = document.getElementById('giveUpConfirmationModal');
    if (confirmGiveUpBtn) {
        confirmGiveUpBtn.addEventListener('click', handleGiveUp);
    }
    if (cancelGiveUpBtn) {
        cancelGiveUpBtn.addEventListener('click', () => {
            if (giveUpConfirmationModal) {
                giveUpConfirmationModal.classList.remove('show');
            }
        });
    }
    // Close modal when clicking outside
    if (giveUpConfirmationModal) {
        giveUpConfirmationModal.addEventListener('click', (e) => {
            if (e.target === giveUpConfirmationModal) {
                giveUpConfirmationModal.classList.remove('show');
            }
        });
    }

    const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
    const songSelectionOverlay = document.getElementById('songSelectionOverlay');
    if (cancelSelectionBtn && songSelectionOverlay) {
        cancelSelectionBtn.addEventListener('click', () => {
            songSelectionOverlay.style.display = 'none';
            const startBtn = document.getElementById('startBtn');
            const surpriseBtn = document.getElementById('surpriseBtn');
            const surpriseByArtistBtn = document.getElementById('surpriseByArtistBtn');
            if (startBtn) {
                startBtn.innerHTML = 'Start Game';
                startBtn.disabled = false;
            }
            if (surpriseBtn) {
                surpriseBtn.innerHTML = '🎲 Surprise Me!';
                surpriseBtn.disabled = false;
            }
            if (surpriseByArtistBtn) {
                surpriseByArtistBtn.innerHTML = '🎤 Random Song';
                surpriseByArtistBtn.disabled = false;
            }
        });
        // Close on backdrop click
        songSelectionOverlay.addEventListener('click', (e) => {
            if (e.target === songSelectionOverlay) {
                songSelectionOverlay.style.display = 'none';
            }
        });
    }

    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            location.reload();
        });
    }
    
    // Update dev mode UI after everything is set up
    updateDevModeUI();
    
    // Log runtime comparison availability
    console.log('💡 To compare old vs optimized runtime, run: compareRuntime()');
});

function toggleDevMode() {
    devMode = !devMode;
    updateDevModeUI();
}

function updateDevModeUI() {
    const devModeBtn = document.getElementById('devModeBtn');
    const revealBtn = document.getElementById('revealBtn');
    const failedSongsDiv = document.getElementById('failedSongs');
    const failedSongsDivGame = document.getElementById('failedSongsGame');
    
    // Update button appearance
    if (devModeBtn) {
        if (devMode) {
            devModeBtn.classList.add('active');
            devModeBtn.textContent = '🔧 ON';
            devModeBtn.title = 'Developer Mode: ON';
        } else {
            devModeBtn.classList.remove('active');
            devModeBtn.textContent = '🔧';
            devModeBtn.title = 'Developer Mode: OFF';
        }
    }
    
    // Show/hide reveal lyrics button
    if (revealBtn) {
        revealBtn.style.display = devMode ? 'inline-block' : 'none';
    }
    
    // Show/hide failed songs lists
    if (failedSongsDiv) {
        if (!devMode) {
            failedSongsDiv.style.display = 'none';
        } else {
            // Show if there are failed songs
            updateFailedSongsDisplay(globalFailedSongs);
        }
    }
    if (failedSongsDivGame) {
        if (!devMode) {
            failedSongsDivGame.style.display = 'none';
        } else {
            // Show if there are failed songs
            updateFailedSongsDisplay(globalFailedSongs);
        }
    }

    updatePreloadCounter();

    // Dev mode: show song source (Last.fm / Apple / iTunes), year, and rank when in surprise game
    const songSourceEl = document.getElementById('songSourceDev');
    if (songSourceEl) {
        if (devMode && gameState.isSurpriseSong) {
            let parts = [];
            
            // Source
            if (chartSource) {
                const sourceMap = {
                    'lastfm': 'Last.fm',
                    'apple': 'Apple chart',
                    'itunes-yearly': 'iTunes (yearly)',
                    'itunes-optimized': 'iTunes (optimized)',
                    'itunes': 'iTunes Search',
                    'static-db': 'Static database'
                };
                parts.push('Source: ' + (sourceMap[chartSource] || 'iTunes Search'));
            }
            
            // Year
            if (gameState.songYear) {
                parts.push(`Year: ${gameState.songYear}`);
            }
            
            // Rank
            if (gameState.songRank && gameState.songYearTopK) {
                parts.push(`Rank: #${gameState.songRank} of top ${gameState.songYearTopK}`);
            }
            
            if (parts.length > 0) {
                songSourceEl.textContent = parts.join(' | ');
                songSourceEl.style.display = 'block';
            } else {
                songSourceEl.textContent = '';
                songSourceEl.style.display = 'none';
            }
        } else {
            songSourceEl.textContent = '';
            songSourceEl.style.display = 'none';
        }
    }
}

// Popularity-based random song: fetch chart from Last.fm, filter by playcount threshold.
// No hardcoded names; 300–400+ eligible songs; cache refreshed when stale.
// Get a free API key at https://www.last.fm/api/account/create
const LASTFM_API_KEY = '072e57491a78cfaf62abffd5bf5429a4'; // optional: set for Last.fm chart + playcount threshold
const POPULARITY_MIN_PLAYCOUNT = 20000000; // minimum Last.fm scrobbles – 20M

const CHART_CACHE_MS = 60 * 60 * 1000;     // 1 hour
const CHART_MIN_ELIGIBLE = 300;
const CHART_PAGE_SIZE = 500;
let chartSongsCache = null;
let chartSongsCacheTime = 0;
/** Set by getChartSongs(): 'lastfm' | 'apple' | 'itunes' – for dev mode display. */
let chartSource = null;

/** Static song database: flat list of { title, artist, year }. Source: embedded-songs.js (file:// and live) or songs-by-year.json (fetch when served). */
let staticSongsDb = null;

/** Load static songs DB once. Uses embedded list if present (works locally file:// and live), else fetches songs-by-year.json. */
async function loadStaticSongsDb() {
    if (staticSongsDb) return staticSongsDb;
    if (typeof window !== 'undefined' && window.EMBEDDED_SONGS_DB && Array.isArray(window.EMBEDDED_SONGS_DB) && window.EMBEDDED_SONGS_DB.length > 0) {
        staticSongsDb = window.EMBEDDED_SONGS_DB;
        return staticSongsDb;
    }
    const jsonUrl = new URL('songs-by-year.json', document.baseURI || window.location.href).href;
    const res = await fetch(jsonUrl);
    if (!res.ok) throw new Error('Could not load song database');
    const byYear = await res.json();
    const flat = [];
    for (const [year, list] of Object.entries(byYear)) {
        const y = parseInt(year, 10);
        if (!Array.isArray(list)) continue;
        for (const s of list) {
            if (s && s.title && s.artist) flat.push({ title: String(s.title).trim(), artist: String(s.artist).trim(), year: y });
        }
    }
    staticSongsDb = flat;
    return staticSongsDb;
}

/** Fetch one page of Last.fm chart.getTopTracks via CORS proxy. Returns { track: { name, artist: { name }, playcount } }[]. */
async function fetchLastFmChartPage(page) {
    const params = new URLSearchParams({
        method: 'chart.gettoptracks',
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit: String(CHART_PAGE_SIZE),
        page: String(page)
    });
    const url = `https://ws.audioscrobbler.com/2.0/?${params}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Last.fm chart HTTP ${res.status}`);
    const proxy = await res.json();
    const raw = proxy.contents;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data.error) throw new Error(data.message || 'Last.fm API error');
    const tracks = data?.tracks?.track ?? [];
    return tracks;
}

/** Fetch enough Last.fm chart pages to get tracks above playcount threshold. */
async function fetchChartSongsLastFm() {
    const out = [];
    const seen = new Set();
    for (let page = 1; page <= 5; page++) {
        const tracks = await fetchLastFmChartPage(page);
        if (!tracks.length) break;
        for (const t of tracks) {
            const title = (t.name || '').trim();
            const artist = (t.artist?.name ?? t.artist ?? '').trim() || 'Unknown';
            const playcount = parseInt(t.playcount, 10) || 0;
            if (!title || playcount < POPULARITY_MIN_PLAYCOUNT) continue;
            if (!isOriginalVersion(title)) continue;
            if (!isLikelyEnglish(title) || !isLikelyEnglish(artist)) continue;
            const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ title, artist });
        }
        if (out.length >= CHART_MIN_ELIGIBLE) break;
    }
    return out;
}

/** Fallback when no Last.fm key: Apple chart feed via proxy. Returns [] on failure so caller can use iTunes fallback. */
async function fetchOneChartFeed(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) return [];
        const proxy = await res.json();
        const raw = proxy.contents;
        if (raw == null) return [];
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const results = data?.feed?.results || data?.results || (Array.isArray(data) ? data : []);
        const out = [];
        for (const entry of results) {
            const title = String((entry?.name ?? entry?.trackName ?? entry?.attributes?.name ?? entry?.title) ?? '').trim();
            const artist = (String((entry?.artistName ?? entry?.artist ?? entry?.attributes?.artistName ?? entry?.attributes?.artist) ?? '').trim()) || 'Unknown';
            if (title && isOriginalVersion(title) && isLikelyEnglish(title) && isLikelyEnglish(artist)) out.push({ title, artist });
        }
        return out;
    } catch (_e) {
        return [];
    }
}

/** Fetch chart songs: Last.fm with playcount threshold if API key set, else Apple fallback. */
async function fetchChartSongs() {
    if (LASTFM_API_KEY && LASTFM_API_KEY.trim()) {
        return fetchChartSongsLastFm();
    }
    const url = 'https://rss.applemarketingtools.com/api/v2/us/music/most-played/200/songs.json';
    return fetchOneChartFeed(url);
}

/** New method: fetch top songs year by year from 1960 to present with variable counts per decade. */
async function fetchSongsViaYearlyTopHits() {
    const seen = new Set();
    const out = [];
    const currentYear = new Date().getFullYear();
    
    for (let year = 1960; year <= currentYear; year++) {
        let songsPerYear;
        if (year >= 1960 && year < 1980) {
            songsPerYear = 4;
        } else if (year >= 1980 && year < 2000) {
            songsPerYear = 10;
        } else {
            songsPerYear = 15;
        }
        
        try {
            // Search for top hits from that year
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(year)}%20hit&media=music&entity=song&limit=${songsPerYear * 2}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data.results || !data.results.length) continue;
            
            // Take top N results and filter
            const topResults = data.results.slice(0, songsPerYear);
            for (const r of topResults) {
                if (!isOriginalVersion(r.trackName)) continue;
                const title = (r.trackName || '').trim();
                const artist = (r.artistName || '').trim() || 'Unknown';
                if (!title || !isLikelyEnglish(title) || !isLikelyEnglish(artist)) continue;
                const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
                if (seen.has(key)) continue;
                seen.add(key);
                // Extract year from releaseDate if available, otherwise use search year
                const releaseYear = r.releaseDate ? new Date(r.releaseDate).getFullYear() : year;
                out.push({ title, artist, year: releaseYear });
            }
        } catch (_e) {
            continue;
        }
    }
    
    return out.length >= CHART_MIN_ELIGIBLE ? out : [];
}

/** Fallback: build a pool using iTunes Search. Without Last.fm we can't use playcount, so take only top results per term (iTunes orders by popularity). */
async function fetchSongsViaItunesSearchOld() {
    const terms = ['pop', 'rock', 'love', 'country', 'hit', 'top', 'music', 'one', 'life', 'time'];
    const seen = new Set();
    const out = [];
    const TOP_PER_TERM = 15; // only top 15 per search = more familiar (iTunes returns by popularity)
    for (const term of terms) {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=50`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data.results || !data.results.length) continue;
            const topResults = data.results.slice(0, TOP_PER_TERM);
            for (const r of topResults) {
                if (!isOriginalVersion(r.trackName)) continue;
                const title = (r.trackName || '').trim();
                const artist = (r.artistName || '').trim() || 'Unknown';
                if (!title || !isLikelyEnglish(title) || !isLikelyEnglish(artist)) continue;
                const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({ title, artist });
            }
            if (out.length >= CHART_MIN_ELIGIBLE) break;
        } catch (_e) {
            continue;
        }
    }
    return out;
}

/** Get cached chart songs, or fetch and cache. Sets chartSource for dev mode. */
async function getChartSongs() {
    const now = Date.now();
    const cacheValid = chartSongsCache && chartSongsCache.length > 0 && (now - chartSongsCacheTime) < CHART_CACHE_MS;
    if (cacheValid) return chartSongsCache;
    let songs = [];
    chartSource = null;
    try {
        songs = await fetchChartSongs();
        if (songs && songs.length > 0) {
            chartSource = (LASTFM_API_KEY && LASTFM_API_KEY.trim()) ? 'lastfm' : 'apple';
        }
    } catch (e) {
        console.warn('Chart fetch failed, using iTunes Search fallback:', e.message || e);
    }
    if (!songs || songs.length === 0) {
        // Try new year-by-year method first
        try {
            songs = await fetchSongsViaYearlyTopHits();
            if (songs && songs.length > 0) chartSource = 'itunes-yearly';
        } catch (e) {
            console.warn('Yearly top hits method failed, trying old iTunes Search:', e.message || e);
        }
        // Fall back to old method if new one didn't work
        if (!songs || songs.length === 0) {
            try {
                songs = await fetchSongsViaItunesSearchOld();
                if (songs && songs.length > 0) chartSource = 'itunes';
            } catch (e) {
                console.error('iTunes Search fallback failed:', e);
            }
        }
    }
    if (!songs || songs.length === 0) throw new Error('Could not load song list. Check your connection and try again.');
    chartSongsCache = songs;
    chartSongsCacheTime = now;
    return songs;
}

/** Old method: Pick a random song from the popular pool (chart or iTunes fallback). Fetches all songs first. */
async function getRandomPopularSongOld() {
    const songs = await getChartSongs();
    if (!songs.length) throw new Error('No songs available');
    let pool = songs.filter(s => !triedSongsInSession.has(`${s.title.toLowerCase()}_${s.artist.toLowerCase()}`));
    if (pool.length === 0) {
        triedSongsInSession.clear();
        pool = songs;
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    triedSongsInSession.add(`${chosen.title.toLowerCase()}_${chosen.artist.toLowerCase()}`);
    return { title: chosen.title, artist: chosen.artist, year: chosen.year || null };
}

/** Pick a random song from the static database (songs-by-year.json). Falls back to API if DB unavailable (e.g. when opening index.html via file://). */
async function getRandomPopularSong() {
    try {
        const db = await loadStaticSongsDb();
        if (!db || db.length === 0) throw new Error('Empty database');
        let pool = db.filter(s => !triedSongsInSession.has(`${s.title.toLowerCase()}_${s.artist.toLowerCase()}`));
        if (pool.length === 0) {
            triedSongsInSession.clear();
            pool = db;
        }
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        triedSongsInSession.add(`${chosen.title.toLowerCase()}_${chosen.artist.toLowerCase()}`);
        chartSource = 'static-db';
        return {
            title: chosen.title,
            artist: chosen.artist,
            year: chosen.year,
            rank: null,
            topK: null
        };
    } catch (e) {
        console.warn('Static song DB unavailable, using API fallback:', e.message || e);
        const song = await getRandomPopularSongOptimized();
        if (!chartSource) chartSource = 'itunes-optimized';
        return song;
    }
}

/** Optimized version: Select random year weighted by song counts, then fetch only that year's songs. Retries with new year if fetch fails. */
async function getRandomPopularSongOptimized() {
    const currentYear = new Date().getFullYear();
    const maxRetries = 10;
    const triedYears = new Set();
    
    // Calculate total weight (total number of songs across all years)
    let totalWeight = 0;
    const yearWeights = [];
    for (let year = 1960; year <= currentYear; year++) {
        let songsPerYear;
        if (year >= 1960 && year < 1980) {
            songsPerYear = 4;
        } else if (year >= 1980 && year < 2000) {
            songsPerYear = 10;
        } else {
            songsPerYear = 15;
        }
        totalWeight += songsPerYear;
        yearWeights.push({ year, weight: songsPerYear, cumulative: totalWeight });
    }
    
    // Retry loop: try different years if one fails
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Select random year based on weights
        let selectedYear = 1960;
        let random = Math.random() * totalWeight;
        
        // If we've tried many years, avoid retrying the same ones
        if (triedYears.size > 0 && attempt > 0) {
            // Recalculate weights excluding tried years
            let availableWeight = 0;
            const availableWeights = [];
            for (const yw of yearWeights) {
                if (!triedYears.has(yw.year)) {
                    availableWeight += yw.weight;
                    availableWeights.push({ year: yw.year, weight: yw.weight, cumulative: availableWeight });
                }
            }
            if (availableWeights.length === 0) {
                // All years tried, reset and try again
                triedYears.clear();
                availableWeight = totalWeight;
                availableWeights.push(...yearWeights);
            }
            random = Math.random() * availableWeight;
            for (const yw of availableWeights) {
                if (random < yw.cumulative) {
                    selectedYear = yw.year;
                    break;
                }
            }
        } else {
            // First attempt or no tried years yet
            for (const yw of yearWeights) {
                if (random < yw.cumulative) {
                    selectedYear = yw.year;
                    break;
                }
            }
        }
        
        triedYears.add(selectedYear);
        
        // Determine songs per year for selected year
        let songsPerYear;
        if (selectedYear >= 1960 && selectedYear < 1980) {
            songsPerYear = 4;
        } else if (selectedYear >= 1980 && selectedYear < 2000) {
            songsPerYear = 10;
        } else {
            songsPerYear = 15;
        }
        
        // Fetch only songs from that year
        const seen = new Set();
        const songs = [];
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(selectedYear)}%20hit&media=music&entity=song&limit=${songsPerYear * 2}`;
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`iTunes search failed for year ${selectedYear}: ${res.status}, trying another year...`);
                continue; // Try next year
            }
            const data = await res.json();
            if (data.results && data.results.length) {
                const topResults = data.results.slice(0, songsPerYear);
                for (const r of topResults) {
                    if (!isOriginalVersion(r.trackName)) continue;
                    const title = (r.trackName || '').trim();
                    const artist = (r.artistName || '').trim() || 'Unknown';
                    if (!title || !isLikelyEnglish(title) || !isLikelyEnglish(artist)) continue;
                    const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const releaseYear = r.releaseDate ? new Date(r.releaseDate).getFullYear() : selectedYear;
                    songs.push({ title, artist, year: releaseYear });
                }
            }
        } catch (e) {
            console.warn(`Error fetching songs for year ${selectedYear}:`, e.message || e, 'Trying another year...');
            continue; // Try next year
        }
        
        // If we got songs, return one
        if (songs.length > 0) {
            // Filter out already tried songs
            let pool = songs.filter(s => !triedSongsInSession.has(`${s.title.toLowerCase()}_${s.artist.toLowerCase()}`));
            if (pool.length === 0) {
                triedSongsInSession.clear();
                pool = songs;
            }
            
            const chosenIndex = Math.floor(Math.random() * pool.length);
            const chosen = pool[chosenIndex];
            triedSongsInSession.add(`${chosen.title.toLowerCase()}_${chosen.artist.toLowerCase()}`);
            
            // Find the rank of the chosen song in the original songs list (1-based)
            const rankInOriginal = songs.findIndex(s => 
                s.title.toLowerCase() === chosen.title.toLowerCase() && 
                s.artist.toLowerCase() === chosen.artist.toLowerCase()
            ) + 1;
            
            return { 
                title: chosen.title, 
                artist: chosen.artist, 
                year: chosen.year || null,
                rank: rankInOriginal,
                topK: songsPerYear
            };
        }
        
        // No songs found for this year, try next
        console.warn(`No eligible songs found for year ${selectedYear}, trying another year...`);
    }
    
    // If we've exhausted all retries, throw error
    throw new Error(`Failed to fetch songs after ${maxRetries} attempts with different years`);
}

/** Compare runtime of old vs optimized method. Call from console: compareRuntime() */
async function compareRuntime() {
    console.log('=== Runtime Comparison ===');
    
    let oldTime = 0;
    let optTime = 0;
    
    // Test old method (clear cache first to get accurate timing)
    console.log('Testing old method (fetching all songs first)...');
    chartSongsCache = null;
    chartSongsCacheTime = 0;
    const oldStart = performance.now();
    try {
        const oldSong = await getRandomPopularSongOld();
        const oldEnd = performance.now();
        oldTime = oldEnd - oldStart;
        console.log(`Old method: ${oldTime.toFixed(2)}ms - Got: ${oldSong.title} by ${oldSong.artist}${oldSong.year ? ` (${oldSong.year})` : ''}`);
    } catch (e) {
        console.error('Old method failed:', e);
        oldTime = Infinity;
    }
    
    // Test optimized method
    console.log('\nTesting optimized method (fetching only selected year)...');
    const optStart = performance.now();
    try {
        const optSong = await getRandomPopularSongOptimized();
        const optEnd = performance.now();
        optTime = optEnd - optStart;
        console.log(`Optimized method: ${optTime.toFixed(2)}ms - Got: ${optSong.title} by ${optSong.artist}${optSong.year ? ` (${optSong.year})` : ''}`);
    } catch (e) {
        console.error('Optimized method failed:', e);
        optTime = Infinity;
    }
    
    // Show comparison
    console.log('\n=== Results ===');
    if (oldTime !== Infinity && optTime !== Infinity) {
        const improvement = ((oldTime - optTime) / oldTime * 100);
        const speedup = (oldTime / optTime).toFixed(2);
        console.log(`Old method: ${oldTime.toFixed(2)}ms`);
        console.log(`Optimized method: ${optTime.toFixed(2)}ms`);
        if (improvement > 0) {
            console.log(`✅ Optimized is ${improvement.toFixed(1)}% faster (${speedup}x speedup)`);
        } else {
            console.log(`⚠️ Optimized is ${Math.abs(improvement).toFixed(1)}% slower`);
        }
    }
    console.log('=== End Comparison ===');
    
    return { oldTime, optTime };
}

// Expose comparison function globally for console access
window.compareRuntime = compareRuntime;

/** Fetch songs by artist via iTunes Search. Returns [{ title, artist }] filtered for original versions and English. */
async function getSongsByArtist(artistName) {
    const term = artistName.trim();
    if (!term) return [];
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
    const data = await res.json();
    const results = data.results || [];
    const seen = new Set();
    const out = [];
    for (const r of results) {
        const title = (r.trackName || '').trim();
        const artist = (r.artistName || '').trim() || 'Unknown';
        if (!title || !isOriginalVersion(title)) continue;
        if (!isLikelyEnglish(title) || !isLikelyEnglish(artist)) continue;
        const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ title, artist });
    }
    return out;
}

// Global failed songs list
let globalFailedSongs = [];
// Track songs tried in current surprise session to avoid duplicates
let triedSongsInSession = new Set();

// Preload up to 5 surprise songs in background, one at a time (user can take one before all 5 are ready)
const PRELOAD_QUEUE_MAX = 5;
let preloadedSurpriseSongs = []; // { title, artist, lyrics }[]
let preloadInProgress = false;
/** When true, background preload is paused so the user's chosen song loads with immediate priority. */
let userSongLoadInProgress = false;

// Artist preload: when playing "surprise by artist", preload songs by that artist (global preload continues too)
let preloadedArtistSongs = []; // { title, artist, lyrics }[]
let preloadedArtistName = '';
let preloadArtistInProgress = false;

/** Update dev-mode preload counter (visibility + count). Call whenever queue changes or dev mode toggles. */
function updatePreloadCounter() {
    const el = document.getElementById('preloadCounter');
    const countEl = document.getElementById('preloadCount');
    if (!el || !countEl) return;
    countEl.textContent = String(preloadedSurpriseSongs.length);
    el.style.display = devMode ? 'inline' : 'none';
    const artistEl = document.getElementById('preloadArtistCounter');
    if (artistEl) {
        const artistCountEl = document.getElementById('preloadArtistCount');
        const showArtist = devMode && gameState.surpriseArtistName && gameState.surpriseArtistName.trim();
        artistEl.style.display = showArtist ? 'inline' : 'none';
        if (artistCountEl) artistCountEl.textContent = String(preloadedArtistSongs.length);
    }
}

/** Load one more song into the queue if we have room. Skips when user is loading a specific song (priority). */
function preloadNextSurpriseSong() {
    if (userSongLoadInProgress || preloadedSurpriseSongs.length >= PRELOAD_QUEUE_MAX || preloadInProgress) return;
    preloadInProgress = true;
    getRandomPopularSong()
        .then(song => fetchLyrics(song.title, song.artist).then(lyrics => ({ song, lyrics })))
        .then(({ song, lyrics }) => {
            if (lyrics && lyrics.trim().length >= 50 && isLikelyEnglish(lyrics)) {
                preloadedSurpriseSongs.push({ title: song.title, artist: song.artist, lyrics, year: song.year || null, rank: song.rank || null, topK: song.topK || null });
                updatePreloadCounter();
            }
        })
        .catch(() => {})
        .finally(() => {
            preloadInProgress = false;
            if (preloadedSurpriseSongs.length < PRELOAD_QUEUE_MAX) preloadNextSurpriseSong();
        });
}

/** Load one more song by current artist into artist queue. Only runs when surpriseArtistName is set; does not block global preload. */
function preloadNextArtistSong() {
    const artist = gameState.surpriseArtistName && gameState.surpriseArtistName.trim();
    if (!artist || userSongLoadInProgress || preloadedArtistSongs.length >= PRELOAD_QUEUE_MAX || preloadArtistInProgress) return;
    if (preloadedArtistName !== artist) {
        preloadedArtistName = artist;
        preloadedArtistSongs = [];
    }
    preloadArtistInProgress = true;
    getSongsByArtist(artist)
        .then(songs => {
            if (!songs.length) return null;
            let pool = songs.filter(s => !triedSongsInSession.has(`${s.title.toLowerCase()}_${s.artist.toLowerCase()}`));
            if (pool.length === 0) {
                pool = songs;
            }
            const chosen = pool[Math.floor(Math.random() * pool.length)];
            triedSongsInSession.add(`${chosen.title.toLowerCase()}_${chosen.artist.toLowerCase()}`);
            return fetchLyrics(chosen.title, chosen.artist).then(lyrics => ({ title: chosen.title, artist: chosen.artist, lyrics }));
        })
        .then(result => {
            if (result && result.lyrics && result.lyrics.trim().length >= 50 && isLikelyEnglish(result.lyrics)) {
                preloadedArtistSongs.push({ title: result.title, artist: result.artist, lyrics: result.lyrics });
                updatePreloadCounter();
            }
        })
        .catch(() => {})
        .finally(() => {
            preloadArtistInProgress = false;
            if (gameState.surpriseArtistName && gameState.surpriseArtistName.trim() && preloadedArtistSongs.length < PRELOAD_QUEUE_MAX) {
                preloadNextArtistSong();
            }
        });
}

/** Take one preloaded artist song from the queue, or null if none. */
function takePreloadedArtistSong() {
    const song = preloadedArtistSongs.length > 0 ? preloadedArtistSongs.shift() : null;
    if (song) updatePreloadCounter();
    return song;
}

/** Take one preloaded song from the queue, or null if none. */
function takePreloadedSong() {
    const song = preloadedSurpriseSongs.length > 0 ? preloadedSurpriseSongs.shift() : null;
    if (song) updatePreloadCounter();
    return song;
}

/** Use a preloaded surprise song: show game without fetching. Caller passes the song and kicks next preload. */
function applyPreloadedSong(song) {
    const startBtn = document.getElementById('startBtn');
    const surpriseBtn = document.getElementById('surpriseBtn');
    gameState.surpriseArtistName = ''; // global surprise, not by artist
    initializeGame(song.lyrics, song.title, song.artist, true, song.year || null, song.rank || null, song.topK || null);
    const songSelectionOverlay = document.getElementById('songSelectionOverlay');
    if (songSelectionOverlay) songSelectionOverlay.style.display = 'none';
    document.getElementById('gameSetup').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    updateFailedSongsDisplay(globalFailedSongs);
    startBtn.innerHTML = 'Start Game';
    startBtn.disabled = false;
    if (surpriseBtn) {
        surpriseBtn.innerHTML = '🎲 Surprise Me!';
        surpriseBtn.disabled = false;
    }
    const wordInputEl = document.getElementById('wordInput');
    if (wordInputEl) wordInputEl.focus();
    updateDevModeUI();
}

/** Hide victory message and re-enable word input (e.g. when loading next song). */
function resetVictoryUI() {
    const victoryMessage = document.getElementById('victoryMessage');
    if (victoryMessage) victoryMessage.style.display = 'none';
    const wordInputEl = document.getElementById('wordInput');
    if (wordInputEl) wordInputEl.disabled = false;
}

/** Play a short refresh animation on the lyrics area so the user feels the song changed. */
function playSongRefreshAnimation() {
    const container = document.querySelector('.lyrics-table-container');
    if (!container) return;
    container.classList.remove('song-refresh');
    void container.offsetWidth; // force reflow so animation can run again
    container.classList.add('song-refresh');
    setTimeout(() => container.classList.remove('song-refresh'), 460);
}

/** Load next surprise song (only in surprise game). Uses preload if ready, else fetches one. When surpriseArtistName is set, picks from that artist. */
async function nextSurpriseSong() {
    if (!gameState.isSurpriseSong) return;
    const nextSongBtn = document.getElementById('nextSongBtn');
    if (!nextSongBtn) return;
    nextSongBtn.innerHTML = 'Loading... <span class="loading"></span>';
    nextSongBtn.disabled = true;
    resetVictoryUI();

    const byArtist = gameState.surpriseArtistName && gameState.surpriseArtistName.trim();
    if (!byArtist) {
        const preloaded = takePreloadedSong();
        if (preloaded && preloaded.lyrics && preloaded.lyrics.trim().length >= 50) {
            const key = `${preloaded.title.toLowerCase()}_${preloaded.artist.toLowerCase()}`;
            triedSongsInSession.add(key);
            applyPreloadedSong(preloaded);
            preloadNextSurpriseSong();
            nextSongBtn.innerHTML = 'Next Song →';
            nextSongBtn.disabled = false;
            playSongRefreshAnimation();
            return;
        }
    } else {
        const preloadedArtist = takePreloadedArtistSong();
        if (preloadedArtist && preloadedArtist.lyrics && preloadedArtist.lyrics.trim().length >= 50) {
            const key = `${preloadedArtist.title.toLowerCase()}_${preloadedArtist.artist.toLowerCase()}`;
            triedSongsInSession.add(key);
            // Set actual artist name from the song (for matching)
            gameState.surpriseArtistName = preloadedArtist.artist;
            // Keep requested artist name if already set, otherwise use the song artist
            if (!gameState.requestedArtistName) {
                gameState.requestedArtistName = preloadedArtist.artist;
            }
            initializeGame(preloadedArtist.lyrics, preloadedArtist.title, preloadedArtist.artist, true, preloadedArtist.year || null, preloadedArtist.rank || null, preloadedArtist.topK || null);
            updateFailedSongsDisplay(globalFailedSongs);
            document.getElementById('gameArea').style.display = 'block';
            const wordInputEl = document.getElementById('wordInput');
            if (wordInputEl) wordInputEl.focus();
            updateDevModeUI();
            preloadNextArtistSong();
            nextSongBtn.innerHTML = 'Next Song →';
            nextSongBtn.disabled = false;
            playSongRefreshAnimation();
            return;
        }
    }

    try {
        let song;
        if (byArtist) {
            const songs = await getSongsByArtist(gameState.surpriseArtistName);
            if (!songs.length) throw new Error('No songs for this artist');
            let pool = songs.filter(s => !triedSongsInSession.has(`${s.title.toLowerCase()}_${s.artist.toLowerCase()}`));
            if (pool.length === 0) {
                triedSongsInSession.clear();
                pool = songs;
            }
            song = pool[Math.floor(Math.random() * pool.length)];
            triedSongsInSession.add(`${song.title.toLowerCase()}_${song.artist.toLowerCase()}`);
            // Set actual artist name from the song (for matching)
            gameState.surpriseArtistName = song.artist;
            // Keep requested artist name if already set
            if (!gameState.requestedArtistName) {
                gameState.requestedArtistName = song.artist;
            }
            
            // Try to get year from static database
            let songYear = song.year || null;
            if (!songYear) {
                try {
                    const db = await loadStaticSongsDb();
                    const match = db.find(s => 
                        s.title.toLowerCase() === song.title.toLowerCase() && 
                        s.artist.toLowerCase() === song.artist.toLowerCase()
                    );
                    if (match && match.year) {
                        songYear = match.year;
                    }
                } catch (e) {
                    // If we can't load the database, continue without year
                }
            }
        } else {
            song = await getRandomPopularSong();
        }
        const lyrics = await fetchLyrics(song.title, song.artist);
        if (!lyrics || lyrics.trim().length < 50) throw new Error('No lyrics');
        if (!isLikelyEnglish(lyrics)) throw new Error('Lyrics not English');
        initializeGame(lyrics, song.title, song.artist, true, songYear || null, song.rank || null, song.topK || null);
        updateFailedSongsDisplay(globalFailedSongs);
        const wordInputEl = document.getElementById('wordInput');
        if (wordInputEl) wordInputEl.focus();
        updateDevModeUI();
        if (byArtist) preloadNextArtistSong();
        else preloadNextSurpriseSong();
        playSongRefreshAnimation();
    } catch (err) {
        console.error('Next song failed:', err);
        showError('Could not load next song. Try again.');
    }
    nextSongBtn.innerHTML = 'Next Song →';
    nextSongBtn.disabled = false;
}

function updateFailedSongsDisplay(failedSongs) {
    if (!Array.isArray(failedSongs)) {
        failedSongs = [];
    }
    // Only show failed songs if dev mode is on
    if (!devMode) {
        const failedSongsDiv = document.getElementById('failedSongs');
        const failedSongsDivGame = document.getElementById('failedSongsGame');
        if (failedSongsDiv) failedSongsDiv.style.display = 'none';
        if (failedSongsDivGame) failedSongsDivGame.style.display = 'none';
        return;
    }
    
    const failedSongsDiv = document.getElementById('failedSongs');
    const failedSongsList = document.getElementById('failedSongsList');
    const failedSongsDivGame = document.getElementById('failedSongsGame');
    const failedSongsListGame = document.getElementById('failedSongsListGame');
    
    const displayHtml = failedSongs.map((song, idx) => 
        `<div class="failed-song-item">${idx + 1}. ${song}</div>`
    ).join('');
    
    if (failedSongsList) {
        failedSongsList.innerHTML = displayHtml;
    }
    if (failedSongsListGame) {
        failedSongsListGame.innerHTML = displayHtml;
    }
    
    const shouldShow = failedSongs.length > 0;
    if (failedSongsDiv) {
        failedSongsDiv.style.display = shouldShow ? 'block' : 'none';
    }
    if (failedSongsDivGame) {
        failedSongsDivGame.style.display = shouldShow ? 'block' : 'none';
    }
}

async function surpriseMe() {
    const errorMessage = document.getElementById('errorMessage');
    const surpriseBtn = document.getElementById('surpriseBtn');
    const startBtn = document.getElementById('startBtn');
    
    // Hide error and selection
    errorMessage.classList.remove('show');
    document.getElementById('songSelection').style.display = 'none';
    
    // If we have at least one preloaded song, use it immediately and refill in background
    const preloaded = takePreloadedSong();
    if (preloaded && preloaded.lyrics && preloaded.lyrics.trim().length >= 50) {
        gameState.surpriseArtistName = ''; // global surprise, not by artist
        surpriseBtn.innerHTML = 'Finding a surprise... <span class="loading"></span>';
        surpriseBtn.disabled = true;
        startBtn.disabled = true;
        const key = `${preloaded.title.toLowerCase()}_${preloaded.artist.toLowerCase()}`;
        triedSongsInSession.add(key);
        applyPreloadedSong(preloaded);
        preloadNextSurpriseSong();
        return;
    }

    gameState.surpriseArtistName = ''; // global surprise
    // Clear previous failed songs list when starting new search
    globalFailedSongs = [];
    triedSongsInSession.clear(); // Reset tried songs for new session
    updateFailedSongsDisplay(globalFailedSongs);
    
    // Show loading only on Surprise button; disable both
    surpriseBtn.innerHTML = 'Finding a surprise... <span class="loading"></span>';
    surpriseBtn.disabled = true;
    startBtn.disabled = true;
    
    const maxRetries = 10;
    let attempts = 0;
    let lastError = null;
    
    // Add timeout safeguard to prevent infinite loops
    const startTime = Date.now();
    const maxTime = 60000; // 60 seconds max
    
    while (attempts < maxRetries) {
        // Safety check: prevent infinite loops with timeout
        if (Date.now() - startTime > maxTime) {
            console.error('Timeout: Surprise song search took too long');
            showError('Search timed out. Please try again.');
            surpriseBtn.innerHTML = '🎲 Surprise Me!';
            surpriseBtn.disabled = false;
            startBtn.disabled = false;
            return;
        }
        
        let randomSong = null;
        
        try {
            attempts++;
            
            // Update loading message
            if (attempts > 1) {
                surpriseBtn.innerHTML = `Trying song ${attempts}/${maxRetries}... <span class="loading"></span>`;
            }
            
            // Get a random popular song
            try {
                randomSong = await getRandomPopularSong();
            } catch (songError) {
                // Failed to get a random song
                console.error('Error getting random song:', songError);
                lastError = songError;
                if (attempts >= maxRetries) {
                    const errorMsg = `Failed to get random songs after ${maxRetries} attempts. ${globalFailedSongs.length > 0 ? `Failed songs: ${globalFailedSongs.length}` : ''}`;
                    showError(errorMsg);
                    surpriseBtn.innerHTML = '🎲 Surprise Me!';
                    surpriseBtn.disabled = false;
                    startBtn.disabled = false;
                    return;
                }
                // Add small delay to prevent rapid retries
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }
            
            // Try to load the song (this will fetch lyrics)
            try {
                await loadSong(randomSong.title, randomSong.artist, true, randomSong.year || null, randomSong.rank || null, randomSong.topK || null); // true = is surprise song
                // Success! Exit the retry loop
                // Keep failed songs visible (don't hide on success)
                return;
            } catch (lyricsError) {
                // Lyrics not found or failed to fetch for this song, track it and try another one
                const failedSong = `${randomSong.title} by ${randomSong.artist}`;
                if (!globalFailedSongs.includes(failedSong)) {
                    globalFailedSongs.push(failedSong);
                }
                console.log(`Failed to load lyrics for ${failedSong}:`, lyricsError.message || lyricsError);
                lastError = lyricsError;
                
                // Update failed songs display in both screens
                updateFailedSongsDisplay(globalFailedSongs);
                
                if (attempts >= maxRetries) {
                    const failedCount = globalFailedSongs.length;
                    const errorMsg = `Could not find a song with available lyrics after ${maxRetries} attempts. ${failedCount > 0 ? `Failed songs: ${failedCount}` : ''}`;
                    showError(errorMsg);
                    surpriseBtn.innerHTML = '🎲 Surprise Me!';
                    surpriseBtn.disabled = false;
                    startBtn.disabled = false;
                    return;
                }
                // Add small delay to prevent rapid retries
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }
            
        } catch (error) {
            // Unexpected error - track the song if we have it
            lastError = error;
            if (randomSong) {
                const failedSong = `${randomSong.title} by ${randomSong.artist}`;
                if (!globalFailedSongs.includes(failedSong)) {
                    globalFailedSongs.push(failedSong);
                }
                updateFailedSongsDisplay(globalFailedSongs);
            }
            
            if (attempts >= maxRetries) {
                const failedCount = globalFailedSongs.length;
                const errorMsg = `${error.message || 'Failed to load surprise song'}. ${failedCount > 0 ? `Failed songs: ${failedCount}` : ''}`;
                showError(errorMsg);
                surpriseBtn.innerHTML = '🎲 Surprise Me!';
                surpriseBtn.disabled = false;
                startBtn.disabled = false;
                return;
            }
            // Add small delay to prevent rapid retries
            await new Promise(resolve => setTimeout(resolve, 500));
            // Continue retrying
        }
    }
    
    // If we exit the loop without returning, something went wrong
    if (attempts >= maxRetries) {
        const errorMsg = lastError ? lastError.message : 'Failed to load surprise song after multiple attempts';
        showError(errorMsg);
        surpriseBtn.innerHTML = '🎲 Surprise Me!';
        surpriseBtn.disabled = false;
        startBtn.disabled = false;
    }
}

async function surpriseByArtist() {
    const artistInputEl = document.getElementById('artistInput');
    const artistName = (artistInputEl && artistInputEl.value) ? artistInputEl.value.trim() : '';
    const errorMessage = document.getElementById('errorMessage');
    const surpriseByArtistBtn = document.getElementById('surpriseByArtistBtn');
    const startBtn = document.getElementById('startBtn');
    const surpriseBtn = document.getElementById('surpriseBtn');

    errorMessage.classList.remove('show');
    const songSelectionOverlay = document.getElementById('songSelectionOverlay');
    if (songSelectionOverlay) songSelectionOverlay.style.display = 'none';

    if (!artistName) {
        showError('Please enter an artist name');
        return;
    }

    globalFailedSongs = [];
    triedSongsInSession.clear();
    updateFailedSongsDisplay(globalFailedSongs);

    surpriseByArtistBtn.innerHTML = 'Finding a song... <span class="loading"></span>';
    surpriseByArtistBtn.disabled = true;
    startBtn.disabled = true;
    if (surpriseBtn) surpriseBtn.disabled = true;

    let songs = [];
    try {
        songs = await getSongsByArtist(artistName);
    } catch (e) {
        showError('Could not find songs for that artist. Try another name.');
        surpriseByArtistBtn.innerHTML = '🎤 Random song by artist';
        surpriseByArtistBtn.disabled = false;
        startBtn.disabled = false;
        if (surpriseBtn) surpriseBtn.disabled = false;
        return;
    }

    if (!songs.length) {
        showError(`No eligible songs found for "${artistName}". Try another artist.`);
        surpriseByArtistBtn.innerHTML = '🎤 Random song by artist';
        surpriseByArtistBtn.disabled = false;
        startBtn.disabled = false;
        if (surpriseBtn) surpriseBtn.disabled = false;
        return;
    }

    const maxRetries = 10;
    let attempts = 0;
    const startTime = Date.now();
    const maxTime = 60000;

    while (attempts < maxRetries) {
        if (Date.now() - startTime > maxTime) {
            showError('Search timed out. Please try again.');
            break;
        }
        attempts++;
        if (attempts > 1) {
            surpriseByArtistBtn.innerHTML = `Trying song ${attempts}/${maxRetries}... <span class="loading"></span>`;
        }
        let pool = songs.filter(s => !triedSongsInSession.has(`${s.title.toLowerCase()}_${s.artist.toLowerCase()}`));
        if (pool.length === 0) {
            triedSongsInSession.clear();
            pool = songs;
        }
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        triedSongsInSession.add(`${chosen.title.toLowerCase()}_${chosen.artist.toLowerCase()}`);
        try {
            // Store requested artist name for banner display (extract just the requested artist from collaborations)
            gameState.requestedArtistName = artistName;
            // Set actual artist name from the song (for matching) BEFORE loading song so initializeGame can detect it
            gameState.surpriseArtistName = chosen.artist;
            
            // Try to get year from static database
            let songYear = null;
            try {
                const db = await loadStaticSongsDb();
                const match = db.find(s => 
                    s.title.toLowerCase() === chosen.title.toLowerCase() && 
                    s.artist.toLowerCase() === chosen.artist.toLowerCase()
                );
                if (match && match.year) {
                    songYear = match.year;
                }
            } catch (e) {
                // If we can't load the database, continue without year
            }
            
            await loadSong(chosen.title, chosen.artist, true, songYear);
            preloadNextArtistSong(); // start preloading more songs by this artist
            surpriseByArtistBtn.innerHTML = '🎤 Random song by artist';
            surpriseByArtistBtn.disabled = false;
            startBtn.disabled = false;
            if (surpriseBtn) surpriseBtn.disabled = false;
            return;
        } catch (lyricsError) {
            const failedSong = `${chosen.title} by ${chosen.artist}`;
            if (!globalFailedSongs.includes(failedSong)) globalFailedSongs.push(failedSong);
            updateFailedSongsDisplay(globalFailedSongs);
            if (attempts >= maxRetries) {
                showError(`Could not find a song with lyrics after ${maxRetries} attempts. ${globalFailedSongs.length > 0 ? `Failed: ${globalFailedSongs.length}` : ''}`);
                break;
            }
            await new Promise(r => setTimeout(r, 500));
        }
    }
    surpriseByArtistBtn.innerHTML = '🎤 Random song by artist';
    surpriseByArtistBtn.disabled = false;
    startBtn.disabled = false;
    if (surpriseBtn) surpriseBtn.disabled = false;
}

async function startGame() {
    const songInput = document.getElementById('songInput');
    const errorMessage = document.getElementById('errorMessage');
    const startBtn = document.getElementById('startBtn');
    const songName = songInput.value.trim();

    if (!songName) {
        showError('Please enter a song name');
        return;
    }

    // Clear failed songs list when starting new search
    globalFailedSongs = [];
    updateFailedSongsDisplay(globalFailedSongs);

    // Show loading only on Start Game button; disable other lobby buttons
    const surpriseBtn = document.getElementById('surpriseBtn');
    const surpriseByArtistBtn = document.getElementById('surpriseByArtistBtn');
    startBtn.innerHTML = 'Searching... <span class="loading"></span>';
    startBtn.disabled = true;
    if (surpriseBtn) surpriseBtn.disabled = true;
    if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = true;
    errorMessage.classList.remove('show');
    document.getElementById('songSelection').style.display = 'none';

    try {
        // Search for songs by title only
        const songs = await searchSongs(songName);
        
        if (!songs || songs.length === 0) {
            throw new Error('No songs found. Try the full song title or include the artist name.');
        }

        // If multiple songs found, show selection
        if (songs.length > 1) {
            showSongSelection(songs, songName);
            return;
        }

        // Single song found, proceed directly
        const selectedSong = songs[0];
        await loadSong(selectedSong.title, selectedSong.artist);

    } catch (error) {
        showError(error.message || 'Failed to search for songs. Please try again.');
        startBtn.innerHTML = 'Start Game';
        startBtn.disabled = false;
        if (surpriseBtn) {
            surpriseBtn.innerHTML = '🎲 Surprise Me!';
            surpriseBtn.disabled = false;
        }
        if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = false;
    }
}

async function loadSong(title, artist, isSurprise = false, year = null, rank = null, topK = null) {
    const startBtn = document.getElementById('startBtn');
    const surpriseBtn = document.getElementById('surpriseBtn');
    const surpriseByArtistBtn = document.getElementById('surpriseByArtistBtn');
    if (!isSurprise) userSongLoadInProgress = true;

    try {
        // Show loading only on the button that triggered this flow; disable other lobby buttons
        // Check if this is artist mode (surpriseArtistName is set before loadSong is called)
        const isArtistMode = gameState.surpriseArtistName && gameState.surpriseArtistName.trim();
        
        if (isSurprise) {
            if (isArtistMode && surpriseByArtistBtn) {
                // Artist mode: show loading on artist button, not surprise button
                surpriseByArtistBtn.innerHTML = 'Loading lyrics... <span class="loading"></span>';
                surpriseByArtistBtn.disabled = true;
            } else if (surpriseBtn) {
                // Regular surprise mode: show loading on surprise button
                surpriseBtn.innerHTML = 'Loading lyrics... <span class="loading"></span>';
                surpriseBtn.disabled = true;
            }
            startBtn.disabled = true;
            if (!isArtistMode && surpriseByArtistBtn) surpriseByArtistBtn.disabled = true;
            if (isArtistMode && surpriseBtn) surpriseBtn.disabled = true;
        } else {
            startBtn.innerHTML = 'Loading lyrics... <span class="loading"></span>';
            startBtn.disabled = true;
            if (surpriseBtn) surpriseBtn.disabled = true;
            if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = true;
        }

        // Fetch lyrics (user's request gets full priority - no background preload started while this runs)
        const lyrics = await fetchLyrics(title, artist);

        if (!lyrics || lyrics.trim().length === 0) {
            throw new Error('Could not find lyrics for this song. Please try another song.');
        }

        // Initialize game
        initializeGame(lyrics, title, artist, isSurprise, year, rank, topK);

        // Hide selection if visible
        const songSelectionOverlay = document.getElementById('songSelectionOverlay');
        if (songSelectionOverlay) songSelectionOverlay.style.display = 'none';

        // Show game area
        document.getElementById('gameSetup').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';

        // Update failed songs display to show in game screen
        updateFailedSongsDisplay(globalFailedSongs);

        // Reset button states
        startBtn.innerHTML = 'Start Game';
        startBtn.disabled = false;
        if (surpriseBtn) {
            surpriseBtn.innerHTML = '🎲 Surprise Me!';
            surpriseBtn.disabled = false;
        }
        if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = false;

        // Focus on word input
        const wordInputEl = document.getElementById('wordInput');
        if (wordInputEl) {
            wordInputEl.focus();
        }

        // Update dev mode UI after game loads
        updateDevModeUI();
    } catch (error) {
        console.error('loadSong error:', error);
        // Only show error if not called from surpriseMe (surpriseMe handles its own errors)
        if (!isSurprise) {
            const errorMsg = error.message || 'Failed to fetch lyrics. Please try again.';
            console.error('Showing error to user:', errorMsg);
            showError(errorMsg);
            startBtn.innerHTML = 'Start Game';
            startBtn.disabled = false;
            if (surpriseBtn) {
                surpriseBtn.innerHTML = '🎲 Surprise Me!';
                surpriseBtn.disabled = false;
            }
            if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = false;
        }
        // Always re-throw error so surpriseMe can handle it
        throw error;
    } finally {
        userSongLoadInProgress = false;
        preloadNextSurpriseSong();
    }
}

/** Common Spanish words (whole-word match). Used to detect Spanish lyrics; need 5+ matches to reject. */
const SPANISH_WORDS = new Set([
    'que', 'como', 'esta', 'pero', 'para', 'porque', 'tambien', 'tiene', 'del', 'al', 'los', 'las',
    'una', 'eso', 'esa', 'todo', 'todos', 'nada', 'siempre', 'desde', 'hasta', 'donde', 'por', 'con',
    'sus', 'cuando', 'muy', 'sin', 'sobre', 'nos', 'les', 'aqui', 'ahora', 'despues', 'antes', 'otra',
    'otro', 'puede', 'quiero', 'noche', 'dia', 'hombre', 'mujer', 'hijo', 'madre', 'padre', 'gente',
    'mismo', 'estan', 'todavia', 'entonces', 'aunque', 'mientras', 'cual', 'cuyo', 'cada', 'alguien',
    'algo', 'ningun', 'ninguna', 'nunca', 'tampoco', 'pronto', 'luego', 'sino', 'fueron', 'haber',
    'hacer', 'llegar', 'dejar', 'seguir', 'encontrar', 'llamar', 'venir', 'pensar', 'volver', 'conocer',
    'vivir', 'sentir', 'tratar', 'mirar', 'contar', 'empezar', 'esperar', 'buscar', 'existir', 'entrar',
    'trabajar', 'escribir', 'perder', 'producir', 'entender', 'pedir', 'recibir', 'recordar', 'terminar',
    'creer', 'crear', 'abrir', 'tomar', 'morir', 'aceptar', 'realizar', 'suponer', 'hablar', 'llevar',
    'comenzar', 'servir', 'sacar', 'necesitar', 'mantener', 'resultar', 'conseguir', 'explicar',
    'preguntar', 'reconocer', 'establecer', 'lograr', 'aparecer', 'estoy', 'eres', 'somos', 'tienes',
    'quieres', 'puedo', 'sabes', 'dice', 'hace', 'voy', 'vas', 'vamos', 'dan', 'danos', 'dame',
    'ella', 'nuestro', 'vuestro', 'estas', 'estos', 'esos', 'esas', 'aquella', 'aquel'
]);

/** Normalize word for Spanish check: lowercase, strip accents (so "qué" matches "que"). */
function normalizeForLangCheck(word) {
    return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Count Spanish indicator words (whole words) in text. Only reject if >= 5 to avoid false positives. */
function countSpanishWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const tokens = text.split(/[^\p{L}']+/u).filter(Boolean);
    let count = 0;
    for (const token of tokens) {
        const w = normalizeForLangCheck(token);
        if (w.length < 2) continue;
        if (SPANISH_WORDS.has(w)) count++;
    }
    return count;
}

/** True if text looks like English. Rejects non-Latin scripts; rejects Spanish only if enough Spanish words (stricter for short text). */
function isLikelyEnglish(text) {
    if (!text || typeof text !== 'string') return true;
    // Strong Spanish indicators in any amount (title/artist or lyrics with punctuation)
    if (/ñ|¿|¡/i.test(text)) return false;
    // Non-Latin scripts (CJK, Korean Hangul, Cyrillic, Arabic, Hebrew, Thai, Greek, etc.)
    const nonLatin = /[\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u1100-\u11FF\u0E00-\u0E7F\u0370-\u03FF]/;
    if (nonLatin.test(text)) return false;
    // Short text (title/artist): skip Spanish word count to avoid false positives (e.g. "Queen", "Bohemian Rhapsody")
    if (text.length < 150) return true;
    // Long text (lyrics): reject only if 10+ Spanish words to avoid banning English songs with a few shared words
    if (countSpanishWords(text) >= 10) return false;
    return true;
}

function isOriginalVersion(trackName) {
    // Filter out non-original versions
    const nonOriginalKeywords = [
        'live',
        'acoustic',
        'remix',
        'cover',
        'version',
        'unplugged',
        'studio',
        'session',
        'demo',
        'instrumental',
        'karaoke',
        'extended',
        'radio edit',
        'explicit',
        'clean'
    ];
    
    const lowerTitle = trackName.toLowerCase();
    
    // Check if title contains any non-original keywords
    for (const keyword of nonOriginalKeywords) {
        // Use word boundaries to avoid false positives (e.g., "alive" shouldn't match "live")
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(lowerTitle)) {
            return false;
        }
    }
    
    return true;
}

async function searchSongs(query) {
    const apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=50`;

    let response;
    try {
        response = await fetch(apiUrl);
    } catch (networkError) {
        console.error('Search network error:', networkError);
        throw new Error('Could not reach the search service. Check your internet connection and try again.');
    }

    if (!response.ok) {
        throw new Error('Search failed. Please try again in a moment.');
    }

    let data;
    try {
        data = await response.json();
    } catch (parseError) {
        console.error('Search parse error:', parseError);
        throw new Error('Search returned invalid data. Please try again.');
    }

    if (!data.results || data.results.length === 0) {
        return [];
    }

    const uniqueSongs = [];
    const seen = new Set();

        data.results.forEach(result => {
            if (!isOriginalVersion(result.trackName)) return;
            if (!isLikelyEnglish(result.trackName) || !isLikelyEnglish(result.artistName)) return;
            const key = `${result.trackName.toLowerCase()}_${result.artistName.toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueSongs.push({
                    title: result.trackName,
                    artist: result.artistName,
                    album: result.collectionName
                });
            }
        });

    return uniqueSongs;
}

function showSongSelection(songs, query) {
    const songSelectionOverlay = document.getElementById('songSelectionOverlay');
    const songSelection = document.getElementById('songSelection');
    const songList = document.getElementById('songList');
    const startBtn = document.getElementById('startBtn');
    const surpriseBtn = document.getElementById('surpriseBtn');
    
    if (!songSelectionOverlay) return;
    
    songList.innerHTML = '';
    
    songs.forEach((song, index) => {
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        songItem.innerHTML = `
            <div class="song-item-info">
                <strong>${song.title}</strong>
                <span class="song-artist">by ${song.artist}</span>
                ${song.album ? `<span class="song-album">from ${song.album}</span>` : ''}
            </div>
        `;
        songItem.addEventListener('click', async () => {
            songSelectionOverlay.style.display = 'none';
            try {
                await loadSong(song.title, song.artist);
            } catch (err) {
                // Show error message and re-display overlay
                showError(err.message || 'Could not load lyrics for this song. Please try another one.');
                songSelectionOverlay.style.display = 'flex';
            }
        });
        songList.appendChild(songItem);
    });
    
    songSelectionOverlay.style.display = 'flex';
    startBtn.innerHTML = 'Start Game';
    startBtn.disabled = false;
    if (surpriseBtn) {
        surpriseBtn.innerHTML = '🎲 Surprise Me!';
        surpriseBtn.disabled = false;
    }
    const surpriseByArtistBtn = document.getElementById('surpriseByArtistBtn');
    if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = false;
}


// Helper function to generate name variations for better matching
function generateNameVariations(artist, title) {
    const variations = [];
    
    // Clean and normalize
    const cleanArtist = (artist || '').trim();
    const cleanTitle = title.trim();
    
    // Base variations
    variations.push({ artist: cleanArtist, title: cleanTitle });
    
    // Remove common suffixes/prefixes from title
    const titleVariations = [
        cleanTitle,
        cleanTitle.split('(')[0].trim(), // Remove parentheticals
        cleanTitle.split('[')[0].trim(), // Remove brackets
        cleanTitle.split('-')[0].trim(), // Remove after dash
        cleanTitle.replace(/\(.*?\)/g, '').trim(), // Remove all parentheticals
        cleanTitle.replace(/\[.*?\]/g, '').trim(), // Remove all brackets
    ].filter((t, i, arr) => arr.indexOf(t) === i && t.length > 0); // Unique and non-empty
    
    // Artist variations
    const artistVariations = [
        cleanArtist,
        cleanArtist.split(' ')[0], // First name only
        cleanArtist.split(' & ')[0], // Before "&"
        cleanArtist.split(' and ')[0], // Before "and"
        cleanArtist.split(' feat')[0], // Before "feat"
        cleanArtist.split(' ft')[0], // Before "ft"
        cleanArtist.split(' ft.')[0], // Before "ft."
        cleanArtist.split(' featuring')[0], // Before "featuring"
        cleanArtist.replace(/\(.*?\)/g, '').trim(), // Remove parentheticals
    ].filter((a, i, arr) => arr.indexOf(a) === i && a.length > 0); // Unique and non-empty
    
    // Generate all combinations
    const allVariations = [];
    for (const titleVar of titleVariations) {
        for (const artistVar of artistVariations) {
            if (titleVar && artistVar) {
                allVariations.push({ artist: artistVar, title: titleVar });
            }
        }
    }
    
    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for (const v of allVariations) {
        const key = `${v.artist}|${v.title}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(v);
        }
    }
    
    return unique;
}

// Helper function to get exact song metadata from iTunes
async function getSongFromiTunes(title, artist) {
    // Try searching iTunes with the provided title and artist
    const searchQuery = artist ? `${title} ${artist}` : title;
    const apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=10`;
    
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('iTunes search failed');
        }
        
        const data = await response.json();
        if (!data.results || data.results.length === 0) {
            return { title, artist: artist || 'Unknown', album: '', durationSeconds: null };
        }
        
        // Find the best match - prioritize exact title match
        let bestMatch = data.results[0];
        for (const result of data.results) {
            if (result.trackName.toLowerCase() === title.toLowerCase()) {
                bestMatch = result;
                break;
            }
        }
        
        // Return iTunes metadata (most accurate), include duration for LRCLIB exact match
        const durationMs = bestMatch.trackTimeMillis;
        const durationSec = durationMs != null ? Math.round(durationMs / 1000) : null;
        return {
            title: bestMatch.trackName,
            artist: bestMatch.artistName,
            album: bestMatch.collectionName || '',
            durationSeconds: durationSec
        };
    } catch (error) {
        console.log('iTunes lookup failed, using provided values:', error);
        return { title, artist: artist || 'Unknown', album: '', durationSeconds: null };
    }
}

// ---------- Lyrics fetching (standalone module) ----------
// Uses free, no-API-key sources: LRCLIB (CORS-friendly) + Lyrics.ovh (via CORS proxy).
// Flow: iTunes metadata → name variations → try providers in parallel per variation; first success wins.

const LYRICS_MIN_LENGTH = 50;
const LYRICS_REQUEST_TIMEOUT_MS = 12000;

/** Race a promise against a timeout. Rejects with "Request timed out" after ms. */
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
    ]);
}

/** LRCLIB: get by exact signature (track, artist, album, duration). Best match when we have duration from iTunes. */
async function fetchFromLrclibGet(artist, title, album, durationSeconds) {
    if (durationSeconds == null || durationSeconds <= 0) throw new Error('LRCLIB get requires duration');
    const params = new URLSearchParams({
        track_name: title,
        artist_name: artist || 'Unknown',
        album_name: album || '',
        duration: String(durationSeconds)
    });
    const url = `https://lrclib.net/api/get?${params.toString()}`;
    const res = await withTimeout(
        fetch(url, { headers: { 'Accept': 'application/json' } }),
        LYRICS_REQUEST_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`LRCLIB get HTTP ${res.status}`);
    const data = await res.json();
    const lyrics = data.plainLyrics || data.syncedLyrics;
    if (!lyrics || String(lyrics).trim().length < LYRICS_MIN_LENGTH) throw new Error('LRCLIB get empty lyrics');
    return String(lyrics).trim();
}

/** LRCLIB: search by query, return plain lyrics from first match. No API key, CORS enabled. */
async function fetchFromLrclib(artist, title) {
    const q = `${title} ${artist}`.trim();
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
    const res = await withTimeout(
        fetch(url, { headers: { 'Accept': 'application/json' } }),
        LYRICS_REQUEST_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`LRCLIB HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) throw new Error('LRCLIB no results');
    const first = list[0];
    const lyrics = first.plainLyrics || first.syncedLyrics;
    if (!lyrics || String(lyrics).trim().length < LYRICS_MIN_LENGTH) throw new Error('LRCLIB empty lyrics');
    return String(lyrics).trim();
}

/** Lyrics.ovh via AllOrigins CORS proxy. */
async function fetchFromLyricsOvh(artist, title) {
    const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist || 'Unknown')}/${encodeURIComponent(title)}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(ovhUrl)}`;
    const res = await withTimeout(fetch(proxyUrl), LYRICS_REQUEST_TIMEOUT_MS);
    if (!res.ok) throw new Error(`Lyrics.ovh proxy HTTP ${res.status}`);
    const proxy = await res.json();
    const data = JSON.parse(proxy.contents || '{}');
    const lyrics = data.lyrics;
    if (!lyrics || String(lyrics).trim().length < LYRICS_MIN_LENGTH) throw new Error('Lyrics.ovh empty or not found');
    return String(lyrics).trim();
}

/** Lyrics.ovh via corsproxy.io (fallback when AllOrigins is down). */
async function fetchFromLyricsOvhCorsProxy(artist, title) {
    const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist || 'Unknown')}/${encodeURIComponent(title)}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(ovhUrl)}`;
    const res = await withTimeout(fetch(proxyUrl), LYRICS_REQUEST_TIMEOUT_MS);
    if (!res.ok) throw new Error(`Lyrics.ovh corsproxy HTTP ${res.status}`);
    const data = await res.json();
    const lyrics = data && data.lyrics;
    if (!lyrics || String(lyrics).trim().length < LYRICS_MIN_LENGTH) throw new Error('Lyrics.ovh empty or not found');
    return String(lyrics).trim();
}

/** Try all providers in parallel; return first successful lyrics string. */
async function tryAllProviders(artist, title) {
    const providers = [
        () => fetchFromLrclib(artist, title),
        () => fetchFromLyricsOvh(artist, title),
        () => fetchFromLyricsOvhCorsProxy(artist, title)
    ];
    const results = await Promise.allSettled(providers.map(fn => fn()));
    for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled' && results[i].value && results[i].value.trim().length >= LYRICS_MIN_LENGTH) {
            return results[i].value;
        }
    }
    const errors = results.map((r) => (r.status === 'rejected' ? r.reason?.message : 'no content')).filter(Boolean);
    throw new Error(errors.length ? errors.join('; ') : 'All providers failed');
}

/** Main entry: resolve metadata via iTunes, try LRCLIB exact match if we have duration, then variations + providers. */
async function fetchLyrics(title, artist) {
    const iTunesMetadata = await getSongFromiTunes(title, artist);
    const exactTitle = iTunesMetadata.title;
    const exactArtist = iTunesMetadata.artist;
    const album = iTunesMetadata.album || '';
    const durationSeconds = iTunesMetadata.durationSeconds;

    if (durationSeconds != null && durationSeconds > 0) {
        try {
            const lyrics = await fetchFromLrclibGet(exactArtist, exactTitle, album, durationSeconds);
            if (lyrics && lyrics.trim().length >= LYRICS_MIN_LENGTH) {
                if (!isLikelyEnglish(lyrics)) throw new Error('Lyrics are not in English.');
                console.log('Lyrics found via LRCLIB get (exact match).');
                return lyrics;
            }
        } catch (err) {
            if (err.message === 'Lyrics are not in English.') throw err;
            console.log('LRCLIB get failed, trying search + providers:', err.message || err);
        }
    }

    const variations = generateNameVariations(exactArtist, exactTitle);
    for (let i = 0; i < variations.length; i++) {
        const { artist: a, title: t } = variations[i];
        try {
            const lyrics = await tryAllProviders(a, t);
            if (lyrics && lyrics.trim().length >= LYRICS_MIN_LENGTH) {
                if (!isLikelyEnglish(lyrics)) throw new Error('Lyrics are not in English.');
                console.log(`Lyrics found for "${t}" by ${a} (variation ${i + 1}/${variations.length}).`);
                return lyrics;
            }
        } catch (err) {
            if (err.message === 'Lyrics are not in English.') throw err;
            console.log(`Variation "${t}" by ${a}: ${err.message || err}`);
        }
    }

    throw new Error(`Could not find lyrics for "${exactTitle}" by ${exactArtist}. Tried ${variations.length} name variations.`);
}

// ---------- End lyrics fetching ----------

function initializeGame(lyrics, title, artist, isSurprise = false, year = null, rank = null, topK = null) {
    // Store original lyrics for reference
    console.log('Initializing game with lyrics:', lyrics.substring(0, 200) + '...');
    
    // Clean and parse lyrics
    const cleanedLyrics = cleanLyrics(lyrics);
    const words = tokenizeLyrics(cleanedLyrics);
    
    // Count actual words (excluding newlines)
    const actualWordCount = words.filter(w => !w.isNewline).length;
    
    // Store game state
    gameState.lyrics = cleanedLyrics.split('\n');
    gameState.words = words;
    gameState.foundWords = new Set();
    gameState.userGuessedWords = new Set();
    gameState.totalWords = actualWordCount;
    gameState.foundCount = 0;
    gameState.songTitle = title;
    gameState.songArtist = artist;
    gameState.songYear = year;
    gameState.songRank = rank;
    gameState.songYearTopK = topK;
    gameState.lyricsRevealed = false;
    gameState.isSurpriseSong = isSurprise;
    gameState.titleRevealed = !isSurprise; // Hide title if surprise song
    // Only track year reveal state in surprise mode (not artist mode)
    const isArtistMode = gameState.surpriseArtistName && gameState.surpriseArtistName.trim();
    const isSurpriseModeOnly = isSurprise && !isArtistMode;
    gameState.yearRevealed = !isSurpriseModeOnly; // Hide year if surprise mode (but not artist mode)
    gameState.yearRevealedBySong = false; // Reset flag
    
    // Reset reveal button
    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
        revealBtn.textContent = 'Reveal Lyrics';
        // Update visibility based on dev mode
        revealBtn.style.display = devMode ? 'inline-block' : 'none';
    }
    
    // Reset give up UI
    const giveUpResults = document.getElementById('giveUpResults');
    if (giveUpResults) giveUpResults.style.display = 'none';
    const inputSection = document.getElementById('inputSection');
    const endGameStats = document.getElementById('endGameStats');
    if (inputSection) inputSection.style.display = '';
    if (endGameStats) { endGameStats.style.display = 'none'; endGameStats.classList.remove('victory'); }
    const giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) {
        giveUpBtn.style.display = 'inline-block';
    }
    
    // Remove give-up-missed styling from all words
    document.querySelectorAll('.word-slot.give-up-missed').forEach(slot => {
        slot.classList.remove('give-up-missed');
    });
    const wordInput = document.getElementById('wordInput');
    if (wordInput) {
        wordInput.disabled = false;
        wordInput.placeholder = 'Type a word...';
    }
    
    // Show help button in game area
    const helpGameplayBtnGame = document.getElementById('helpGameplayBtnGame');
    if (helpGameplayBtnGame) helpGameplayBtnGame.style.display = 'inline-block';
    
        // Update dev mode UI to ensure correct visibility (will be called after game loads)

    // Update UI
    const songTitleEl = document.getElementById('songTitle');
    const songArtistEl = document.getElementById('songArtist');
    const songYearEl = document.getElementById('songYear');
    const revealTitleBtn = document.getElementById('revealTitleBtn');
    const revealYearBtn = document.getElementById('revealYearBtn');
    const youtubeLink = document.getElementById('youtubeLink');
    const nextSongBtn = document.getElementById('nextSongBtn');
    
    // Ensure revealTitleBtn exists before using it
    if (!revealTitleBtn) {
        console.error('revealTitleBtn not found');
    }
    
    // Set YouTube link
    if (youtubeLink) {
        const searchQuery = `${title} ${artist || ''}`.trim();
        // Set YouTube search URL immediately (will be updated to direct video if available)
        youtubeLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        youtubeLink.style.display = 'inline-block';
        youtubeLink.onclick = null; // Ensure no click handlers interfere
        
        // Fetch YouTube video URL asynchronously and update if successful
        getYouTubeVideoUrl(title, artist).then(url => {
            if (youtubeLink && url && url.startsWith('https://www.youtube.com/watch')) {
                youtubeLink.href = url;
            }
        }).catch(err => {
            console.error('Failed to get YouTube URL:', err);
            // Keep the search URL as fallback - it's already set above
        });
    }
    
    // Show/hide artist mode banner
    const artistModeBanner = document.getElementById('artistModeBanner');
    const artistModeName = document.getElementById('artistModeName');
    if (gameState.surpriseArtistName && gameState.surpriseArtistName.trim()) {
        if (artistModeBanner) artistModeBanner.style.display = 'block';
        if (artistModeName) {
            // Use requested artist name if available, otherwise use the song artist
            let displayName = gameState.requestedArtistName || gameState.surpriseArtistName;
            
            // If we have a requested artist name and the song artist contains collaborations,
            // try to extract just the requested artist from the collaboration
            if (gameState.requestedArtistName && gameState.surpriseArtistName) {
                const requestedLower = gameState.requestedArtistName.toLowerCase().trim();
                const songArtist = gameState.surpriseArtistName;
                const songArtistLower = songArtist.toLowerCase();
                
                // Check if song artist contains collaboration markers
                if (songArtistLower.includes(' & ') || songArtistLower.includes(' feat. ') || 
                    songArtistLower.includes(' ft. ') || songArtistLower.includes(' featuring ') ||
                    songArtistLower.includes(', ')) {
                    // Split by collaboration markers
                    const parts = songArtist.split(/[&,]/).map(p => 
                        p.replace(/\s*(feat\.|ft\.|featuring)\s*/gi, '').trim()
                    );
                    
                    // Find the part that matches the requested artist (case-insensitive partial match)
                    const matchingPart = parts.find(p => {
                        const pLower = p.toLowerCase().trim();
                        return pLower.includes(requestedLower) || requestedLower.includes(pLower);
                    });
                    
                    if (matchingPart) {
                        displayName = matchingPart.trim();
                    } else {
                        // If no match found, use the requested name as-is
                        displayName = gameState.requestedArtistName;
                    }
                } else {
                    // No collaboration markers, use requested name
                    displayName = gameState.requestedArtistName;
                }
            }
            
            // Capitalize first letter of each word for better display
            displayName = displayName.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            
            artistModeName.textContent = displayName;
        }
    } else {
        if (artistModeBanner) artistModeBanner.style.display = 'none';
    }

    // Update year display (only show in surprise mode, not artist mode or specific song mode)
    // (isArtistMode and isSurpriseModeOnly already declared above in this function)
    if (songYearEl) {
        if (isSurpriseModeOnly && year) {
            // Show year in surprise mode (hidden initially)
            songYearEl.textContent = '???';
            songYearEl.classList.add('hidden-year');
        } else {
            // Hide year completely in artist mode and specific song mode
            songYearEl.textContent = '';
            songYearEl.style.display = 'none';
        }
    }
    
    // Show/hide reveal year button (only show in surprise mode, not artist mode or specific song mode)
    if (revealYearBtn) {
        if (isSurpriseModeOnly && year && !gameState.titleRevealed) {
            revealYearBtn.style.display = 'inline-block';
            revealYearBtn.style.visibility = 'visible';
            revealYearBtn.textContent = gameState.yearRevealed ? 'Hide Year' : 'Reveal Year';
        } else {
            revealYearBtn.style.display = 'none';
            revealYearBtn.style.visibility = 'hidden';
        }
    }

    if (isSurprise) {
        // Hide song info for surprise songs
        if (songTitleEl) {
            songTitleEl.textContent = '???';
            songTitleEl.classList.add('hidden-title');
        }
        if (songArtistEl) {
            songArtistEl.textContent = '???';
            songArtistEl.classList.add('hidden-artist');
        }
        if (revealTitleBtn) {
            revealTitleBtn.style.display = 'inline-block';
            revealTitleBtn.textContent = 'Reveal Song';
        }
        // Hide YouTube link for surprise songs until title is revealed
        if (youtubeLink) {
            youtubeLink.style.display = 'none';
        }
        if (nextSongBtn) {
            nextSongBtn.style.display = 'inline-block';
        }
    } else {
        // Show song info normally
        if (songTitleEl) {
            songTitleEl.textContent = title;
            songTitleEl.classList.remove('hidden-title');
        }
        if (songArtistEl) {
            songArtistEl.textContent = artist ? `by ${artist}` : '';
            songArtistEl.classList.remove('hidden-artist');
        }
        if (revealTitleBtn) {
            revealTitleBtn.style.display = 'none';
            revealTitleBtn.textContent = 'Reveal Song';
        }
        // Show YouTube link for regular songs
        if (youtubeLink) {
            youtubeLink.style.display = 'inline-block';
        }
        if (nextSongBtn) {
            nextSongBtn.style.display = 'none';
        }
    }
    
    document.getElementById('totalCount').textContent = gameState.totalWords;
    document.getElementById('foundCount').textContent = '0';

    // Create lyrics table
    createLyricsTable(words);
    
    console.log(`Game initialized: ${gameState.totalWords} words to find`);
}

function cleanLyrics(lyrics) {
    // Remove common metadata lines and clean up
    return lyrics
        .split('\n')
        .filter(line => {
            // Remove empty lines and common metadata
            const trimmed = line.trim().toLowerCase();
            return trimmed.length > 0 && 
                   !trimmed.startsWith('paroles') &&
                   !trimmed.startsWith('lyrics') &&
                   !trimmed.includes('copyright');
        })
        .join('\n');
}

function tokenizeLyrics(lyrics) {
    // Split lyrics into words, preserving line breaks
    const lines = lyrics.split('\n');
    const words = [];
    
    lines.forEach((line, lineIndex) => {
        if (line.trim().length === 0) {
            words.push({ word: '', isNewline: true });
            return;
        }
        
        const lineWords = line.trim().split(/\s+/);
        lineWords.forEach((word, wordIndex) => {
            // Normalize word (remove punctuation, lowercase for comparison)
            const normalized = normalizeWord(word);
            words.push({
                word: word,
                normalized: normalized,
                lineIndex: lineIndex,
                wordIndex: wordIndex
            });
        });
        
        // Add newline marker after each line
        if (lineIndex < lines.length - 1) {
            words.push({ word: '', isNewline: true });
        }
    });
    
    return words;
}

function normalizeWord(word) {
    // Remove punctuation and convert to lowercase for comparison
    return word.replace(/[^\w]/g, '').toLowerCase();
}

/** Normalized "oh"-style words: guessing any of these reveals all of them in the lyrics. */
const OH_VARIANTS = new Set([
    'oh', 'ooh', 'ohh', 'oooh', 'ohhh', 'oohh', 'ooooh', 'ohhhh', 'oohoh',
    'ah', 'ahh', 'aah', 'ahhh', 'aaah', 'ahhhh', 'aahh', 'ahah',
    'uh', 'uhh', 'uuh', 'uhhh', 'uuuh', 'uhhhh', 'uuhh', 'uhuh'
]);

function createLyricsTable(words) {
    const table = document.getElementById('lyricsTable');
    table.innerHTML = '';
    
    // Group words by lines
    const lines = [];
    let currentLine = [];
    
    words.forEach((wordObj, index) => {
        if (wordObj.isNewline) {
            if (currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = [];
            }
        } else {
            currentLine.push({ ...wordObj, originalIndex: index });
        }
    });
    
    // Add last line if it exists
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }
    
    // Split lines into two columns
    const midPoint = Math.ceil(lines.length / 2);
    const leftColumn = lines.slice(0, midPoint);
    const rightColumn = lines.slice(midPoint);
    
    // Create column containers
    const leftCol = document.createElement('div');
    leftCol.className = 'lyrics-column';
    const rightCol = document.createElement('div');
    rightCol.className = 'lyrics-column';
    
    // Populate left column
    leftColumn.forEach(line => {
        const lineContainer = document.createElement('div');
        lineContainer.className = 'lyrics-line';
        
        line.forEach(wordObj => {
            const slot = document.createElement('div');
            slot.className = 'word-slot empty';
            slot.dataset.index = wordObj.originalIndex;
            slot.dataset.normalized = wordObj.normalized;
            slot.textContent = '';
            lineContainer.appendChild(slot);
        });
        
        leftCol.appendChild(lineContainer);
    });
    
    // Populate right column
    rightColumn.forEach(line => {
        const lineContainer = document.createElement('div');
        lineContainer.className = 'lyrics-line';
        
        line.forEach(wordObj => {
            const slot = document.createElement('div');
            slot.className = 'word-slot empty';
            slot.dataset.index = wordObj.originalIndex;
            slot.dataset.normalized = wordObj.normalized;
            slot.textContent = '';
            lineContainer.appendChild(slot);
        });
        
        rightCol.appendChild(lineContainer);
    });
    
    table.appendChild(leftCol);
    table.appendChild(rightCol);
}

function toggleRevealLyrics() {
    const revealBtn = document.getElementById('revealBtn');
    
    if (gameState.lyricsRevealed) {
        // Hide lyrics (but keep user-guessed words visible)
        hideLyrics();
        revealBtn.textContent = 'Reveal Lyrics';
        gameState.lyricsRevealed = false;
    } else {
        // Reveal all lyrics
        revealAllLyrics();
        revealBtn.textContent = 'Hide Lyrics';
        gameState.lyricsRevealed = true;
    }
}

function revealAllLyrics() {
    // Reveal all words in the lyrics
    gameState.words.forEach((wordObj, index) => {
        if (!wordObj.isNewline) {
            const slot = document.querySelector(`.word-slot[data-index="${index}"]`);
            if (slot && !slot.classList.contains('found')) {
                slot.textContent = wordObj.word;
                slot.classList.remove('empty');
                slot.classList.add('found');
                gameState.foundWords.add(wordObj.normalized);
            }
        }
    });
    
    // Update stats to show all words found (but don't show victory)
    const allFoundCount = gameState.words.filter(w => !w.isNewline).length;
    document.getElementById('foundCount').textContent = allFoundCount;
}

function hideLyrics() {
    // Hide words that weren't guessed by the user
    gameState.words.forEach((wordObj, index) => {
        if (!wordObj.isNewline) {
            const slot = document.querySelector(`.word-slot[data-index="${index}"]`);
            if (slot) {
                // Only hide if it wasn't user-guessed
                if (!gameState.userGuessedWords.has(wordObj.normalized)) {
                    slot.textContent = '';
                    slot.classList.remove('found');
                    slot.classList.add('empty');
                    gameState.foundWords.delete(wordObj.normalized);
                }
            }
        }
    });
    
    // Update stats to reflect only user-guessed words
    const userFoundCount = gameState.words.filter(w => 
        !w.isNewline && gameState.userGuessedWords.has(w.normalized)
    ).length;
    gameState.foundCount = userFoundCount;
    document.getElementById('foundCount').textContent = userFoundCount;
    
    // Check if user has completed the game naturally
    if (gameState.foundCount >= gameState.totalWords) {
        // Auto-reveal song title if it's hidden
        if (gameState.isSurpriseSong && !gameState.titleRevealed) {
            revealSongTitle();
            const revealTitleBtn = document.getElementById('revealTitleBtn');
            const revealYearBtn = document.getElementById('revealYearBtn');
            if (revealTitleBtn) {
                revealTitleBtn.textContent = 'Hide Song';
            }
            // Completely hide reveal year button once song is revealed
            if (revealYearBtn) {
                revealYearBtn.style.display = 'none';
                revealYearBtn.style.visibility = 'hidden';
            }
        }
        showVictory();
    }
}

function toggleSongTitle() {
    const revealTitleBtn = document.getElementById('revealTitleBtn');
    
    if (!revealTitleBtn) {
        console.error('revealTitleBtn not found');
        return;
    }
    
    if (gameState.titleRevealed) {
        // Hide title
        hideSongTitle();
        revealTitleBtn.textContent = 'Reveal Song';
        gameState.titleRevealed = false;
    } else {
        // Reveal title
        revealSongTitle();
        revealTitleBtn.textContent = 'Hide Song';
        gameState.titleRevealed = true;
    }
}

function toggleYear() {
    const revealYearBtn = document.getElementById('revealYearBtn');
    const songYearEl = document.getElementById('songYear');
    
    if (!revealYearBtn || !songYearEl) {
        console.error('revealYearBtn or songYearEl not found');
        return;
    }
    
    // Only allow toggling if it's a surprise song
    if (!gameState.isSurpriseSong) {
        console.log('Not a surprise song, year toggle disabled');
        return;
    }
    
    if (gameState.yearRevealed) {
        // Hide year
        songYearEl.textContent = '???';
        songYearEl.classList.add('hidden-year');
        revealYearBtn.textContent = 'Reveal Year';
        gameState.yearRevealed = false;
    } else {
        // Reveal year
        if (gameState.songYear) {
            songYearEl.textContent = gameState.songYear;
            songYearEl.classList.remove('hidden-year');
            revealYearBtn.textContent = 'Hide Year';
            gameState.yearRevealed = true;
        } else {
            console.log('No year available to reveal');
        }
    }
}

function showGiveUpConfirmation() {
    const modal = document.getElementById('giveUpConfirmationModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function handleGiveUp() {
    const modal = document.getElementById('giveUpConfirmationModal');
    if (modal) {
        modal.classList.remove('show');
    }
    
    // Store the count BEFORE revealing (user's actual progress)
    const userFoundCount = gameState.foundCount;
    const totalWords = gameState.totalWords;
    
    // Store which words were user-guessed before revealing
    const userGuessedBefore = new Set(gameState.userGuessedWords);
    
    // Reveal all lyrics
    revealAllLyrics();
    
    // Mark missed words (not user-guessed) with special styling
    gameState.words.forEach((wordObj, index) => {
        if (!wordObj.isNewline) {
            const slot = document.querySelector(`.word-slot[data-index="${index}"]`);
            if (slot && slot.classList.contains('found')) {
                // If this word wasn't guessed by the user, mark it as missed
                if (!userGuessedBefore.has(wordObj.normalized)) {
                    slot.classList.add('give-up-missed');
                }
            }
        }
    });
    
    // Update gameState.foundCount to reflect all words being found
    gameState.foundCount = gameState.words.filter(w => !w.isNewline).length;
    
    // Set lyrics as revealed
    gameState.lyricsRevealed = true;
    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
        revealBtn.textContent = 'Hide Lyrics';
    }
    
    // Reveal song title and artist (this will also reveal the year)
    revealSongTitle();
    const revealTitleBtn = document.getElementById('revealTitleBtn');
    if (revealTitleBtn) {
        revealTitleBtn.style.display = 'none';
    }
    gameState.titleRevealed = true;
    
    // Ensure year is revealed (only in surprise mode, not artist mode or specific song mode)
    const isArtistMode = gameState.surpriseArtistName && gameState.surpriseArtistName.trim();
    const isSurpriseModeOnly = gameState.isSurpriseSong && !isArtistMode;
    
    if (isSurpriseModeOnly && !gameState.yearRevealed && gameState.songYear) {
        const songYearEl = document.getElementById('songYear');
        const revealYearBtn = document.getElementById('revealYearBtn');
        if (songYearEl) {
            songYearEl.textContent = gameState.songYear;
            songYearEl.classList.remove('hidden-year');
            songYearEl.style.display = ''; // Show it
            gameState.yearRevealed = true;
            gameState.yearRevealedBySong = true;
        }
        // Hide the reveal year button once song is revealed
        if (revealYearBtn) {
            revealYearBtn.style.display = 'none';
            revealYearBtn.style.visibility = 'hidden';
        }
    }
    
    const percentage = totalWords > 0 ? Math.round((userFoundCount / totalWords) * 100) : 0;
    
    // Replace input section with end-of-game stats
    const inputSection = document.getElementById('inputSection');
    const endGameStats = document.getElementById('endGameStats');
    const endGameTitle = document.getElementById('endGameStatsTitle');
    const endGameFound = document.getElementById('endGameFoundCount');
    const endGameTotal = document.getElementById('endGameTotalCount');
    const endGamePct = document.getElementById('endGamePercentage');
    if (inputSection) inputSection.style.display = 'none';
    if (endGameStats) {
        endGameStats.classList.remove('victory');
        endGameStats.style.display = 'block';
    }
    if (endGameTitle) endGameTitle.textContent = 'Game Over';
    if (endGameFound) endGameFound.textContent = userFoundCount;
    if (endGameTotal) endGameTotal.textContent = totalWords;
    if (endGamePct) endGamePct.textContent = percentage + '%';
    
    const giveUpResults = document.getElementById('giveUpResults');
    if (giveUpResults) giveUpResults.style.display = 'none';
    
    const giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) giveUpBtn.style.display = 'none';
    
    if (endGameStats) {
        setTimeout(() => endGameStats.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
}

function showHelp(title, content) {
    const helpModal = document.getElementById('helpModal');
    const helpModalTitle = document.getElementById('helpModalTitle');
    const helpModalContent = document.getElementById('helpModalContent');
    if (helpModal && helpModalTitle && helpModalContent) {
        helpModalTitle.textContent = title;
        helpModalContent.innerHTML = content;
        helpModal.classList.add('show');
    }
}


async function getYouTubeVideoUrl(title, artist) {
    // Get a direct YouTube video link by extracting the first video from search results
    const searchQuery = `${title} ${artist || ''}`.trim();
    
    try {
        // Use a CORS proxy to fetch YouTube search results
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch YouTube results');
        }
        
        const html = await response.text();
        
        // YouTube stores video data in JSON embedded in the page
        // Look for the ytInitialData object which contains search results
        let videoId = null;
        
        // Pattern 1: Extract from ytInitialData JSON (most reliable)
        const ytInitialDataMatch = html.match(/var ytInitialData = ({.+?});/);
        if (ytInitialDataMatch) {
            try {
                const data = JSON.parse(ytInitialDataMatch[1]);
                // Navigate through the JSON structure to find first video
                if (data.contents && data.contents.twoColumnSearchResultsRenderer) {
                    const contents = data.contents.twoColumnSearchResultsRenderer.primaryContents;
                    if (contents && contents.sectionListRenderer) {
                        const sections = contents.sectionListRenderer.contents;
                        for (const section of sections) {
                            if (section.itemSectionRenderer && section.itemSectionRenderer.contents) {
                                for (const item of section.itemSectionRenderer.contents) {
                                    if (item.videoRenderer && item.videoRenderer.videoId) {
                                        videoId = item.videoRenderer.videoId;
                                        break;
                                    }
                                }
                                if (videoId) break;
                            }
                        }
                    }
                }
            } catch (e) {
                console.log('Failed to parse ytInitialData:', e);
            }
        }
        
        // Pattern 2: Look for videoId in window["ytInitialData"]
        if (!videoId) {
            const windowDataMatch = html.match(/window\["ytInitialData"\] = ({.+?});/);
            if (windowDataMatch) {
                try {
                    const data = JSON.parse(windowDataMatch[1]);
                    if (data.contents && data.contents.twoColumnSearchResultsRenderer) {
                        const contents = data.contents.twoColumnSearchResultsRenderer.primaryContents;
                        if (contents && contents.sectionListRenderer) {
                            const sections = contents.sectionListRenderer.contents;
                            for (const section of sections) {
                                if (section.itemSectionRenderer && section.itemSectionRenderer.contents) {
                                    for (const item of section.itemSectionRenderer.contents) {
                                        if (item.videoRenderer && item.videoRenderer.videoId) {
                                            videoId = item.videoRenderer.videoId;
                                            break;
                                        }
                                    }
                                    if (videoId) break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log('Failed to parse window ytInitialData:', e);
                }
            }
        }
        
        // Pattern 3: Simple regex fallback - look for first videoId in quotes
        if (!videoId) {
            const videoIdMatches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
            if (videoIdMatches && videoIdMatches.length > 0) {
                const firstMatch = videoIdMatches[0].match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
                if (firstMatch && firstMatch[1]) {
                    videoId = firstMatch[1];
                }
            }
        }
        
        // Pattern 4: Look for /watch?v= pattern (last resort)
        if (!videoId) {
            const watchMatches = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/g);
            if (watchMatches && watchMatches.length > 0) {
                const firstMatch = watchMatches[0].match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
                if (firstMatch && firstMatch[1]) {
                    videoId = firstMatch[1];
                }
            }
        }
        
        if (videoId) {
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
        
        // Fallback: return search URL if we can't extract video ID
        return searchUrl;
    } catch (error) {
        console.error('Error getting YouTube video URL:', error);
        // Fallback to search URL
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    }
}

function revealSongTitle() {
    const songTitleEl = document.getElementById('songTitle');
    const songArtistEl = document.getElementById('songArtist');
    const youtubeLink = document.getElementById('youtubeLink');
    
    if (!songTitleEl || !songArtistEl) {
        console.error('Song title elements not found');
        return;
    }
    
    songTitleEl.textContent = gameState.songTitle;
    songTitleEl.classList.remove('hidden-title');
    songArtistEl.textContent = gameState.songArtist ? `by ${gameState.songArtist}` : '';
    songArtistEl.classList.remove('hidden-artist');
    gameState.titleRevealed = true;
    
    // Also reveal year if it's hidden (only in surprise mode, not artist mode)
    const isArtistMode = gameState.surpriseArtistName && gameState.surpriseArtistName.trim();
    const isSurpriseModeOnly = gameState.isSurpriseSong && !isArtistMode;
    
    if (isSurpriseModeOnly && !gameState.yearRevealed && gameState.songYear) {
        const songYearEl = document.getElementById('songYear');
        const revealYearBtn = document.getElementById('revealYearBtn');
        if (songYearEl) {
            songYearEl.textContent = gameState.songYear;
            songYearEl.classList.remove('hidden-year');
            songYearEl.style.display = ''; // Show it
            gameState.yearRevealed = true;
            gameState.yearRevealedBySong = true; // Mark that year was revealed because song was revealed
        }
        // Hide the reveal year button once song is revealed
        if (revealYearBtn) {
            revealYearBtn.style.display = 'none';
            revealYearBtn.style.visibility = 'hidden';
        }
    } else {
        // Even if year was already revealed, hide the button when song is revealed
        const revealYearBtn = document.getElementById('revealYearBtn');
        if (revealYearBtn) {
            revealYearBtn.style.display = 'none';
            revealYearBtn.style.visibility = 'hidden';
        }
    }
    
    // Show YouTube link when title is revealed
    if (youtubeLink) {
        const searchQuery = `${gameState.songTitle} ${gameState.songArtist || ''}`.trim();
        // Set YouTube search URL immediately (will be updated to direct video if available)
        youtubeLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        youtubeLink.style.display = 'inline-block';
        youtubeLink.onclick = null; // Ensure no click handlers interfere
        
        // Fetch YouTube video URL asynchronously and update if successful
        getYouTubeVideoUrl(gameState.songTitle, gameState.songArtist).then(url => {
            if (youtubeLink && url && url.startsWith('https://www.youtube.com/watch')) {
                youtubeLink.href = url;
            }
        }).catch(err => {
            console.error('Failed to get YouTube URL:', err);
            // Keep the search URL as fallback - it's already set above
        });
    }
}

function hideSongTitle() {
    const songTitleEl = document.getElementById('songTitle');
    const songArtistEl = document.getElementById('songArtist');
    const youtubeLink = document.getElementById('youtubeLink');
    
    if (!songTitleEl || !songArtistEl) {
        console.error('Song title elements not found');
        return;
    }
    
    songTitleEl.textContent = '???';
    songTitleEl.classList.add('hidden-title');
    songArtistEl.textContent = '???';
    songArtistEl.classList.add('hidden-artist');
    if (youtubeLink) youtubeLink.style.display = 'none';
    gameState.titleRevealed = false;
    
    // In surprise-only mode: restore year display and always show Reveal/Hide Year button again
    const isArtistMode = gameState.surpriseArtistName && gameState.surpriseArtistName.trim();
    const isSurpriseModeOnly = gameState.isSurpriseSong && !isArtistMode;
    const songYearEl = document.getElementById('songYear');
    const revealYearBtn = document.getElementById('revealYearBtn');
    
    if (isSurpriseModeOnly && gameState.songYear) {
        // If year was revealed because song was revealed, hide year again and reset flags
        if (gameState.yearRevealedBySong) {
            if (songYearEl) {
                songYearEl.textContent = '???';
                songYearEl.classList.add('hidden-year');
            }
            gameState.yearRevealed = false;
            gameState.yearRevealedBySong = false;
        }
        // Always show the Reveal/Hide Year button again when re-hiding song in surprise mode
        if (revealYearBtn) {
            revealYearBtn.style.display = 'inline-block';
            revealYearBtn.style.visibility = 'visible';
            revealYearBtn.textContent = gameState.yearRevealed ? 'Hide Year' : 'Reveal Year';
        }
    } else if (revealYearBtn) {
        revealYearBtn.style.display = 'none';
        revealYearBtn.style.visibility = 'hidden';
    }
}

function checkWord(inputWord, shouldClearInput = false) {
    if (!inputWord || inputWord.length === 0) return false;
    
    const normalizedInput = normalizeWord(inputWord);
    if (normalizedInput.length === 0) return false;
    
    // Special case: "oh" / "ooh" / "ah" / "uh" etc. – guessing any variant reveals all variants in the lyrics
    if (OH_VARIANTS.has(normalizedInput)) {
        const ohMatches = [];
        gameState.words.forEach((wordObj, index) => {
            if (!wordObj.isNewline && OH_VARIANTS.has(wordObj.normalized) && !gameState.foundWords.has(wordObj.normalized)) {
                ohMatches.push(index);
            }
        });
        if (ohMatches.length > 0) {
            ohMatches.forEach(index => gameState.foundWords.add(gameState.words[index].normalized));
            gameState.userGuessedWords.add(normalizedInput);
            gameState.foundCount += ohMatches.length;
            revealWord(normalizedInput, ohMatches);
            document.getElementById('foundCount').textContent = gameState.foundCount;
            if (shouldClearInput) document.getElementById('wordInput').value = '';
            if (!gameState.lyricsRevealed && gameState.foundCount >= gameState.totalWords) {
                if (gameState.isSurpriseSong && !gameState.titleRevealed) {
                    revealSongTitle();
                    const revealTitleBtn = document.getElementById('revealTitleBtn');
                    if (revealTitleBtn) revealTitleBtn.textContent = 'Hide Song';
                }
                showVictory();
            }
            return true;
        }
        if (shouldClearInput) document.getElementById('wordInput').value = '';
        return false;
    }
    
    // Check if word exists in lyrics and hasn't been found yet
    if (gameState.foundWords.has(normalizedInput)) {
        // Word already found
        if (shouldClearInput) {
            document.getElementById('wordInput').value = '';
        }
        return false;
    }
    
    // Find all occurrences of this word (exact match)
    const matches = [];
    gameState.words.forEach((wordObj, index) => {
        if (!wordObj.isNewline && wordObj.normalized === normalizedInput) {
            matches.push(index);
        }
    });
    
    if (matches.length > 0) {
        // Word found! Reveal all occurrences
        revealWord(normalizedInput, matches);
        gameState.foundWords.add(normalizedInput);
        gameState.userGuessedWords.add(normalizedInput); // Mark as user-guessed
        gameState.foundCount += matches.length;
        
        // Update stats
        document.getElementById('foundCount').textContent = gameState.foundCount;
        
        // Clear input if requested
        if (shouldClearInput) {
            document.getElementById('wordInput').value = '';
        }
        
        // Check if game is complete (only if lyrics aren't revealed)
        if (!gameState.lyricsRevealed && gameState.foundCount >= gameState.totalWords) {
            // Auto-reveal song title if it's hidden
            if (gameState.isSurpriseSong && !gameState.titleRevealed) {
                revealSongTitle();
                const revealTitleBtn = document.getElementById('revealTitleBtn');
                if (revealTitleBtn) {
                    revealTitleBtn.textContent = 'Hide Song';
                }
            }
            showVictory();
        }
        
        return true;
    }
    
    return false;
}

function revealWord(normalizedWord, indices) {
    indices.forEach(index => {
        const slot = document.querySelector(`.word-slot[data-index="${index}"]`);
        if (slot && !slot.classList.contains('found')) {
            const wordObj = gameState.words[index];
            slot.textContent = wordObj.word;
            slot.classList.remove('empty');
            slot.classList.add('found');
        }
    });
}

function showVictory() {
    const totalWords = gameState.words.filter(w => !w.isNewline).length;
    const inputSection = document.getElementById('inputSection');
    const endGameStats = document.getElementById('endGameStats');
    const endGameTitle = document.getElementById('endGameStatsTitle');
    const endGameFound = document.getElementById('endGameFoundCount');
    const endGameTotal = document.getElementById('endGameTotalCount');
    const endGamePct = document.getElementById('endGamePercentage');
    if (inputSection) inputSection.style.display = 'none';
    if (endGameStats) {
        endGameStats.classList.add('victory');
        endGameStats.style.display = 'block';
    }
    if (endGameTitle) endGameTitle.textContent = 'You did it!';
    if (endGameFound) endGameFound.textContent = totalWords;
    if (endGameTotal) endGameTotal.textContent = totalWords;
    if (endGamePct) endGamePct.textContent = '100%';
    document.getElementById('victoryMessage').style.display = 'block';
    if (endGameStats) {
        setTimeout(() => endGameStats.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        console.error('Error displayed to user:', message);
    } else {
        console.error('Error message element not found! Message:', message);
    }
}

// Test function - run in console: testLyricsAPI() to test with a random chart song, or testLyricsAPI(title, artist)
window.testLyricsAPI = async function(title, artist) {
    if (!title || !artist) {
        const song = await getRandomPopularSong();
        title = song.title;
        artist = song.artist;
        console.log('Testing with chart song:', title, 'by', artist);
    }
    try {
        const lyrics = await fetchLyrics(title, artist);
        console.log('✅ SUCCESS! Lyrics fetched:', lyrics.substring(0, 200));
        return lyrics;
    } catch (error) {
        console.error('❌ FAILED:', error);
        return null;
    }
};
