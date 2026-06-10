// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
//
// Your Firebase Database URL is loaded from the .env file at build time
// (e.g. via Vite, Parcel, or webpack) using the env variable:
//
//   FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
//
// For plain HTML/JS (no bundler), paste your URL in the string below.
// NEVER commit a real URL here if this file is public — keep it in .env instead.
//
// If you're using Vite:  const FIREBASE_DATABASE_URL = import.meta.env.VITE_FIREBASE_DATABASE_URL;
// If you're using CRA:   const FIREBASE_DATABASE_URL = process.env.REACT_APP_FIREBASE_DATABASE_URL;
// ─────────────────────────────────────────────────────────────────────────────

// const FIREBASE_DATABASE_URL = typeof __FIREBASE_URL__ !== 'undefined'
//   ? __FIREBASE_URL__                               // injected by a bundler
//   : import.meta.env.FIREBASE_DATABASE_URL;             // fallback: paste URL here for plain HTML use

const FIREBASE_DATABASE_URL = 'https://bingogamemd-default-rtdb.firebaseio.com/'