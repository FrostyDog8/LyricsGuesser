/**
 * One-off script: fetch Last.fm chart, apply same filters as the game,
 * print eligible songs (title | artist) sorted by playcount (popularity).
 * Run: node list-eligible-songs.js
 */

const LASTFM_API_KEY = '072e57491a78cfaf62abffd5bf5429a4';
const POPULARITY_MIN_PLAYCOUNT = 20000000;
const CHART_PAGE_SIZE = 500;

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

function normalizeForLangCheck(word) {
    return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

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

function isLikelyEnglish(text) {
    if (!text || typeof text !== 'string') return true;
    if (/ñ|¿|¡/i.test(text)) return false;
    const nonLatin = /[\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u1100-\u11FF\u0E00-\u0E7F\u0370-\u03FF]/;
    if (nonLatin.test(text)) return false;
    if (countSpanishWords(text) >= 5) return false;
    return true;
}

function isOriginalVersion(trackName) {
    const nonOriginalKeywords = [
        'live', 'acoustic', 'remix', 'cover', 'version', 'unplugged', 'studio', 'session',
        'demo', 'instrumental', 'karaoke', 'extended', 'radio edit', 'explicit', 'clean'
    ];
    const lowerTitle = (trackName || '').toLowerCase();
    for (const keyword of nonOriginalKeywords) {
        if (new RegExp(`\\b${keyword}\\b`, 'i').test(lowerTitle)) return false;
    }
    return true;
}

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
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetch(proxyUrl);
        if (res.ok) break;
        if ((res.status === 500 || res.status === 502 || res.status === 503) && attempt < 3) {
            process.stderr.write(`  Retry ${attempt}/3 in 2s...\n`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
        }
        throw new Error(`Last.fm chart HTTP ${res.status}`);
    }
    const proxy = await res.json();
    const raw = proxy.contents;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data.error) throw new Error(data.message || 'Last.fm API error');
    return data?.tracks?.track ?? [];
}

async function main() {
    const out = [];
    const seen = new Set();
    let hadError = false;
    for (let page = 1; page <= 5; page++) {
        process.stderr.write(`Fetching Last.fm chart page ${page}...\n`);
        let tracks;
        try {
            tracks = await fetchLastFmChartPage(page);
        } catch (e) {
            process.stderr.write(`  Skip page ${page}: ${e.message}\n`);
            hadError = true;
            continue;
        }
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
            out.push({ title, artist, playcount });
        }
    }
    out.sort((a, b) => b.playcount - a.playcount);
    process.stderr.write(`Eligible songs: ${out.length}${hadError ? ' (partial - some pages failed)' : ''}\n\n`);
    console.log('playcount\ttitle\tartist');
    for (const s of out) {
        console.log(`${s.playcount}\t${s.title}\t${s.artist}`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
