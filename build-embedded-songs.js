/**
 * Build embedded-songs.js from songs-by-year.json so the app works when opened
 * via file:// (no fetch) and when served (e.g. GitHub Pages).
 * Run: node build-embedded-songs.js
 * Run this after editing songs-by-year.json, then commit both files.
 */
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'songs-by-year.json');
const outPath = path.join(__dirname, 'embedded-songs.js');

const byYear = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const flat = [];
for (const [year, list] of Object.entries(byYear)) {
    const y = parseInt(year, 10);
    if (!Array.isArray(list)) continue;
    for (const s of list) {
        if (s && s.title && s.artist) {
            flat.push({
                title: String(s.title).trim(),
                artist: String(s.artist).trim(),
                year: y
            });
        }
    }
}

const content = 'window.EMBEDDED_SONGS_DB=' + JSON.stringify(flat) + ';\n';
fs.writeFileSync(outPath, content, 'utf8');
console.log('Wrote embedded-songs.js with', flat.length, 'songs.');
