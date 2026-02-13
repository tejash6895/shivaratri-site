# TESTING.md

Run all checks on:
- iPhone Safari (latest available)
- Android Chrome
- Desktop Chrome/Safari

## 20 Manual MVP Tests

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | Fresh load | Open site with empty storage | Hero loads, counter `0/108`, Continue button hidden. |
| 2 | Storage-disabled warning | Open in private/incognito mode where storage may be blocked | Banner warns progress may not persist; app still usable. |
| 3 | Tap 108 beads (ordered) | Keep "Tap in order" enabled and tap 1-108 | Counter increments, milestones appear, mala complete overlay appears. |
| 4 | Wrong bead in ordered mode | Tap bead out of sequence | No progress on wrong bead; hint shows next required bead. |
| 5 | Random taps (unordered mode) | Turn off order mode and tap random beads | Any untapped bead can be marked; counter stays accurate. |
| 6 | Refresh mid-mala and resume | Tap ~50 beads, refresh, continue tapping | Previous progress restores correctly and resumes from saved state. |
| 7 | Cooldown behavior | Complete one mala | Continue button remains hidden until cooldown ends. |
| 8 | Complete 4 malas | Repeat until 4 malas complete | Prahar dots all completed; bead interactions disabled for completed flow. |
| 9 | Reflection flow | After mala completion, continue to reflection | Reflection card appears with prompt/meaning/source text. |
| 10 | Quiz attempt persistence | Answer at least 1 quiz question, refresh | Quiz completion requirement remains checked after refresh. |
| 11 | Timer start/pause | Start timer, wait 10s, pause | Countdown pauses correctly; start button resets to Start. |
| 12 | Timer reset | Start timer then hit reset | Timer returns to preset duration; meditation completion state clears. |
| 13 | Midnight stillness overlay | Temporarily set device time near midnight (test env) | Midnight overlay appears and 5-minute countdown works. |
| 14 | Reduced motion behavior | Enable OS "Reduce Motion" and reload | Heavy animations are minimized; interface remains functional. |
| 15 | iPhone audio restrictions | On iPhone Safari, do not enable sound and tap beads | No audio plays by default; no autoplay errors block flow. |
| 16 | Audio opt-in | Tap sound toggle ON, then tap beads | Audio plays only after user interaction and toggle opt-in. |
| 17 | Missing audio files | Remove/skip `assets/audio` files | App remains stable; no crash when sound is toggled. |
| 18 | Certificate unlock gate | Try certificate before requirements complete | Checklist remains visible and form stays hidden. |
| 19 | jsPDF primary path | Complete requirements, generate certificate online | PDF downloads successfully via jsPDF. |
| 20 | jsPDF blocked/offline fallback | Block CDN or go offline, then generate certificate | Print dialog opens via `window.print()` with printable certificate template. |

## Fast Smoke Run (2-3 minutes)
1. Tap 5 beads and refresh.
2. Scroll through all sections on mobile width.
3. Toggle sound on/off once.
4. Open certificate section and verify locked/unlocked behavior.
5. Use Reset All Progress and confirm state clears.
