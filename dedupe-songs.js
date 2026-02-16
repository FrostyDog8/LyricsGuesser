const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'songs-by-year.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const seen = new Set();
const years = Object.keys(data).sort((a, b) => Number(a) - Number(b));

for (const year of years) {
  const list = data[year];
  const kept = [];
  for (const s of list) {
    const key = (s.title + '|' + (s.artist || '')).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(s);
  }
  data[year] = kept;
}

fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
console.log('Deduplication complete. Each song kept only in earliest year.');
