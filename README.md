# Music Aggregator Stremio Addon

Odpytuje **3 źródła równolegle** i zwraca najlepszą jakość.

## Źródła
| Nazwa | URL |
|-------|-----|
| gglos | https://gglos.ggottes.deno.net |
| eljohnzc | https://eljohnzc-addon-v2-gyhs.onrender.com/01c63c0119b89d33db0b |
| qobuz | https://qobuz-addon.vercel.app |

## Instalacja

```bash
cd addon
npm install
node index.js
```

Potem w Stremio wpisz:
```
http://localhost:7000/manifest.json
```

## Jak działa wybór jakości

Każdy zwrócony stream dostaje punktację na podstawie słów kluczowych
w polach `quality`, `title`, `description` i `url`:

| Słowo kluczowe | Punkty |
|----------------|--------|
| lossless / flac | 100 |
| hi_res / 24bit | 90 |
| high / hq / 320 | 50–60 |
| normal | 30 |
| low / 128 | 10–20 |

Streamy są posortowane – najlepsza jakość pojawia się jako pierwsza.
Etykieta `[gglos]`, `[eljohnzc]` itp. pokazuje z którego źródła pochodzi.

## Chcę tylko jeden stream (najlepszy)?

W `index.js` zamień:
```js
// Opcja B (domyślna) – wszystkie, najlepszy pierwszy
const streams = all.map(...)

// na Opcję A – tylko jeden:
const streams = [all[0]];
```

## Deployment (Render / Vercel / Deno Deploy)

Ustaw zmienną środowiskową `PORT` jeśli platforma tego wymaga.
Na **Render** wystarczy `npm start`.
