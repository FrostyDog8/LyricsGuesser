/**
 * Dev mode password - COPY THIS FILE to dev-mode-secret.js and set your hash.
 *
 * 1. Choose a password (only you need to know it).
 * 2. Generate its SHA-256 hash (e.g. https://emn178.github.io/online-tools/sha256.html )
 *    or in browser console: await crypto.subtle.digest('SHA-256', new TextEncoder().encode('YourPassword')).then(b => Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''))
 * 3. Copy this file to dev-mode-secret.js and set DEV_MODE_PASSWORD_HASH to that hex string.
 * 4. dev-mode-secret.js is in .gitignore so it will never be committed.
 */
// window.DEV_MODE_PASSWORD_HASH = 'your-sha256-hex-here';
