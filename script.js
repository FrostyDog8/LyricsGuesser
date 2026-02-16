/**
 * Lyrico – Fill in the Lyrics
 * © 2026 Omer Dabby. All rights reserved.
 * https://github.com/FrostyDog8/Lyrico
 */
// Dev mode state
let devMode = false;

// Analytics (GA4) – Lyrico property. Set your Measurement ID from https://analytics.google.com/
const GA_MEASUREMENT_ID = 'G-KRL1CS0CF1'; // leave empty to disable
const GA_CLIENT_ID_KEY = 'lf_ga_cid';
function getGaClientIdFromCookie() {
    try {
        const match = document.cookie.match(/_ga=([^;]+)/);
        if (match && match[1]) {
            const parts = match[1].split('.');
            if (parts.length >= 2) {
                const a = parts[parts.length - 2], b = parts[parts.length - 1];
                if (/^\d+$/.test(a) && /^\d+$/.test(b)) return a + '.' + b;
            }
        }
    } catch (_) {}
    return null;
}
function generateGaStyleClientId() {
    const r = () => Math.floor(Math.random() * 1e10).toString();
    return r() + '.' + (Math.floor(Date.now() / 1000)).toString();
}
function getOrCreateGaClientId() {
    const valid = (id) => id && /^[a-zA-Z0-9._-]+$/.test(id) && id.length >= 10;
    try {
        let id = localStorage.getItem(GA_CLIENT_ID_KEY);
        if (valid(id)) return id;
        id = getGaClientIdFromCookie();
        if (valid(id)) {
            localStorage.setItem(GA_CLIENT_ID_KEY, id);
            return id;
        }
        id = generateGaStyleClientId();
        localStorage.setItem(GA_CLIENT_ID_KEY, id);
        return id;
    } catch (_) {
        return getGaClientIdFromCookie() || generateGaStyleClientId();
    }
}
function initAnalytics() {
    if (!GA_MEASUREMENT_ID) return;
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, { client_id: getOrCreateGaClientId() });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
}
function trackEvent(name, params) {
    if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;
    window.gtag('event', name, params);
}

// Spotify (optional) – set Client ID from https://developer.spotify.com/dashboard ; add Redirect URI in app settings. Leave empty to hide from lobby (restore ID to re-enable).
const SPOTIFY_CLIENT_ID = ''; // was 'bd59563fe9e24de2826f2c575df7f508'
const SPOTIFY_CLIENT_ID_UNLOCKED = 'bd59563fe9e24de2826f2c575df7f508'; // used when secret code unlocks Spotify
let spotifySecretUnlocked = false;
function getSpotifyClientId() { return SPOTIFY_CLIENT_ID || (spotifySecretUnlocked ? SPOTIFY_CLIENT_ID_UNLOCKED : ''); }
const SPOTIFY_SCOPES = 'playlist-read-private playlist-read-collaborative user-library-read';
const SPOTIFY_STORAGE_KEY = 'lf_spotify_token';
const SPOTIFY_VERIFIER_KEY = 'lf_spotify_code_verifier';
const SPOTIFY_STATE_KEY = 'lf_spotify_state';
const _lf = 'od-lyrico'; // internal build id

function getSpotifyRedirectUri() {
    if (typeof window === 'undefined' || !window.location) return 'http://127.0.0.1:8080';
    // lf:od
    const o = window.location;
    const path = o.pathname.replace(/\/?$/, '') || '/';
    return o.origin + path + (path === '/' ? '' : '/');
}

async function spotifySha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return hash;
}

function spotifyBase64UrlEncode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function spotifyGenerateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

function spotifyLogin() {
    if (!getSpotifyClientId()) return;
    const state = spotifyGenerateRandomString(32);
    const codeVerifier = spotifyGenerateRandomString(64);
    spotifySha256(codeVerifier).then((hashed) => {
        const codeChallenge = spotifyBase64UrlEncode(hashed);
        try {
            localStorage.setItem(SPOTIFY_VERIFIER_KEY, codeVerifier);
            sessionStorage.setItem(SPOTIFY_STATE_KEY, state);
        } catch (_) {}
        const redirectUri = getSpotifyRedirectUri();
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: getSpotifyClientId(),
            scope: SPOTIFY_SCOPES,
            redirect_uri: redirectUri,
            state,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge
        });
        window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
    });
}

async function spotifyExchangeCode(code) {
    const codeVerifier = localStorage.getItem(SPOTIFY_VERIFIER_KEY);
    if (!codeVerifier) throw new Error('Missing code verifier');
    const redirectUri = getSpotifyRedirectUri();
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: getSpotifyClientId(),
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
        })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Token exchange failed');
    }
    const data = await res.json();
    try {
        localStorage.removeItem(SPOTIFY_VERIFIER_KEY);
        sessionStorage.setItem(SPOTIFY_STORAGE_KEY, JSON.stringify({
            access_token: data.access_token,
            expires_at: Date.now() + (data.expires_in || 3600) * 1000,
            refresh_token: data.refresh_token || null
        }));
    } catch (_) {}
    return data.access_token;
}

function spotifyGetStoredToken() {
    try {
        const raw = sessionStorage.getItem(SPOTIFY_STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.expires_at && Date.now() < data.expires_at - 60000) return data.access_token;
        return null;
    } catch (_) {
        return null;
    }
}

async function spotifyApi(method, path, accessToken) {
    const token = accessToken || spotifyGetStoredToken();
    if (!token) throw new Error('Not logged in to Spotify');
    const url = path.startsWith('http') ? path : 'https://api.spotify.com/v1' + path;
    const res = await fetch(url, {
        method: method || 'GET',
        headers: { Authorization: 'Bearer ' + token }
    });
    if (res.status === 401) {
        try { sessionStorage.removeItem(SPOTIFY_STORAGE_KEY); } catch (_) {}
        throw new Error('Spotify session expired. Please connect again.');
    }
    if (res.status === 403) {
        throw new Error('Access denied.');
    }
    if (!res.ok) throw new Error('Spotify API error: ' + res.status);
    return res.json();
}

async function spotifyFetchPlaylists() {
    const out = [];
    let url = '/me/playlists?limit=50';
    while (url) {
        const data = await spotifyApi('GET', url);
        const items = data.items || [];
        for (const p of items) {
            let total = 0;
            if (p.tracks && p.tracks.total != null) total = Number(p.tracks.total) || 0;
            out.push({ id: p.id, name: p.name || 'Unnamed', tracksTotal: total });
        }
        url = data.next || '';
    }
    return out;
}

/** Returns total number of liked tracks (for display in picker). */
async function spotifyGetLikedTracksTotal() {
    const data = await spotifyApi('GET', '/me/tracks?limit=1');
    return (data && typeof data.total === 'number') ? data.total : 0;
}

async function spotifyFetchLikedTracks() {
    const out = [];
    let offset = 0;
    const limit = 50;
    while (true) {
        const data = await spotifyApi('GET', `/me/tracks?limit=${limit}&offset=${offset}`);
        const items = data.items || [];
        for (const it of items) {
            const t = it.track;
            if (t && t.type === 'track' && t.name && t.artists && t.artists.length) {
                out.push({ title: t.name.trim(), artist: (t.artists[0].name || '').trim() });
            }
        }
        if (!data.next) break;
        offset += limit;
    }
    return out;
}

async function spotifyFetchPlaylistTracks(playlistId) {
    const out = [];
    let offset = 0;
    const limit = 50;
    const id = encodeURIComponent(playlistId);
    while (true) {
        const data = await spotifyApi('GET', `/playlists/${id}/items?limit=${limit}&offset=${offset}`);
        const items = data.items || [];
        for (const it of items) {
            const t = it.item || it.track;
            if (t && (t.type === 'track' || !t.type) && t.name && t.artists && t.artists.length) {
                out.push({ title: t.name.trim(), artist: (t.artists[0].name || '').trim() });
            }
        }
        if (items.length < limit) break;
        offset += limit;
    }
    return out;
}

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
    surpriseArtistName: '', // When set, Next Song picks another random song by this artist (full name for display and for searching more songs)
    requestedArtistName: '', // The original artist name requested by user (for searching)
    artistModeDisplayName: '', // Resolved artist name for banner (e.g. "Imagine Dragons" when user searched "imagine drag"), no collab
    hintRevealedIndices: new Set(), // Indices of word slots revealed by hint (not counted as "found" in summary)
    // Spotify mode: when set, Next Song pulls from this playlist
    spotifyPlaylistName: '',
    spotifyPlaylistId: null, // null = Liked Songs
    spotifyTracks: [] // { title, artist }[]
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
    if (surpriseBtn) surpriseBtn.addEventListener('click', () => { trackEvent('surprise_me_clicked'); surpriseMe(); });
    if (surpriseByArtistBtn) surpriseByArtistBtn.addEventListener('click', () => { trackEvent('surprise_by_artist_clicked', { artist: (document.getElementById('artistInput') || {}).value?.trim() || '' }); surpriseByArtist(); });
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
    initAnalytics();
    initLobbyButtons();

    // Spotify: show card only if configured; handle OAuth callback
    const spotifyModeCard = document.getElementById('spotifyModeCard');
    if (spotifyModeCard) spotifyModeCard.style.display = SPOTIFY_CLIENT_ID ? 'block' : 'none';
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    if (SPOTIFY_CLIENT_ID && code && state) {
        const savedState = sessionStorage.getItem(SPOTIFY_STATE_KEY);
        if (savedState === state) {
            spotifyExchangeCode(code).then(() => {
                window.history.replaceState({}, document.title, window.location.pathname || '/');
                if (typeof window.updateSpotifyButtonText === 'function') window.updateSpotifyButtonText();
                openSpotifyPlaylistPicker();
            }).catch(err => {
                showError(err.message || 'Spotify login failed');
                window.history.replaceState({}, document.title, window.location.pathname || '/');
            });
        }
    }

    const spotifyConnectBtn = document.getElementById('spotifyConnectBtn');
    function updateSpotifyButtonText() {
        if (!spotifyConnectBtn) return;
        spotifyConnectBtn.textContent = spotifyGetStoredToken() ? '🎧 Pick a playlist' : '🎧 Connect & pick playlist';
        spotifyConnectBtn.disabled = false;
    }
    if (spotifyConnectBtn) {
        updateSpotifyButtonText();
        spotifyConnectBtn.addEventListener('click', () => {
            trackEvent('spotify_mode_clicked', { 
                is_logged_in: !!spotifyGetStoredToken() 
            });
            if (spotifyGetStoredToken()) openSpotifyPlaylistPicker();
            else spotifyLogin();
        });
    }
    const cancelSpotifyPlaylistBtn = document.getElementById('cancelSpotifyPlaylistBtn');
    const spotifyPlaylistOverlay = document.getElementById('spotifyPlaylistOverlay');
    if (cancelSpotifyPlaylistBtn && spotifyPlaylistOverlay) {
        cancelSpotifyPlaylistBtn.addEventListener('click', () => { spotifyPlaylistOverlay.style.display = 'none'; });
    }
    if (spotifyPlaylistOverlay) {
        spotifyPlaylistOverlay.addEventListener('click', (e) => {
            if (e.target === spotifyPlaylistOverlay) spotifyPlaylistOverlay.style.display = 'none';
        });
    }
    window.updateSpotifyButtonText = updateSpotifyButtonText;

    const wordInput = document.getElementById('wordInput');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const devModeBtn = document.getElementById('devModeBtn');
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
    if (devModeBtn) {
        if (!isLocal) {
            devModeBtn.style.display = 'none';
        } else {
            devModeBtn.addEventListener('click', toggleDevMode);
        }
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
        trackEvent('back_to_lobby');
        // Reset game state
        gameState.isSurpriseSong = false;
        gameState.surpriseArtistName = '';
        gameState.requestedArtistName = '';
        gameState.artistModeDisplayName = '';
        gameState.spotifyPlaylistName = '';
        gameState.spotifyPlaylistId = null;
        gameState.spotifyTracks = [];
        preloadedArtistSongs = [];
        preloadedArtistName = '';
        preloadedSpotifySongs = [];
        spotifyPlayedInSession.clear();
        preloadNextSurpriseSong(); // resume regular surprise preload when returning to lobby
        gameState.titleRevealed = false;
        gameState.yearRevealed = false;
        gameState.yearRevealedBySong = false;
        gameState.lyricsRevealed = false;
        
        // Hide help button in game area
        const helpGameplayBtnGame = document.getElementById('helpGameplayBtnGame');
        if (helpGameplayBtnGame) helpGameplayBtnGame.style.display = 'none';
        
        // Hide artist and Spotify mode banners
        const artistModeBanner = document.getElementById('artistModeBanner');
        if (artistModeBanner) artistModeBanner.style.display = 'none';
        const spotifyModeBanner = document.getElementById('spotifyModeBanner');
        if (spotifyModeBanner) spotifyModeBanner.style.display = 'none';
        const spotifyPlaylistEndMessage = document.getElementById('spotifyPlaylistEndMessage');
        if (spotifyPlaylistEndMessage) spotifyPlaylistEndMessage.style.display = 'none';
        
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
        document.body.classList.remove('in-game');
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
            startBtn.innerHTML = '🎯 Start Game';
            startBtn.disabled = false;
        }
        if (surpriseBtn) {
            surpriseBtn.innerHTML = '🎲 Surprise Me!';
            surpriseBtn.disabled = false;
        }
        if (surpriseByArtistBtn) {
            surpriseByArtistBtn.innerHTML = '🎤 Shuffle & play';
            surpriseByArtistBtn.disabled = false;
        }
        });
    }

    const giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) {
        giveUpBtn.addEventListener('click', showGiveUpConfirmation);
    }
    const hintBtn = document.getElementById('hintBtn');
    if (hintBtn) {
        hintBtn.addEventListener('click', useHint);
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
    const helpSongBtn = document.getElementById('helpSongBtn');
    if (helpSongBtn) {
        helpSongBtn.addEventListener('click', () => {
            showHelp('Choose a Song', `
                <p><strong>Choose a Song</strong> lets you play any song you know by name.</p>
                <h4>How it works:</h4>
                <ul>
                    <li>Type the song name (and artist if you want to be specific)</li>
                    <li>Click "Start Game" to load the lyrics</li>
                    <li>If several songs match, you'll pick one from a list</li>
                </ul>
                <p>Great for your favorite tunes or to challenge a friend with a specific track!</p>
            `);
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
                    <li>Enter an artist name and click "Shuffle & play"</li>
                    <li>You'll get a random song by that artist</li>
                    <li>The song title is hidden until you complete it</li>
                    <li>Use "Next Song" to get another song by the same artist</li>
                </ul>
                <p>Perfect for testing your knowledge of a specific artist!</p>
            `);
        });
    }
    const helpSpotifyBtn = document.getElementById('helpSpotifyBtn');
    if (helpSpotifyBtn) {
        helpSpotifyBtn.addEventListener('click', () => {
            showHelp('Play from Spotify', `
                <p><strong>Play from Spotify</strong> uses your Spotify account to play songs from a playlist or your Liked Songs.</p>
                <h4>How it works:</h4>
                <ul>
                    <li>Click "Connect & pick playlist" and log in with Spotify if needed</li>
                    <li>Choose "Liked Songs" or any of your playlists</li>
                    <li>Songs play in random order; the title is hidden until you complete the lyrics</li>
                    <li>Use "Next Song" to get another track from the same playlist</li>
                    <li>When the playlist runs out, you'll see a message—head back to pick another playlist</li>
                </ul>
                <p>Lyrics are loaded from our sources when available; some tracks may be skipped if lyrics aren't found.</p>
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
                startBtn.innerHTML = '🎯 Start Game';
                startBtn.disabled = false;
            }
            if (surpriseBtn) {
                surpriseBtn.innerHTML = '🎲 Surprise Me!';
                surpriseBtn.disabled = false;
            }
            if (surpriseByArtistBtn) {
                surpriseByArtistBtn.innerHTML = '🎤 Shuffle & play';
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
            trackEvent('play_again_clicked');
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
            
            // Artist mode: show the term used when searching for more songs (preload / Next Song)
            const artistSearchTerm = (gameState.requestedArtistName && gameState.requestedArtistName.trim()) || (gameState.surpriseArtistName && gameState.surpriseArtistName.trim());
            if (artistSearchTerm) {
                parts.push('Artist search: ' + artistSearchTerm);
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

/** Primary artist only (before any collab): "Taylor Swift & Ed Sheeran" → "Taylor Swift". Used for grouping/suggestions; full artist can still show in-game. */
function getPrimaryArtist(artistString) {
    if (!artistString || typeof artistString !== 'string') return '';
    const parts = artistString.split(/\s*,\s*|\s*&\s*|\s+feat\.?|\s+ft\.?|\s+and\s+|\s+with\s+|\s+x\s+/i);
    return (parts[0] || '').trim() || artistString.trim();
}

/** Normalize artist name for comparison: trim, collapse spaces, remove parentheticals, lowercase. */
function normalizeArtistName(name) {
    if (!name || typeof name !== 'string') return '';
    return name
        .trim()
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Returns true if two normalized names match (exact or one contains the other, min length 2). */
function artistPartMatchesRequest(partNorm, reqNorm) {
    if (partNorm === reqNorm) return true;
    if (reqNorm.length >= 2 && partNorm.includes(reqNorm)) return true;
    if (partNorm.length >= 2 && reqNorm.includes(partNorm)) return true;
    return false;
}

/** First part of trackArtist that matches the request (primary or collab). Used to include more songs while grouping by "who the user meant". */
function getMatchingArtistPart(trackArtist, requestedArtist) {
    const req = normalizeArtistName(requestedArtist);
    const tr = (trackArtist || '').trim();
    if (!tr) return null;
    const parts = tr.split(/\s*,\s*|\s*&\s*|\s+feat\.?|\s+ft\.?|\s+and\s+|\s+with\s+|\s+x\s+/i).map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
        const pNorm = normalizeArtistName(part);
        if (artistPartMatchesRequest(pNorm, req)) return part;
    }
    return null;
}

/** True if the request matches the track's primary artist or any collab part (so we find enough songs). */
function isTrackByArtist(trackArtist, requestedArtist) {
    return getMatchingArtistPart(trackArtist, requestedArtist) !== null;
}

/** Fetch songs by artist via iTunes Search. Returns { songs } or { needArtistSelection: true, artists, songsByArtist } when multiple artists match. Groups by the part that matched. When artistName contains a collab (e.g. "A & B"), the API is queried with the primary artist only so we get enough results; filtering still uses the full name. */
async function getSongsByArtist(artistName) {
    const term = artistName.trim();
    if (!term) return { songs: [] };
    const hasCollab = /\s+&\s+|\s+feat\.?|\s+ft\.?|\s+and\s+|\s+with\s+|\s+x\s+|\s*,\s*/.test(term);
    const apiTerm = hasCollab ? getPrimaryArtist(term) : term;
    if (!apiTerm) return { songs: [] };
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(apiTerm)}&media=music&entity=song&limit=100`;
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
        const matchingPart = getMatchingArtistPart(artist, term);
        if (!matchingPart) continue;
        const okTitle = isLikelyEnglish(title) || isHebrew(title);
        const okArtist = isLikelyEnglish(artist) || isHebrew(artist);
        if (!okTitle || !okArtist) continue;
        const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ title, artist });
    }
    const termNorm = normalizeArtistName(term);
    const byMatchedArtist = {};
    out.forEach(s => {
        const part = getMatchingArtistPart(s.artist, term);
        if (!part) return;
        if (!byMatchedArtist[part]) byMatchedArtist[part] = [];
        byMatchedArtist[part].push(s);
    });
    let artists = Object.keys(byMatchedArtist);
    artists = artists.filter(a => artistPartMatchesRequest(normalizeArtistName(a), termNorm));
    if (artists.length > 1) {
        return { needArtistSelection: true, artists, songsByArtist: byMatchedArtist };
    }
    return { songs: out };
}

/** Get a flat songs array from getSongsByArtist result (for preload and Next Song when not showing artist picker). */
function getSongsArrayFromArtistResult(result) {
    if (!result) return [];
    if (result.songs && result.songs.length) return result.songs;
    if (result.needArtistSelection && result.artists && result.songsByArtist)
        return result.artists.flatMap(a => result.songsByArtist[a] || []);
    return [];
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

// Spotify mode: tracks we've already played in this playlist session (keys "title_artist")
let spotifyPlayedInSession = new Set();
let preloadedSpotifySongs = []; // { title, artist, lyrics }[] same as artist preload
let preloadSpotifyInProgress = false;

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

/** Load one more song into the queue if we have room. Skips when user is loading a specific song (priority). In artist mode, gives priority to artist preload until that queue is full. */
function preloadNextSurpriseSong() {
    if (userSongLoadInProgress || preloadedSurpriseSongs.length >= PRELOAD_QUEUE_MAX || preloadInProgress) return;
    if (gameState.surpriseArtistName && gameState.surpriseArtistName.trim() && preloadedArtistSongs.length < PRELOAD_QUEUE_MAX) {
        preloadNextArtistSong();
        return;
    }
    preloadInProgress = true;
    getRandomPopularSong()
        .then(song => fetchLyrics(song.title, song.artist).then(lyrics => ({ song, lyrics })))
        .then(({ song, lyrics }) => {
            if (lyrics && lyrics.trim().length >= 50 && usesOnlyEnglishAlphabet(lyrics)) {
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

/** Load one more song by current artist. Uses same search term as first song (requestedArtistName) so we get the same pool as Next Song. */
function preloadNextArtistSong() {
    const searchTerm = (gameState.requestedArtistName && gameState.requestedArtistName.trim()) || (gameState.surpriseArtistName && gameState.surpriseArtistName.trim());
    if (!searchTerm || userSongLoadInProgress || preloadedArtistSongs.length >= PRELOAD_QUEUE_MAX || preloadArtistInProgress) return;
    if (preloadedArtistName !== searchTerm) {
        preloadedArtistName = searchTerm;
        preloadedArtistSongs = [];
    }
    preloadArtistInProgress = true;
    getSongsByArtist(searchTerm)
        .then(result => {
            const songs = getSongsArrayFromArtistResult(result);
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
            if (result && result.lyrics && result.lyrics.trim().length >= 50 && (usesOnlyEnglishAlphabet(result.lyrics) || isHebrew(result.lyrics))) {
                preloadedArtistSongs.push({ title: result.title, artist: result.artist, lyrics: result.lyrics, isHebrew: isHebrew(result.lyrics) });
                updatePreloadCounter();
            }
        })
        .catch(() => {})
        .finally(() => {
            preloadArtistInProgress = false;
            const st = (gameState.requestedArtistName && gameState.requestedArtistName.trim()) || (gameState.surpriseArtistName && gameState.surpriseArtistName.trim());
            if (st && preloadedArtistSongs.length < PRELOAD_QUEUE_MAX) {
                preloadNextArtistSong();
            } else {
                preloadNextSurpriseSong(); // resume regular surprise preload when artist queue full or not in artist mode
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
    document.body.classList.add('in-game');
    updateFailedSongsDisplay(globalFailedSongs);
    startBtn.innerHTML = '🎯 Start Game';
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

/** Load next surprise song (only in surprise game). Uses preload if ready, else fetches one. When surpriseArtistName is set, picks from that artist. Spotify mode: picks from playlist or shows "playlist end" message. */
async function nextSurpriseSong() {
    if (!gameState.isSurpriseSong) return;
    const nextSongBtn = document.getElementById('nextSongBtn');
    if (!nextSongBtn) return;
    const spotifyPlaylistEndMessage = document.getElementById('spotifyPlaylistEndMessage');
    const bySpotify = gameState.spotifyPlaylistName && gameState.spotifyPlaylistName.trim();
    const byArtist = !bySpotify && gameState.surpriseArtistName && gameState.surpriseArtistName.trim();

    trackEvent('next_song', { mode: bySpotify ? 'spotify' : (byArtist ? 'surprise_artist' : 'surprise') });
    nextSongBtn.innerHTML = 'Loading... <span class="loading"></span>';
    nextSongBtn.disabled = true;
    if (spotifyPlaylistEndMessage) spotifyPlaylistEndMessage.style.display = 'none';
    resetVictoryUI();

    if (bySpotify) {
        const preloaded = takePreloadedSpotifySong();
        if (preloaded && preloaded.lyrics && preloaded.lyrics.trim().length >= 50) {
            initializeGame(preloaded.lyrics, preloaded.title, preloaded.artist, true, null, null, null, preloaded.isHebrew || false);
            updateFailedSongsDisplay(globalFailedSongs);
            document.getElementById('gameArea').style.display = 'block';
            const wordInputEl = document.getElementById('wordInput');
            if (wordInputEl) wordInputEl.focus();
            updateDevModeUI();
            preloadNextSpotifySong();
            nextSongBtn.innerHTML = 'Next Song →';
            nextSongBtn.disabled = false;
            playSongRefreshAnimation();
            return;
        }
        const track = pickNextSpotifyTrack();
        if (!track) {
            nextSongBtn.style.display = 'none';
            if (spotifyPlaylistEndMessage) spotifyPlaylistEndMessage.style.display = 'block';
            nextSongBtn.innerHTML = 'Next Song →';
            nextSongBtn.disabled = false;
            return;
        }
        try {
            const lyrics = await fetchLyrics(track.title, track.artist);
            if (!lyrics || lyrics.trim().length < 50) throw new Error('No lyrics');
            if (!usesOnlyEnglishAlphabet(lyrics) && !isHebrew(lyrics)) throw new Error('Lyrics use unsupported characters.');
            initializeGame(lyrics, track.title, track.artist, true, null, null, null, isHebrew(lyrics));
            updateFailedSongsDisplay(globalFailedSongs);
            document.getElementById('gameArea').style.display = 'block';
            const wordInputEl = document.getElementById('wordInput');
            if (wordInputEl) wordInputEl.focus();
            updateDevModeUI();
            preloadNextSpotifySong();
            playSongRefreshAnimation();
        } catch (err) {
            console.error('Next Spotify song failed:', err);
            spotifyPlayedInSession.delete(`${track.title.toLowerCase()}_${track.artist.toLowerCase()}`);
            showError(err.message || 'Could not load lyrics for this song.');
        }
        nextSongBtn.innerHTML = 'Next Song →';
        nextSongBtn.disabled = false;
        return;
    }

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
            initializeGame(preloadedArtist.lyrics, preloadedArtist.title, preloadedArtist.artist, true, preloadedArtist.year || null, preloadedArtist.rank || null, preloadedArtist.topK || null, preloadedArtist.isHebrew || false);
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
            const searchTerm = (gameState.requestedArtistName && gameState.requestedArtistName.trim()) || gameState.surpriseArtistName;
            const artistResult = await getSongsByArtist(searchTerm);
            const songs = getSongsArrayFromArtistResult(artistResult);
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
        if (!usesOnlyEnglishAlphabet(lyrics) && !isHebrew(lyrics)) throw new Error('Lyrics use characters outside the English alphabet.');
        initializeGame(lyrics, song.title, song.artist, true, songYear || null, song.rank || null, song.topK || null, isHebrew(lyrics));
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

function openSpotifyPlaylistPicker() {
    const overlay = document.getElementById('spotifyPlaylistOverlay');
    const listEl = document.getElementById('spotifyPlaylistList');
    if (!overlay || !listEl) return;
    listEl.innerHTML = '<div class="song-list-loading">Loading playlists…</div>';
    overlay.style.display = 'flex';
    const SHOW_PLAYLIST_SONG_COUNT = false; // set true to show song count per playlist (currently unreliable)
    Promise.all([
        spotifyFetchPlaylists(),
        spotifyGetLikedTracksTotal().catch(() => 0)
    ]).then(([playlists, likedTotal]) => {
        listEl.innerHTML = '';
        const likedItem = document.createElement('div');
        likedItem.className = 'song-item';
        const likedCountText = SHOW_PLAYLIST_SONG_COUNT && likedTotal > 0 ? (likedTotal + ' song' + (likedTotal !== 1 ? 's' : '')) : 'Your saved tracks';
        likedItem.innerHTML = '<div class="song-item-info"><strong>❤️ Liked Songs</strong><span class="song-artist">' + likedCountText + '</span></div>';
        likedItem.addEventListener('click', () => {
            overlay.style.display = 'none';
            startSpotifyWithLikedSongs();
        });
        listEl.appendChild(likedItem);
        for (const p of playlists) {
            const item = document.createElement('div');
            item.className = 'song-item';
            const count = (p.tracksTotal != null && p.tracksTotal >= 0) ? p.tracksTotal : 0;
            const info = document.createElement('div');
            info.className = 'song-item-info';
            const strong = document.createElement('strong');
            strong.textContent = p.name;
            const span = document.createElement('span');
            span.className = 'song-artist';
            span.textContent = SHOW_PLAYLIST_SONG_COUNT ? (count + ' song' + (count !== 1 ? 's' : '')) : '';
            info.appendChild(strong);
            info.appendChild(span);
            item.appendChild(info);
            item.addEventListener('click', () => {
                overlay.style.display = 'none';
                startSpotifyWithPlaylist(p.id, p.name);
            });
            listEl.appendChild(item);
        }
    }).catch(err => {
        const errEl = document.createElement('div');
        errEl.className = 'song-list-error';
        errEl.textContent = err.message || 'Failed to load';
        listEl.innerHTML = '';
        listEl.appendChild(errEl);
    });
}

async function startSpotifyWithLikedSongs() {
    const btn = document.getElementById('spotifyConnectBtn');
    if (btn) { btn.innerHTML = 'Loading Liked Songs… <span class="loading"></span>'; btn.disabled = true; }
    try {
        const tracks = await spotifyFetchLikedTracks();
        if (!tracks.length) { showError('No tracks in Liked Songs'); return; }
        gameState.spotifyPlaylistId = null;
        gameState.spotifyPlaylistName = 'Liked Songs';
        gameState.spotifyTracks = tracks;
        spotifyPlayedInSession.clear();
        preloadedSpotifySongs = [];
        await pickAndLoadFirstSpotifySong();
    } catch (e) {
        showError(e.message || 'Failed to load Liked Songs');
    } finally {
        if (btn) { if (typeof window.updateSpotifyButtonText === 'function') window.updateSpotifyButtonText(); else { btn.textContent = '🎧 Pick a playlist'; btn.disabled = false; } }
    }
}

async function startSpotifyWithPlaylist(playlistId, playlistName) {
    const btn = document.getElementById('spotifyConnectBtn');
    if (btn) { btn.innerHTML = 'Loading playlist… <span class="loading"></span>'; btn.disabled = true; }
    try {
        const tracks = await spotifyFetchPlaylistTracks(playlistId);
        if (!tracks.length) { showError('Playlist is empty or could not load tracks'); return; }
        gameState.spotifyPlaylistId = playlistId;
        gameState.spotifyPlaylistName = playlistName || 'Playlist';
        gameState.spotifyTracks = tracks;
        spotifyPlayedInSession.clear();
        preloadedSpotifySongs = [];
        await pickAndLoadFirstSpotifySong();
    } catch (e) {
        showError(e.message || 'Failed to load playlist');
    } finally {
        if (btn) { if (typeof window.updateSpotifyButtonText === 'function') window.updateSpotifyButtonText(); else { btn.textContent = '🎧 Pick a playlist'; btn.disabled = false; } }
    }
}

function getSpotifyRemainingTracks() {
    return gameState.spotifyTracks.filter(t => !spotifyPlayedInSession.has(`${t.title.toLowerCase()}_${t.artist.toLowerCase()}`));
}

function pickNextSpotifyTrack() {
    const remaining = getSpotifyRemainingTracks();
    if (!remaining.length) return null;
    const chosen = remaining[Math.floor(Math.random() * remaining.length)];
    spotifyPlayedInSession.add(`${chosen.title.toLowerCase()}_${chosen.artist.toLowerCase()}`);
    return chosen;
}

async function pickAndLoadFirstSpotifySong() {
    const track = pickNextSpotifyTrack();
    if (!track) { showError('No songs in playlist'); return; }
    const startBtn = document.getElementById('startBtn');
    const surpriseBtn = document.getElementById('surpriseBtn');
    const surpriseByArtistBtn = document.getElementById('surpriseByArtistBtn');
    if (startBtn) startBtn.disabled = true;
    if (surpriseBtn) surpriseBtn.disabled = true;
    if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = true;
    try {
        const lyrics = await fetchLyrics(track.title, track.artist);
        if (!lyrics || lyrics.trim().length < 50) throw new Error('No lyrics');
        if (!usesOnlyEnglishAlphabet(lyrics) && !isHebrew(lyrics)) throw new Error('Lyrics use unsupported characters.');
        gameState.surpriseArtistName = '';
        initializeGame(lyrics, track.title, track.artist, true, null, null, null, isHebrew(lyrics));
        document.getElementById('gameSetup').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        document.body.classList.add('in-game');
        const songSelectionOverlay = document.getElementById('songSelectionOverlay');
        if (songSelectionOverlay) songSelectionOverlay.style.display = 'none';
        updateFailedSongsDisplay(globalFailedSongs);
        const wordInputEl = document.getElementById('wordInput');
        if (wordInputEl) wordInputEl.focus();
        updateDevModeUI();
        preloadNextSpotifySong();
    } catch (err) {
        console.error('First Spotify song failed:', err);
        showError(err.message || 'Could not load lyrics for this song.');
        const remaining = getSpotifyRemainingTracks();
        if (remaining.length) {
            spotifyPlayedInSession.delete(`${track.title.toLowerCase()}_${track.artist.toLowerCase()}`);
            pickAndLoadFirstSpotifySong();
        }
    }
    if (startBtn) startBtn.disabled = false;
    if (surpriseBtn) surpriseBtn.disabled = false;
    if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = false;
}

function preloadNextSpotifySong() {
    if (preloadedSpotifySongs.length >= PRELOAD_QUEUE_MAX || preloadSpotifyInProgress || !gameState.spotifyPlaylistName) return;
    const remaining = getSpotifyRemainingTracks();
    if (!remaining.length) return;
    preloadSpotifyInProgress = true;
    const chosen = remaining[Math.floor(Math.random() * remaining.length)];
    const key = `${chosen.title.toLowerCase()}_${chosen.artist.toLowerCase()}`;
    spotifyPlayedInSession.add(key);
    let added = false;
    fetchLyrics(chosen.title, chosen.artist)
        .then(lyrics => {
            if (lyrics && lyrics.trim().length >= 50 && (usesOnlyEnglishAlphabet(lyrics) || isHebrew(lyrics))) {
                preloadedSpotifySongs.push({ title: chosen.title, artist: chosen.artist, lyrics, isHebrew: isHebrew(lyrics) });
                added = true;
            }
        })
        .catch(() => {})
        .finally(() => {
            if (!added) spotifyPlayedInSession.delete(key);
            preloadSpotifyInProgress = false;
            if (preloadedSpotifySongs.length < PRELOAD_QUEUE_MAX) preloadNextSpotifySong();
        });
}

function takePreloadedSpotifySong() {
    const song = preloadedSpotifySongs.length > 0 ? preloadedSpotifySongs.shift() : null;
    return song;
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
    const artistSelectionOverlay = document.getElementById('artistSelectionOverlay');
    if (songSelectionOverlay) songSelectionOverlay.style.display = 'none';
    if (artistSelectionOverlay) artistSelectionOverlay.style.display = 'none';

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
        const result = await getSongsByArtist(artistName);
        if (result.needArtistSelection) {
            songs = await showArtistSelection(result.artists, result.songsByArtist);
            if (songs == null) {
                surpriseByArtistBtn.innerHTML = '🎤 Shuffle & play';
                surpriseByArtistBtn.disabled = false;
                startBtn.disabled = false;
                if (surpriseBtn) surpriseBtn.disabled = false;
                return;
            }
        } else {
            songs = result.songs || [];
            if (songs.length) {
                gameState.artistModeDisplayName = getMatchingArtistPart(songs[0].artist, artistName) || artistName;
            }
        }
    } catch (e) {
        showError('Could not find songs for that artist. Try another name.');
        surpriseByArtistBtn.innerHTML = '🎤 Shuffle & play';
        surpriseByArtistBtn.disabled = false;
        startBtn.disabled = false;
        if (surpriseBtn) surpriseBtn.disabled = false;
        return;
    }

    if (!songs.length) {
        showError(`No eligible songs found for "${artistName}". Try another artist.`);
        surpriseByArtistBtn.innerHTML = '🎤 Shuffle & play';
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
            surpriseByArtistBtn.innerHTML = '🎤 Shuffle & play';
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
    surpriseByArtistBtn.innerHTML = '🎤 Shuffle & play';
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

    // Secret code: "spotspot" unlocks Spotify mode and restores 4-column layout
    if (songName === 'spotspot') {
        spotifySecretUnlocked = true;
        document.body.classList.add('spotify-unlocked');
        const spotifyModeCard = document.getElementById('spotifyModeCard');
        if (spotifyModeCard) spotifyModeCard.style.display = 'block';
        trackEvent('spotify_mode_unlocked', { method: 'secret_code' });
        songInput.value = '';
        errorMessage.classList.remove('show');
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

    trackEvent('song_search', { query: songName.trim() });

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
        try {
            await loadSong(selectedSong.title, selectedSong.artist, false, null, null, null, false);
        } catch (loadErr) {
            showError(loadErr.message || 'Could not load this song. Please try another.');
            startBtn.innerHTML = '🎯 Start Game';
            startBtn.disabled = false;
            if (surpriseBtn) { surpriseBtn.innerHTML = '🎲 Surprise Me!'; surpriseBtn.disabled = false; }
            if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = false;
            return;
        }

    } catch (error) {
        showError(error.message || 'Failed to search for songs. Please try again.');
        startBtn.innerHTML = '🎯 Start Game';
        startBtn.disabled = false;
        if (surpriseBtn) {
            surpriseBtn.innerHTML = '🎲 Surprise Me!';
            surpriseBtn.disabled = false;
        }
        if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = false;
    }
}

async function loadSong(title, artist, isSurprise = false, year = null, rank = null, topK = null, showErrorOnFail = true) {
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
        initializeGame(lyrics, title, artist, isSurprise, year, rank, topK, isHebrew(lyrics));

        // Hide selection if visible
        const songSelectionOverlay = document.getElementById('songSelectionOverlay');
        if (songSelectionOverlay) songSelectionOverlay.style.display = 'none';

        // Show game area
        document.getElementById('gameSetup').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        document.body.classList.add('in-game');

        // Update failed songs display to show in game screen
        updateFailedSongsDisplay(globalFailedSongs);

        // Reset button states
        startBtn.innerHTML = '🎯 Start Game';
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
        if (!isSurprise) {
            if (showErrorOnFail) {
                const errorMsg = error.message || 'Failed to fetch lyrics. Please try again.';
                showError(errorMsg);
            }
            startBtn.innerHTML = '🎯 Start Game';
            startBtn.disabled = false;
            if (surpriseBtn) {
                surpriseBtn.innerHTML = '🎲 Surprise Me!';
                surpriseBtn.disabled = false;
            }
            if (surpriseByArtistBtn) surpriseByArtistBtn.disabled = false;
        }
        throw error;
    } finally {
        userSongLoadInProgress = false;
        preloadNextSurpriseSong();
    }
}

/** Common Spanish words (whole-word match). Used to detect Spanish lyrics; need 10+ matches to reject. */
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

/** Words that are in SPANISH_WORDS but are also common in English (names, loanwords, etc.). Do not count these when detecting Spanish lyrics, so we don't reject English songs like "Bohemian Rhapsody" that use "sin", "con", "Los", "todo", etc. */
const SPANISH_WORDS_ALSO_ENGLISH = new Set([
    'con', 'sin', 'todo', 'todos', 'dame', 'ella', 'los', 'las', 'dan', 'para', 'nos', 'como', 'sobre'
]);

/** Normalize word for Spanish check: lowercase, strip accents (so "qué" matches "que"). */
function normalizeForLangCheck(word) {
    return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Count Spanish indicator words (whole words) in text. Excludes words that are common in English to avoid false positives (e.g. "sin", "con", "Los Angeles", "todo"). Only reject if 10+ *Spanish-specific* words. */
function countSpanishWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const tokens = text.split(/[^\p{L}']+/u).filter(Boolean);
    let count = 0;
    for (const token of tokens) {
        const w = normalizeForLangCheck(token);
        if (w.length < 2) continue;
        if (SPANISH_WORDS.has(w) && !SPANISH_WORDS_ALSO_ENGLISH.has(w)) count++;
    }
    return count;
}

/** True if text contains Hebrew letters (Unicode block \u0590-\u05FF). */
function isHebrew(text) {
    if (!text || typeof text !== 'string') return false;
    return /[\u0590-\u05FF]/.test(text);
}

/** True if text uses only the English (Latin) alphabet. Accented letters (é, ñ, ü) are allowed because they normalize to a-z (e.g. Spanish "niño" → "nino"). Rejects scripts like Cyrillic, CJK, Arabic, Hebrew. */
function usesOnlyEnglishAlphabet(text) {
    if (!text || typeof text !== 'string') return true;
    try {
        // Normalize to NFD (decomposed form) and remove combining marks (accents)
        // This converts é → e, ñ → n, etc.
        const normalized = text.normalize('NFD').replace(/\p{M}/gu, '');
        
        for (const char of normalized) {
            // Only check Unicode letters (Category L) - ignore punctuation, digits, whitespace
            if (/\p{L}/u.test(char)) {
                const code = char.charCodeAt(0);
                // Always allow basic Latin (a-z, A-Z)
                if (/[a-zA-Z]/.test(char)) {
                    continue;
                }
                // Allow Latin Extended ranges (should normalize but be permissive)
                // Latin Extended-A: U+0100-U+017F, Latin Extended-B: U+0180-U+024F
                // Latin Extended Additional: U+1E00-U+1EFF, Latin Extended-C: U+2C60-U+2C7F
                // Latin Extended-D: U+A720-U+A7FF, Latin Extended-E: U+AB30-U+AB6F
                if ((code >= 0x0100 && code <= 0x024F) ||
                    (code >= 0x1E00 && code <= 0x1EFF) ||
                    (code >= 0x2C60 && code <= 0x2C7F) ||
                    (code >= 0xA720 && code <= 0xA7FF) ||
                    (code >= 0xAB30 && code <= 0xAB6F)) {
                    continue; // Allow Latin Extended characters
                }
                // Reject known non-Latin scripts (Cyrillic, Greek, CJK, Arabic, Hebrew, etc.)
                // Check for common non-Latin script ranges
                if ((code >= 0x0370 && code <= 0x03FF) ||   // Greek
                    (code >= 0x0400 && code <= 0x04FF) ||   // Cyrillic
                    (code >= 0x0530 && code <= 0x058F) ||   // Armenian
                    (code >= 0x0590 && code <= 0x05FF) ||   // Hebrew
                    (code >= 0x0600 && code <= 0x06FF) ||   // Arabic
                    (code >= 0x0900 && code <= 0x097F) ||   // Devanagari
                    (code >= 0x3040 && code <= 0x309F) ||   // Hiragana
                    (code >= 0x30A0 && code <= 0x30FF) ||   // Katakana
                    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
                    (code >= 0xAC00 && code <= 0xD7AF)) {   // Hangul
                    return false;
                }
                // For any other Unicode letter not in the above ranges, be permissive
                // (might be a rare Latin variant or a character that should have normalized)
            }
        }
        return true;
    } catch (e) {
        // If normalization fails (shouldn't happen in modern browsers), be permissive
        // Fall back to checking if text contains only ASCII printable + common Unicode punctuation
        return /^[\x20-\x7E\u00A0-\u00FF\u2013-\u201E\u2026]*$/.test(text);
    }
}

/** True if text looks like English. Rejects non-Latin scripts; rejects Spanish only if enough Spanish words. Used for Surprise Me preload filtering only. */
function isLikelyEnglish(text) {
    if (!text || typeof text !== 'string') return true;
    if (!usesOnlyEnglishAlphabet(text)) return false;
    if (text.length < 150) return true;
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
            const okTitle = usesOnlyEnglishAlphabet(result.trackName) || isHebrew(result.trackName);
            const okArtist = usesOnlyEnglishAlphabet(result.artistName) || isHebrew(result.artistName);
            if (!okTitle || !okArtist) return;
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

/** Show artist selection overlay; returns a Promise that resolves to the chosen artist's songs array or null if cancelled. */
function showArtistSelection(artists, songsByArtist) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('artistSelectionOverlay');
        const artistList = document.getElementById('artistList');
        const cancelBtn = document.getElementById('cancelArtistSelectionBtn');
        if (!overlay || !artistList) {
            resolve(artists.length === 1 ? (songsByArtist[artists[0]] || []) : null);
            return;
        }
        artistList.innerHTML = '';
        artists.forEach((artistName) => {
            const songs = songsByArtist[artistName] || [];
            const item = document.createElement('div');
            item.className = 'song-item';
            item.innerHTML = `
                <div class="song-item-info">
                    <strong>${artistName}</strong>
                    <span class="song-artist">${songs.length} song${songs.length !== 1 ? 's' : ''}</span>
                </div>
            `;
            item.addEventListener('click', () => {
                overlay.style.display = 'none';
                gameState.artistModeDisplayName = artistName;
                resolve(songs);
            });
            artistList.appendChild(item);
        });
        const onCancel = () => {
            overlay.style.display = 'none';
            cancelBtn.removeEventListener('click', onCancel);
            resolve(null);
        };
        cancelBtn.addEventListener('click', onCancel);
        overlay.style.display = 'flex';
    });
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
            trackEvent('song_selected', { title: song.title, artist: song.artist, from_search: true });
            try {
                await loadSong(song.title, song.artist, false, null, null, null, false);
            } catch (err) {
                // Don't re-show selection popup; show reason in error area so player knows
                songSelectionOverlay.style.display = 'none';
                showError(err.message || 'Could not load this song. Please try another.');
            }
        });
        songList.appendChild(songItem);
    });
    
    songSelectionOverlay.style.display = 'flex';
    startBtn.innerHTML = '🎯 Start Game';
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

/** Main entry: resolve metadata via iTunes, try LRCLIB exact match if we have duration, then variations + providers.
 * Lyrics are rejected only if they use non-English-alphabet scripts (Cyrillic, CJK, Arabic, etc.). Spanish is allowed (accented letters normalize to a-z). */
async function fetchLyrics(title, artist) {
    const iTunesMetadata = await getSongFromiTunes(title, artist);
    const exactTitle = iTunesMetadata.title;
    const exactArtist = iTunesMetadata.artist;
    const album = iTunesMetadata.album || '';
    const durationSeconds = iTunesMetadata.durationSeconds;

    const checkAlphabet = (lyrics) => {
        if (!usesOnlyEnglishAlphabet(lyrics) && !isHebrew(lyrics)) throw new Error('Lyrics use characters outside the English alphabet.');
    };

    if (durationSeconds != null && durationSeconds > 0) {
        try {
            const lyrics = await fetchFromLrclibGet(exactArtist, exactTitle, album, durationSeconds);
            if (lyrics && lyrics.trim().length >= LYRICS_MIN_LENGTH) {
                checkAlphabet(lyrics);
                console.log('Lyrics found via LRCLIB get (exact match).');
                return lyrics;
            }
        } catch (err) {
            if (err.message === 'Lyrics use characters outside the English alphabet.') throw err;
            console.log('LRCLIB get failed, trying search + providers:', err.message || err);
        }
    }

    const variations = generateNameVariations(exactArtist, exactTitle);
    for (let i = 0; i < variations.length; i++) {
        const { artist: a, title: t } = variations[i];
        try {
            const lyrics = await tryAllProviders(a, t);
            if (lyrics && lyrics.trim().length >= LYRICS_MIN_LENGTH) {
                checkAlphabet(lyrics);
                console.log(`Lyrics found for "${t}" by ${a} (variation ${i + 1}/${variations.length}).`);
                return lyrics;
            }
        } catch (err) {
            if (err.message === 'Lyrics use characters outside the English alphabet.') throw err;
            console.log(`Variation "${t}" by ${a}: ${err.message || err}`);
        }
    }

    throw new Error(`Could not find lyrics for "${exactTitle}" by ${exactArtist}. Tried ${variations.length} name variations.`);
}

// ---------- End lyrics fetching ----------

function initializeGame(lyrics, title, artist, isSurprise = false, year = null, rank = null, topK = null, isHebrewSong = false) {
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
    gameState.hintRevealedIndices = new Set();
    gameState.totalWords = actualWordCount;
    gameState.foundCount = 0;
    gameState.songTitle = title;
    gameState.songArtist = artist;
    gameState.songYear = year;
    gameState.songRank = rank;
    gameState.songYearTopK = topK;
    gameState.lyricsRevealed = false;
    gameState.isSurpriseSong = isSurprise;
    gameState.isHebrew = isHebrewSong;
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
    
    // Show/hide artist vs Spotify mode banner
    const artistModeBanner = document.getElementById('artistModeBanner');
    const artistModeName = document.getElementById('artistModeName');
    const spotifyModeBanner = document.getElementById('spotifyModeBanner');
    const spotifyPlaylistNameEl = document.getElementById('spotifyPlaylistName');
    const spotifyPlaylistEndMessage = document.getElementById('spotifyPlaylistEndMessage');
    if (spotifyPlaylistEndMessage) spotifyPlaylistEndMessage.style.display = 'none';
    if (gameState.spotifyPlaylistName && gameState.spotifyPlaylistName.trim()) {
        if (spotifyModeBanner) spotifyModeBanner.style.display = 'block';
        if (spotifyPlaylistNameEl) spotifyPlaylistNameEl.textContent = gameState.spotifyPlaylistName;
        if (artistModeBanner) artistModeBanner.style.display = 'none';
    } else {
        if (spotifyModeBanner) spotifyModeBanner.style.display = 'none';
        if (gameState.surpriseArtistName && gameState.surpriseArtistName.trim()) {
            if (artistModeBanner) artistModeBanner.style.display = 'block';
            if (artistModeName) {
                artistModeName.textContent = gameState.artistModeDisplayName || gameState.requestedArtistName || gameState.surpriseArtistName;
            }
        } else {
            if (artistModeBanner) artistModeBanner.style.display = 'none';
        }
    }

    // Update year display (only show in surprise mode, not artist mode or specific song mode)
    // (isArtistMode and isSurpriseModeOnly already declared above in this function)
    if (songYearEl) {
        if (isSurpriseModeOnly && year) {
            // Show year in surprise mode (hidden initially)
            songYearEl.textContent = '???';
            songYearEl.classList.add('hidden-year');
            songYearEl.style.display = ''; // Ensure it's visible
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
            nextSongBtn.classList.remove('song-done');
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
            nextSongBtn.classList.remove('song-done');
            nextSongBtn.style.display = 'none';
        }
    }
    
    document.getElementById('totalCount').textContent = gameState.totalWords;
    document.getElementById('foundCount').textContent = '0';
    updateHintCountDisplay();
    updateLastRevealedDisplay('', 0, null);

    // Create lyrics table
    createLyricsTable(words);

    // Hebrew: show banner and set lyrics table RTL
    const lyricsContainer = document.querySelector('.lyrics-table-container');
    const hebrewBanner = document.getElementById('hebrewSongBanner');
    if (isHebrewSong) {
        if (lyricsContainer) { lyricsContainer.dir = 'rtl'; lyricsContainer.classList.add('lyrics-rtl'); }
        if (hebrewBanner) { hebrewBanner.style.display = 'block'; }
    } else {
        if (lyricsContainer) { lyricsContainer.dir = 'ltr'; lyricsContainer.classList.remove('lyrics-rtl'); }
        if (hebrewBanner) { hebrewBanner.style.display = 'none'; }
    }
    
    const mode = gameState.spotifyPlaylistName && gameState.spotifyPlaylistName.trim()
        ? 'spotify'
        : (gameState.isSurpriseSong
            ? (gameState.surpriseArtistName && gameState.surpriseArtistName.trim() ? 'surprise_artist' : 'surprise')
            : 'choose_song');
    trackEvent('game_start', { mode: mode, total_words: actualWordCount, song_year: year || undefined, playlist: mode === 'spotify' ? gameState.spotifyPlaylistName : undefined });
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
        let pendingPrefix = '';
        lineWords.forEach((word, wordIndex) => {
            // Split on hyphens and Unicode dashes (en-dash, em-dash) so "oh-ooh" / "oh–ooh" become "oh" and "ooh"
            const parts = word.split(/\p{Pd}/u).filter(p => p.length > 0);
            if (parts.length === 0) return;
            parts.forEach((part) => {
                const normalized = normalizeWord(part);
                if (normalized.length === 0) {
                    // Punctuation-only: "(" goes at start of next word, ")" at end of previous
                    if (/^\(+$/.test(part)) {
                        pendingPrefix += part;
                    } else if (/^\)+$/.test(part)) {
                        if (words.length > 0 && !words[words.length - 1].isNewline) {
                            words[words.length - 1].word += part;
                        }
                    }
                    return;
                }
                words.push({
                    word: pendingPrefix + part,
                    normalized: normalized,
                    lineIndex: lineIndex,
                    wordIndex: wordIndex
                });
                pendingPrefix = '';
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
    // Remove punctuation and convert to lowercase for comparison. Use \p{L}\p{N} so Hebrew and other Unicode letters are kept.
    return word.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
}

/** Normalized "oh"-style words (oh, ooh, ah, uh, etc.): guessing any of these reveals all of them in the lyrics. */
const OH_VARIANTS = new Set([
    'oh', 'ooh', 'ohh', 'oooh', 'ohhh', 'oohh', 'ooooh', 'ohhhh', 'oooo', 'oohoh', 'ohooh',
    'ah', 'ahh', 'aah', 'ahhh', 'aaah', 'ahhhh', 'aahh', 'ahah',
    'uh', 'uhh', 'uuh', 'uhhh', 'uuuh', 'uhhhh', 'uuhh', 'uhuh'
]);

/** Normalize string for OH_VARIANTS matching: map fullwidth/special Latin to ASCII so "ｏｏｈ" matches "ooh". */
function normalizeForOhMatch(s) {
    if (!s || typeof s !== 'string') return '';
    return s.replace(/[\uFF21-\uFF3A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/[\uFF41-\uFF5A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .toLowerCase();
}

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
        trackEvent('reveal_lyrics', { action: 'hide' });
    } else {
        // Reveal all lyrics
        revealAllLyrics();
        revealBtn.textContent = 'Hide Lyrics';
        gameState.lyricsRevealed = true;
        trackEvent('reveal_lyrics', { action: 'show' });
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
    gameState.words.forEach((wordObj, index) => { // od
        if (!wordObj.isNewline) {
            const slot = document.querySelector(`.word-slot[data-index="${index}"]`);
            if (slot) {
                // Only hide if it wasn't user-guessed
                if (!gameState.userGuessedWords.has(wordObj.normalized)) {
                    slot.textContent = '';
                    slot.classList.remove('found', 'hint-revealed');
                    slot.classList.add('empty');
                    gameState.foundWords.delete(wordObj.normalized);
                    gameState.hintRevealedIndices.delete(index);
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
    updateHintCountDisplay();
    
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
        trackEvent('reveal_title');
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
            trackEvent('reveal_year', { year: gameState.songYear });
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
    
    // Mark missed words (not user-guessed) with special styling; don't mark hint-revealed as missed
    gameState.words.forEach((wordObj, index) => {
        if (!wordObj.isNewline) {
            const slot = document.querySelector(`.word-slot[data-index="${index}"]`);
            if (slot && slot.classList.contains('found')) {
                if (!userGuessedBefore.has(wordObj.normalized) && !slot.classList.contains('hint-revealed')) {
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
    const userFoundOnly = userFoundCount - (gameState.hintRevealedIndices ? gameState.hintRevealedIndices.size : 0);
    const percentageUser = totalWords > 0 ? Math.round((userFoundOnly / totalWords) * 100) : 0;
    const hintsUsed = gameState.hintRevealedIndices ? gameState.hintRevealedIndices.size : 0;
    trackEvent('song_give_up', { completion_pct: percentageUser, hints_used: hintsUsed, total_words: totalWords });
    if (endGameTitle) endGameTitle.textContent = getEndGameMessage(percentageUser, true);
    if (endGameFound) endGameFound.textContent = userFoundOnly;
    if (endGameTotal) endGameTotal.textContent = totalWords;
    if (endGamePct) endGamePct.textContent = percentageUser + '%';
    
    const giveUpResults = document.getElementById('giveUpResults');
    if (giveUpResults) giveUpResults.style.display = 'none';
    
    const giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) giveUpBtn.style.display = 'none';
    
    const nextSongBtn = document.getElementById('nextSongBtn');
    if (nextSongBtn && nextSongBtn.style.display !== 'none') nextSongBtn.classList.add('song-done');
    
    if (endGameStats) {
        setTimeout(() => endGameStats.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
}

function showHelp(title, content) {
    trackEvent('help_opened', { help_topic: title });
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
    const inputOh = normalizeForOhMatch(normalizedInput);
    if (OH_VARIANTS.has(normalizedInput) || OH_VARIANTS.has(inputOh)) {
        const ohMatches = [];
        gameState.words.forEach((wordObj, index) => {
            const wordOh = normalizeForOhMatch(wordObj.normalized);
            const isOhVariant = OH_VARIANTS.has(wordObj.normalized) || OH_VARIANTS.has(wordOh);
            if (!wordObj.isNewline && isOhVariant && !gameState.foundWords.has(wordObj.normalized)) {
                ohMatches.push(index);
            }
        });
        if (ohMatches.length > 0) {
            ohMatches.forEach(index => gameState.foundWords.add(gameState.words[index].normalized));
            gameState.userGuessedWords.add(normalizedInput);
            gameState.foundCount += ohMatches.length;
            revealWord(normalizedInput, ohMatches);
            document.getElementById('foundCount').textContent = gameState.foundCount;
            updateLastRevealedDisplay(gameState.words[ohMatches[0]].word, ohMatches.length, false);
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
        updateLastRevealedDisplay(gameState.words[matches[0]].word, matches.length, false);
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

function revealWord(normalizedWord, indices, isHint = false) {
    indices.forEach(index => {
        const slot = document.querySelector(`.word-slot[data-index="${index}"]`);
        if (slot && !slot.classList.contains('found')) {
            const wordObj = gameState.words[index];
            slot.textContent = wordObj.word;
            slot.classList.remove('empty');
            slot.classList.add('found');
            if (isHint) {
                slot.classList.add('hint-revealed');
                gameState.hintRevealedIndices.add(index);
            }
        }
    });
    if (isHint) updateHintCountDisplay();
}

function updateHintCountDisplay() {
    const note = document.getElementById('hintCountNote');
    const countEl = document.getElementById('hintRevealedCount');
    const n = gameState.hintRevealedIndices ? gameState.hintRevealedIndices.size : 0;
    if (note) {
        note.style.display = n > 0 ? 'inline' : 'none';
        note.setAttribute('aria-hidden', n > 0 ? 'false' : 'true');
    }
    if (countEl) countEl.textContent = String(n);
}

function updateLastRevealedDisplay(displayWord, count, isHint) {
    const el = document.getElementById('lastRevealedCenter');
    if (!el) return;
    el.classList.remove('last-revealed-hint', 'last-revealed-guess');
    if (displayWord != null && displayWord !== '' && count != null && count > 0) {
        const times = count === 1 ? '1 time' : count + ' times';
        el.textContent = "Last revealed: \u201C" + displayWord + "\u201D (" + times + ")";
        el.classList.add(isHint ? 'last-revealed-hint' : 'last-revealed-guess');
    } else {
        el.textContent = '';
    }
}

function useHint() {
    if (!gameState.words || gameState.words.length === 0 || gameState.lyricsRevealed) return;
    const unrevealedByNormalized = new Map();
    gameState.words.forEach((wordObj, index) => {
        if (wordObj.isNewline) return;
        const slot = document.querySelector(`.word-slot[data-index="${index}"]`);
        if (!slot || slot.classList.contains('found')) return;
        const norm = wordObj.normalized;
        if (!unrevealedByNormalized.has(norm)) unrevealedByNormalized.set(norm, []);
        unrevealedByNormalized.get(norm).push(index);
    });
    const candidates = Array.from(unrevealedByNormalized.entries()).filter(([, indices]) => indices.length > 0);
    if (candidates.length === 0) return;
    const [chosenNormalized, indices] = candidates[Math.floor(Math.random() * candidates.length)];
    const displayWord = gameState.words[indices[0]].word;
    revealWord(chosenNormalized, indices, true);
    indices.forEach(i => gameState.foundWords.add(gameState.words[i].normalized));
    gameState.foundCount += indices.length;
    document.getElementById('foundCount').textContent = gameState.foundCount;
    updateHintCountDisplay();
    updateLastRevealedDisplay(displayWord, indices.length, true);
    trackEvent('hint_used', { words_revealed: indices.length });
    if (!gameState.lyricsRevealed && gameState.foundCount >= gameState.totalWords) {
        if (gameState.isSurpriseSong && !gameState.titleRevealed) {
            revealSongTitle();
            const revealTitleBtn = document.getElementById('revealTitleBtn');
            if (revealTitleBtn) revealTitleBtn.textContent = 'Hide Song';
        }
        showVictory();
    }
}

/** Returns the end-game title message by completion % and whether the player gave up. Encouraging for all; sarcastic only for 10% or less when completed (not give up). */
function getEndGameMessage(completionPct, isGiveUp) {
    const p = Math.min(100, Math.max(0, completionPct));
    if (p <= 10 && !isGiveUp) {
        return "All done! …with a little help from the hints. 😉";
    }
    if (p <= 10) {
        return "Tough song! No shame in trying—give it another shot sometime.";
    }
    if (p <= 19) return "It's a start! The more you play, the better you'll get.";
    if (p <= 29) return "You're building your skills! Try again anytime.";
    if (p <= 39) return "Every word counts! Keep going!";
    if (p <= 49) return "You found quite a few! Keep listening!";
    if (p <= 59) return "Good effort! Half the song—that's something!";
    if (p <= 69) return "Nice work! You're getting there!";
    if (p <= 79) return "Well done! You've got a great ear!";
    if (p <= 89) return "Great job! You really know your lyrics!";
    if (p <= 99) return "Amazing! Almost perfect!";
    return "Perfection!";
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
    const userFoundOnly = totalWords - (gameState.hintRevealedIndices ? gameState.hintRevealedIndices.size : 0);
    const completionPct = totalWords > 0 ? Math.round((userFoundOnly / totalWords) * 100) : 100;
    const hintsUsed = gameState.hintRevealedIndices ? gameState.hintRevealedIndices.size : 0;
    trackEvent('song_complete', { completion_pct: completionPct, hints_used: hintsUsed, total_words: totalWords });
    if (endGameTitle) endGameTitle.textContent = getEndGameMessage(completionPct, false);
    if (endGameFound) endGameFound.textContent = userFoundOnly;
    if (endGameTotal) endGameTotal.textContent = totalWords;
    if (endGamePct) endGamePct.textContent = completionPct + '%';
    const victoryMessage = document.getElementById('victoryMessage');
    if (victoryMessage) victoryMessage.style.display = 'none';
    const giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) giveUpBtn.style.display = 'none';
    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) revealBtn.style.display = 'none';
    const revealTitleBtn = document.getElementById('revealTitleBtn');
    if (revealTitleBtn) revealTitleBtn.style.display = 'none';
    const nextSongBtn = document.getElementById('nextSongBtn');
    if (nextSongBtn && nextSongBtn.style.display !== 'none') nextSongBtn.classList.add('song-done');
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
