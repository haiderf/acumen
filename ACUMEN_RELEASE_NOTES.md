# Acumen v3.2 — Release Notes

First public release.

## Master-anchored genre scoring
- 15 genres (added Group, StillLife, Abstract), each with a legend-anchored
  rubric: anchor photographer(s), epitome work, distilled principle
- Anti-mimicry guard in every prompt: principles, not style
- Two-stage design: combined classify+score on first pass; genre-specific
  short rubric on re-runs (better small-model instruction following)

## Four-pass Competition mode
- Pass 1: describe + classify · Pass 2: criterion scoring (geometric mean)
- Pass 3: temporal near-duplicate comparison
- Pass 4 (new): margin refinement — median-of-3 re-scoring for images
  within ±0.5 of the top-N cutoff

## One-click Copy to Folder
- Direct copy of the culled selection to any destination (File System
  Access API), timestamped subfolder, collision-safe naming,
  _acumen_manifest.csv with scores + narratives; .bat fallback

## Documentation & UI
- Wiki: Master-Anchored Scoring (full crosswalk), Math & Formulas (every
  formula defined: DCT pHash, Hamming, Bhattacharyya, geometric mean/AM-GM,
  margin refinement), Copy to Folder
- 3D glassmorphic design system, brand orb, mobile bottom nav,
  tap-friendly tooltips
- Removed a third-party CDN loader script left by the original scaffold;
  external loads are now exactly: Google Fonts (Inter), cdnjs (jsPDF),
  and the AI endpoint you configure

## Suggested repo topics
photography · photo-culling · single-file · local-first · privacy ·
ollama · ai · indexeddb · image-processing
