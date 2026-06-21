# SunTerrace

Find Helsinki terraces with direct sunlight right now.

**Live app → https://gavinhaggis.github.io/sunterrace/**

---

> ⚠️ **Fair warning:** this app was largely vibecoded. The sunlight predictions are based on precomputed building obstruction data and solar position calculations -- they're a reasonable approximation, not a guarantee. Treat it as a helpful nudge, not a promise of sunshine.

## What it does

- Shows ~2800 Helsinki-area bars, cafés, restaurants and pubs on a map
- Colour-codes each venue by current sunlight status (sunny / blocked / below horizon)
- Lets you filter by venue type, city district, "sunny now", or proximity to your location
- Displays a daily sun timeline and obstruction diagram for any selected venue
- Works fully client-side — no backend, no API key required

## Stack

React 19 + TypeScript + Vite, MapLibre GL JS, OpenFreeMap tiles, SunCalc, precomputed OSM building data.
