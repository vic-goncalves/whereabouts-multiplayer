# Whereabouts: multiplayer

A GeoGuessr-style geography game with live party mode. You're dropped somewhere in Google Street View with no road names or address; look around, then pin where you think you are.

Fork of [vic-goncalves/whereabouts](https://github.com/vic-goncalves/whereabouts) (solo only, fully static). This version adds a small Cloudflare Worker so friends can play the same rounds together.

## Party mode

1. Enter your name and hit **Create party**. Share the 4-letter code or the invite link.
2. Friends open the link (or type the code), enter a name, and join the lobby.
3. The host picks the map, movement, round time and number of rounds, then starts.
4. Everyone gets the same location at the same moment. When everyone has locked in, or the timer runs out, the round ends and the map shows every player's pin with a leaderboard.
5. After the last round: final standings, and the host can start another game with the same group.

Each party is a [Durable Object](https://developers.cloudflare.com/durable-objects/) keyed by its code (`party/worker.ts`). It keeps the room in its own storage while the party is going and deletes itself 10 minutes after the last player leaves; nothing else is stored. The game rules live in `src/party/room.ts`, separate from Cloudflare APIs, and are unit tested. The host's browser picks the locations (it already has Street View loaded); the server reveals them one round at a time and does the scoring.

Settings and personal bests for solo play live in your browser's localStorage, and solo challenge links carry the whole game in the URL.

## Features

- Classic: 5 rounds, up to 5,000 points each (`5000 * e^(-10 * distance / mapSize)`, full marks within 25 m)
- Country Streak: name the country until you get one wrong
- Moving, No Move and NMPZ (no moving, panning or zooming)
- Round timer (10 s to 5 min, or none); time running out submits your pin as is
- Compass, return to start (R), undo move (Z), checkpoint (C), zoom; Space to guess / continue
- Labeled guess map with hover-to-expand, adjustable size and pin-open (the panorama itself shows no road names or address)
- Round results and end-of-game summary maps; click the flag to open the spot in Google Maps
- Challenge links: send a friend the exact same 5 locations
- Maps: World, Famous Places, Europe, United States, Latin America, Asia, Japan, Africa, Australia & NZ
- Works on phones (tap the map button to guess)

## How locations are picked

Each map is a weighted list of countries with official Street View coverage. A round picks a country, picks a uniformly random point inside it (Natural Earth borders), and asks Street View for the nearest official, outdoor panorama within 50 km. Photospheres, dead ends and panoramas that snapped across a regional map's border are skipped. The next round is searched for while you play the current one.

## Running locally

```sh
npm install
cp .env.example .env.local   # then fill in VITE_GOOGLE_MAPS_API_KEY
npm run party:dev            # party server on ws://localhost:8787 (see .env.development)
npm run dev
npm test
```

## Google Maps API key

1. In Google Cloud, create a project with billing enabled and enable the **Maps JavaScript API**.
2. Create an API key and restrict it:
   - Application restriction: websites, e.g. `https://<you>.github.io/*` and `http://localhost:5173/*`
   - API restriction: Maps JavaScript API only
3. Cap usage under APIs & Services -> Maps JavaScript API -> Quotas, so a traffic spike fails closed instead of billing you. Dynamic Street View has 5,000 free loads a month (about 160 a day).

The app creates one Street View panorama and one map per page load and reuses them across rounds, which keeps it to roughly one billable load of each per visit.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Add the key as a repository secret named `GOOGLE_MAPS_API_KEY`, and set Pages to deploy from GitHub Actions.

The party server deploys separately: `npx wrangler login` once, then `npm run party:deploy`. Its URL goes in `.env.production` as `VITE_PARTY_URL`, and the site's origin must be listed in `ALLOWED_ORIGINS` in `party/wrangler.jsonc`. It runs on the Workers free plan; if the free daily limits are ever hit, parties stop working until 00:00 UTC rather than costing anything.

## Data

Country borders: [Natural Earth](https://www.naturalearthdata.com/) 1:50m admin-0 (public domain), simplified into `public/countries.json` by `scripts/build-countries.mjs`.

Not affiliated with GeoGuessr. Street View imagery © Google.
