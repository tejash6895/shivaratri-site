# REDFLAGS.md — Ship Readiness Audit (Static Hostinger MVP)

Audit scope: `/Users/tejash/Desktop/shivaratri-site` as provided before fixes.

## Hostinger Deployment Risks

| ID | Severity | Location | Risk | Fix |
|---|---|---|---|---|
| H-01 | MED | `/Users/tejash/Desktop/shivaratri-site/index.html:47` | Google Fonts are remote-only; first load offline/blocked networks can delay custom typography. | Keep fallback font stacks and document that remote fonts are optional. |
| H-02 | LOW | `/Users/tejash/Desktop/shivaratri-site/index.html:42` | `assets/og-image.png` is referenced but optional; missing file causes 404 noise in crawlers/devtools. | Keep optional, document as non-blocking asset in deployment guide. |
| H-03 | MED | `/Users/tejash/Desktop/shivaratri-site/app.js:719` | Certificate PDF depends on CDN jsPDF runtime; blocked CDN/offline can fail if fallback path is not robust. | Keep lazy-load jsPDF and harden fallback to guaranteed `window.print()` flow. |
| H-04 | LOW | `/Users/tejash/Desktop/shivaratri-site/index.html:51` | Relative asset paths assume files are uploaded together in `public_html` root; misplaced uploads break CSS/JS. | Add explicit upload tree and quick post-upload checks in deployment guide. |

## Mobile Safari Risks

| ID | Severity | Location | Risk | Fix |
|---|---|---|---|---|
| M-01 | HIGH | `/Users/tejash/Desktop/shivaratri-site/app.js:35` | Sound defaults to enabled; iOS autoplay policy blocks non-gesture playback and may create inconsistent behavior. | Make audio opt-in by default and only attempt playback after user interaction. |
| M-02 | MED | `/Users/tejash/Desktop/shivaratri-site/app.js:947` | `scrollIntoView({block:"start"})` with fixed header can hide section headings under the header. | Use header-offset scrolling and `scroll-margin-top` for section anchors. |
| M-03 | LOW | `/Users/tejash/Desktop/shivaratri-site/styles.css:165` | `backdrop-filter` on fixed header can be expensive on older iPhones. | Add solid-color fallback and avoid relying on blur for readability. |
| M-04 | MED | `/Users/tejash/Desktop/shivaratri-site/app.js:532` | 250ms timer loops increase battery/CPU usage on mobile. | Move to 1000ms intervals while preserving elapsed-time accuracy. |

## Security Risks

| ID | Severity | Location | Risk | Fix |
|---|---|---|---|---|
| S-01 | HIGH | `/Users/tejash/Desktop/shivaratri-site/app.js:832` | `TELEGRAM_LINK` is assigned directly to `href`; a malformed `javascript:` value could create an injection vector. | Validate URL protocol (`https:` only) before assigning to DOM. |
| S-02 | MED | `/Users/tejash/Desktop/shivaratri-site/app.js:721` | Third-party script loads dynamically without integrity pinning; CDN compromise risk. | Keep pinned version and add robust fallback path with user-visible notice when unavailable. |
| S-03 | LOW | `/Users/tejash/Desktop/shivaratri-site/app.js:160` | `innerHTML` is used for container clearing; currently safe because no user HTML injection, but still a risky primitive. | Prefer DOM node replacement APIs where practical; keep user input on `textContent`. |

## Performance Risks

| ID | Severity | Location | Risk | Fix |
|---|---|---|---|---|
| P-01 | MED | `/Users/tejash/Desktop/shivaratri-site/app.js:97` | Audio files are preloaded on init even when user never enables sound. | Lazy-load audio only when sound is toggled on. |
| P-02 | MED | `/Users/tejash/Desktop/shivaratri-site/app.js:536` | State save condition can fire repeatedly within the same second (`250ms` loop), causing excessive localStorage writes. | Debounce persistence by second and write at controlled intervals. |
| P-03 | LOW | `/Users/tejash/Desktop/shivaratri-site/styles.css:242` | Always-on particle animation adds continuous paint/composite work. | Keep reduced-motion guard and tune particle count/duration conservatively. |

## Reliability Risks

| ID | Severity | Location | Risk | Fix |
|---|---|---|---|---|
| R-01 | HIGH | `/Users/tejash/Desktop/shivaratri-site/app.js:55` | Parsed localStorage data is merged with limited schema validation; corrupted types can create unstable state. | Add strict schema sanitizer and fallback defaults for all fields. |
| R-02 | MED | `/Users/tejash/Desktop/shivaratri-site/app.js:942` | Storage failures only log to console; users may not realize progress cannot persist in private mode. | Add visible in-app banner when storage is unavailable. |
| R-03 | MED | `/Users/tejash/Desktop/shivaratri-site/app.js:719` | Repeated certificate attempts can append multiple jsPDF scripts if CDN is slow/blocked. | Add single-flight loader with timeout and callback queue. |
| R-04 | LOW | `/Users/tejash/Desktop/shivaratri-site/app.js:417` | Some DOM nodes are dereferenced without null checks; future markup edits could break runtime. | Add defensive null checks for optional/non-critical nodes. |
