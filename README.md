# F1TrackTelemetry

This repository contains the F1TrackTelemetry React app (Vite + React + TypeScript).

Quick commands:

```powershell
cd "d:\personal projects\f1demonstration"
npm install
npm run dev
```

Build:

```powershell
npm run build
npm run preview
```

Deploy to GitHub Pages

1. Install the deploy helper:

```powershell
npm install --save-dev gh-pages
```

2. Build and deploy (these scripts are already added to `package.json`):

```powershell
npm run build
npm run deploy
```

Notes:
- The Vite `base` is set to `/f1demonstration/` in `vite.config.ts`. If you host the site under a different repository name or as a user/organization site, update the `base` value accordingly.
- `deploy` pushes the `dist` folder to the `gh-pages` branch and GitHub Pages will serve it from `https://<your-username>.github.io/f1demonstration/`.
