# Dynamic Product-Use Video Notes

Date: 2026-06-24

## Goal

Improve the CJ Sport Lab product videos by making the AI-generated product-use
images feel less like static product cards and more like short-form social ad
footage. The focus is concrete usage: desk breaks, pocket carry, bag carry,
grip work, and finger extensor work.

## New Outputs

- `renders/cj-sport-lab-v9-desk-reset-dynamic.mp4`
- `renders/cj-sport-lab-v10-pocket-reps-dynamic.mp4`
- `renders/cj-sport-lab-v9-desk-reset-dynamic-contact-sheet.jpg`
- `renders/cj-sport-lab-v10-pocket-reps-dynamic-contact-sheet.jpg`

## Creative Direction

The new cuts avoid explaining the brand at length. They use short overseas
social hooks:

- "No gym window?"
- "Desk break reps"
- "From pocket to reps"
- "Pocket-size setup"
- "Grab. Squeeze. Go."
- "Move small. Train smart."

The intended positioning is practical, compact, and everyday-use oriented. The
product should feel like something a desk worker or commuter can use in small
gaps, not a generic sports montage.

## Voiceover

### v9 Desk Reset Dynamic

No gym window today? Good. Use the break you actually have. Between calls, hit a
clean squeeze set. Open the hand back up. Pick the next tool, pack it small, and
get back to the day. CJ Sport Lab is built for real schedules, desk breaks,
commute gaps, and simple reps that keep you moving. Move small. Train smart.

### v10 Pocket Reps Dynamic

Most people wait for the perfect workout. This is for the moments in between.
Walking out, waiting for a ride, sitting back at the desk. Pull out a compact
tool, get a few clean reps, put it back, and keep moving. CJ Sport Lab builds
small training gear for daily momentum. Pack it. Use it. Repeat it. Move small.
Train smart.

## Implementation Notes

The render script is:

`scripts/render-cj-sport-lab-dynamic-product-use-videos.js`

It generates 1080x1920 H.264 MP4s using FFmpeg and local Windows English TTS.
The dynamic product stills use simulated camera movement: push-ins, pull-outs,
micro shakes, squeeze pulses, border accents, and short neon beat flashes. This
does not claim to be real video footage; it is a more convincing draft edit
from available AI product keyframes.

## Quality Notes

v9 is currently the strongest direct product-use route because most scenes show
the product in office hand-use context. v10 is stronger than earlier commute
cuts because it now prioritizes product carry and usage instead of generic
transit mood shots.

For the next quality jump, generate true two-state or four-state product-use
motion stills: open grip, squeezed grip, release, pack away. Those can be cut
together as a more believable product action sequence.
