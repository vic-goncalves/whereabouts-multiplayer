# Whereabouts

A GeoGuessr-style geography game. You're dropped somewhere in Google Street View with no road names or address; look around, then pin where you think you are.

Fully static: no backend, no accounts. Settings and personal bests live in your browser's localStorage, and challenge links carry the whole game in the URL.

## Features

- Classic: 5 rounds, up to 5,000 points each (`5000 * e^(-10 * distance / mapSize)`, full marks within 25 m)
- Country Streak: name the country until you get one wrong
- Moving, No Move and NMPZ (no moving, panning or zooming)
- Round timer (10 s to 5 min, or none); time running out submits your pin as is
- Compass, return to start (R), undo move (Z), checkpoint (C), zoom; Space to guess / continue
- Guess map with no labels, hover-to-expand, adjustable size and pin-open
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

## Data

Country borders: [Natural Earth](https://www.naturalearthdata.com/) 1:50m admin-0 (public domain), simplified into `public/countries.json` by `scripts/build-countries.mjs`.

Not affiliated with GeoGuessr. Street View imagery © Google.
