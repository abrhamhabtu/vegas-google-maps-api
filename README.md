# Las Vegas Strip — Google Maps Digital Twin & AV Simulation Testbed

A carbon-copy Google Maps Platform environment focused on the **Las Vegas Strip and surrounding Las Vegas Valley**, built as the foundation for running **autonomous / self-driving vehicle (AV) simulations** along S Las Vegas Blvd and connecting corridors.

## Features

- **Las Vegas Strip & Valley Map**:
  - 2D Road, Satellite/Hybrid, Live Traffic Layer, and Street View.
  - Photorealistic 3D Maps (`gmp-map-3d` / Google Maps 3D Tiles) toggle for 3D buildings across the Strip.
  - Quick-jump camera presets for key Strip intersections and venues (Welcome Sign, Mandalay Bay, Allegiant Stadium, MGM Grand, Bellagio, Caesars Palace, The Sphere & Venetian, Wynn, Fremont Street, and Harry Reid International Airport).
  - Places Autocomplete search bounded to the Las Vegas Valley.
- **Autonomous Vehicle (AV) Corridor Simulation Foundation**:
  - Snaps routes to real Las Vegas Strip road geometry via Google Maps Directions / Routes API.
  - Simulates an ego autonomous vehicle with live telemetry (speed, heading, latitude/longitude, route progress) and chase camera lock.

## Setup & API Key Security

Your Google Maps API key is kept out of Git history via `.gitignore` (`.env` and `config.local.js` are ignored):

1. Copy `config.example.js` to `config.local.js`:
   ```bash
   cp config.example.js config.local.js
   ```
2. Add your Google Maps Platform API key in `config.local.js` (or enter it in the in-app **API Key** modal, which stores it in `localStorage`).
3. Start the local server:
   ```bash
   npm start
   # or: python3 -m http.server 8080
   ```
4. Open `http://localhost:8080` in your browser.
