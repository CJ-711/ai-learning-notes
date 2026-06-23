# CJ Sport Lab Product Ad Workspace

This workspace is for rebuilding CJ Sport Lab product videos with real usable footage instead of synthetic canvas animation.

## Current Goal

Create a convincing 9:16 short-form product ad for Instagram Reels and TikTok.

Primary product direction:

- CJ Sport Lab compact grip trainer
- Angle: "Grip Strength Anywhere"
- Core idea: small daily training tool for office breaks, home workouts, warmups, and everyday athletes

## Folder Structure

```text
assets/
  brand/              Existing CJ Sport and CJ Sport Lab logos
  stock-video/        Licensed stock clips downloaded for editing
  generated-product/  Product renders or AI-generated CJ Sport Lab product images/videos
  audio/              Voiceover, music, and sound effects
docs/
  storyboard.md
  product-generation-prompts.md
  github-skills-evaluation.md
asset-manifest.csv
github-skills/
```

## Legal Boundary

Use only clearly licensed stock footage, generated product visuals, or owned footage.

Do not download random TikTok, Instagram, YouTube, Nike, adidas, Under Armour, Gymshark, or other brand videos and republish them with swapped product branding. That would create copyright, platform, and brand-risk problems.

## Current Footage Source

The first stock video batch uses Mixkit clips marked for free stock video use. Mixkit pages state the clips can be downloaded for commercial or personal use under the Mixkit Stock Video Free License. Keep source URLs in `asset-manifest.csv`.

The second stock video batch uses Coverr office/commute/backpack clips for the micro-use direction. Keep source URLs in `assets/stock-video/micro-use/micro-use-asset-manifest.csv`.

## Production Direction

HyperFrames should be used as the finishing layer:

- cut stock footage into fast 9:16 scenes
- crop and push in for mobile
- add product overlays or product close-ups
- add captions, voiceover, music, logo reveal, and CTA
- export review cuts

HyperFrames should not be expected to invent realistic human movement or product footage from scratch.

## Current Best Cuts

- `renders/cj-sport-lab-v11-real-use-brand-cut.mp4` is the current strongest
  brand-style product-use route. It removes the jitter-style product motion from
  v9-v10 and uses a clearer office break -> tool use -> pack/carry story.
- `renders/cj-sport-lab-v7-office-product-use.mp4` remains a useful office
  white-collar product-use route.
- `renders/cj-sport-lab-v8-commute-pocket-training.mp4` is the compact carry
  and commute route, with one product-use close-up added near the close.

The product-use keyframes for these cuts are stored under
`assets/generated-product/product-use/2026-06-23/`.
