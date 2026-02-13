# DEPLOY_HOSTINGER.md

## Scope
Static-only deployment for Hostinger **Single Web Hosting**.  
No Node.js runtime is required on the server.

## Files to Upload
Required:
- `index.html`
- `styles.css`
- `app.js`
- `REDFLAGS.md` (optional for team reference, not required by browser)
- `TESTING.md` (optional for team reference)

Optional assets:
- `assets/audio/tap.mp3`
- `assets/audio/bell.mp3`
- `assets/og-image.png`

External/optional runtime dependencies:
- Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
- jsPDF CDN (`cdnjs.cloudflare.com`) for primary PDF mode  
If jsPDF is blocked/offline, the app falls back to `window.print()`.

## Upload Steps (Hostinger hPanel)
1. Open [hpanel.hostinger.com](https://hpanel.hostinger.com) and select your hosting plan.
2. Go to **Files -> File Manager**.
3. Open `public_html`.
4. Delete old/default web files in `public_html` first:
   - default `index.html`
   - old app files from previous deployments (`app.js`, `styles.css`, stale `assets/` contents)
5. Upload the current project files directly into `public_html` (not inside a nested subfolder).
6. If using optional assets, create and upload:
   - `public_html/assets/audio/tap.mp3`
   - `public_html/assets/audio/bell.mp3`
   - `public_html/assets/og-image.png`

## Expected Hostinger Tree
```text
public_html/
├── index.html
├── styles.css
├── app.js
└── assets/                 (optional)
    ├── og-image.png        (optional)
    └── audio/              (optional)
        ├── tap.mp3
        └── bell.mp3
```

## Quick Post-Upload Test (2-3 Minutes)
1. Open `https://yourdomain.com`.
2. Confirm the hero and bead grid render.
3. Tap a few beads, refresh, and confirm progress persists (unless private mode).
4. Open certificate section and verify fallback messaging appears if jsPDF is blocked.
5. Confirm no fatal console errors in browser devtools.

## Domain Pointing (High-Level)
1. In Hostinger, open your site/domain panel and note required DNS targets (nameservers or A record).
2. At your registrar, point domain DNS to Hostinger values.
3. Wait for DNS propagation (can take up to 24-48 hours).
4. Enable SSL in Hostinger and force HTTPS after certificate issuance.

## Common Mistakes Checklist
- `index.html` uploaded into a subfolder instead of `public_html/`
- Wrong filename casing (`Index.html` vs `index.html`)
- Missing `styles.css` or `app.js`
- Old cached assets still served (hard-refresh after deploy)
- Audio expected but `assets/audio/` not uploaded (non-blocking)
- Assuming jsPDF always works online; fallback to print is expected when blocked
- Expecting backend/community APIs (Phase 2 only, not in MVP)

## Phase 2 (Disabled by Default for MVP)
- Supabase/community backend integration
- Realtime/shared community wall
- Any server-side API features
