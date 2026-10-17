const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());

// ─── Konfiguracja źródeł ────────────────────────────────────────────────────
// Każde źródło ma bazowy URL i "token" wstawiany w ścieżkę (jeśli potrzebny).
// Możesz dodać/usunąć źródła tutaj – reszta kodu dostosuje się automatycznie.
const SOURCES = [
  {
    name: 'gglos',
    base: 'https://gglos.ggottes.deno.net',
    prefix: '',          // brak tokenu w ścieżce
  },
  {
    name: 'eljohnzc',
    base: 'https://eljohnzc-addon-v2-gyhs.onrender.com',
    prefix: '/01c63c0119b89d33db0b',
  },
  {
    name: 'qobuz',
    base: 'https://qobuz-addon.vercel.app',
    prefix: '',
  },
];

// ─── Priorytety jakości (wyższy = lepszy) ───────────────────────────────────
const QUALITY_RANK = {
  lossless:  100,
  flac:      100,
  hi_res:     90,
  hires:      90,
  '24bit':    90,
  high:       60,
  hq:         60,
  '320':      50,
  '256':      40,
  normal:     30,
  low:        20,
  '128':      10,
};

/**
 * Wyciąga ocenę jakości ze strumienia.
 * Szuka pola `quality`, `title`, `name`, `description` i `url`.
 */
function scoreStream(stream) {
  const haystack = [
    stream.quality,
    stream.title,
    stream.name,
    stream.description,
    stream.url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const [keyword, score] of Object.entries(QUALITY_RANK)) {
    if (haystack.includes(keyword)) return score;
  }
  return 5; // nieznana jakość – najniższy priorytet
}

/**
 * Odpytuje jedno źródło z timeoutem 8 s.
 * Zwraca tablicę streamów wzbogaconą o nazwę źródła lub [] przy błędzie.
 */
async function fetchFromSource(source, path) {
  const url = `${source.base}${source.prefix}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data = await res.json();
    const streams = data.streams || [];

    // Dodaj metadane źródła do każdego strumienia
    return streams.map(s => ({
      ...s,
      _source: source.name,
      _score: scoreStream(s),
    }));
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ─── Manifest ───────────────────────────────────────────────────────────────
const MANIFEST = {
  id: 'com.aggregator.music',
  name: 'Music Aggregator',
  version: '1.0.0',
  description:
    'Queries gglos, eljohnzc and Qobuz in parallel – returns the best quality stream.',
  resources: ['search', 'stream'],
  types: ['music', 'track', 'album', 'artist'],
  catalogs: [],
  idPrefixes: ['tt', 'yt', 'sc'],
  behaviorHints: { configurable: false },
};

app.get('/manifest.json', (_req, res) => res.json(MANIFEST));

// ─── Search ─────────────────────────────────────────────────────────────────
app.get('/search/:type/:query.json', async (req, res) => {
  const { type, query } = req.params;
  const path = `/search/${type}/${encodeURIComponent(query)}.json`;

  const results = await Promise.all(SOURCES.map(s => fetchFromSource(s, path)));
  const merged = results.flat();

  // Deduplikuj po id + zostaw egzemplarz z najwyższym score
  const best = {};
  for (const item of merged) {
    const key = item.id || item.url || JSON.stringify(item);
    if (!best[key] || item._score > best[key]._score) best[key] = item;
  }

  res.json({ results: Object.values(best) });
});

// ─── Stream ─────────────────────────────────────────────────────────────────
app.get('/stream/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const path = `/stream/${type}/${encodeURIComponent(id)}.json`;

  // Odpytaj wszystkie 3 jednocześnie
  const results = await Promise.all(SOURCES.map(s => fetchFromSource(s, path)));
  const all = results.flat();

  if (all.length === 0) {
    return res.json({ streams: [] });
  }

  // Posortuj malejąco po jakości
  all.sort((a, b) => b._score - a._score);

  // Opcja A – zwróć TYLKO najlepszy stream (czyste zachowanie)
  // const streams = [all[0]];

  // Opcja B – zwróć wszystkie, najlepszy pierwszy (użytkownik widzi alternatywy)
  const streams = all.map(({ _source, _score, ...rest }) => ({
    ...rest,
    title: rest.title
      ? `[${_source}] ${rest.title}`
      : `[${_source}] stream`,
  }));

  res.json({ streams });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`\n🎵  Music Aggregator Addon running`);
  console.log(`   Manifest : http://localhost:${PORT}/manifest.json`);
  console.log(`   Add to Stremio: stremio://localhost:${PORT}/manifest.json\n`);
});
