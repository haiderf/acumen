<p align="center">
  <img src="assets/social-acumen.svg" alt="Acumen — AI photo culling, judged by the masters" width="100%">
</p>

# Acumen — AI-First Photo Culling

One HTML file that culls thousands of photographs down to a competition-worthy
selection — with the AI judging each image against the mastery standard of its
genre. A landscape is measured against Ansel Adams' tonal command; a street
photo against Cartier-Bresson's decisive moment; a portrait against Karsh and
McCurry; a still life against Weston's *Pepper No. 30*. Fifteen genres, each
with its own legend-anchored rubric — and an explicit anti-mimicry guard so the
AI rewards principles, never black-and-white nostalgia or imitation of a
famous look.

> ▶ **Try it live:** https://haiderf.github.io/acumen/Acumen_v3.7.html
> Or download `Acumen_v3.7.html`, open it in Chrome/Edge, and point it at a folder.

## How it works

```
Import folder  →  Pre-filter (broken files only)  →  Perceptual dedup (pHash + Bhattacharyya)
→  AI genre classification + master-anchored scoring  →  Auto-select top N
→  Enrich (captions · narrative · entries · CLIP)  →  Verified copy / album package
```

### Two scoring modes

| Mode | Passes | Use for |
| --- | --- | --- |
| **Quick** | 1 — combined classify + score | Triage of 1,500+ images |
| **Competition** | 4 — describe+classify → criterion scoring (geometric mean) → temporal dedup → margin refinement (median-of-3 at the selection cutoff) | Final competition / portfolio selection |

The four-pass competition mode mirrors how juries actually work: scores are
combined by geometric mean (a fatal flaw can't be bought back by strengths
elsewhere), and images near the top-N cutoff are re-scored twice more with the
median of three kept — because AI scoring noise only matters at the
decision boundary.

## From cull to album

Scoring picks the images. v3.7 adds the layer that turns a selection into a
finished thing:

- **Captions & keywords** — the vision model names a landmark only when it is
  confident, cross-checked against your photo's GPS reverse-geocoded through
  OpenStreetMap. People are described, never identified.
- **Album narrative** — a ~500-word opening piece woven from the real places,
  dates and captions in your selection, editable before it exports.
- **Album titles** — five candidates grounded in the collection; adopt one and
  it leads the PDF cover and names the album package.
- **Competition entries** — an entry title, a standard category and a ~70-word
  artist statement per image, drafted from that image's own caption and
  juror's note.
- **Archetype affinity (CLIP)** — a second opinion from a different model
  family on how strongly each image matches its genre's visual archetype.
  Runs entirely in your browser. Disagreement is a flag, not a verdict.

## Live 3D progress

Scoring and affinity render as a live 3D scene where **position is the data**:
a card's height *is* its score, its lane *is* its genre, and in the CLIP view
its distance from an archetype node *is* (1 − affinity). You watch the
competition ridge form above the mediocre plain in real time. It is fully
isolated — no WebGL or a blocked CDN simply hides the panel and processing
continues untouched — and can be switched off entirely in Settings.

## Nothing is a black box

Every formula is defined and explained in the built-in wiki: the DCT-II
perceptual hash construction, Hamming-distance thresholds, the Bhattacharyya
coefficient used for color confirmation, the AM–GM argument for the geometric
mean, star-rating thresholds, the statistical case for margin refinement,
SHA-256 copy verification, and the CLIP cosine/softmax affinity. The full
genre-to-master crosswalk — anchor, epitome work, and distilled principle for
all fifteen genres — is documented in Wiki → Master-Anchored Scoring.

## Privacy

Runs entirely in your browser from a single file. No server, no account, no telemetry.
With Ollama (local, recommended — a gemma-class vision model), no image ever leaves your machine.
Cloud providers (Groq, Gemini, OpenAI) are optional, bring-your-own-key.

**External resources, disclosed honestly.** The file loads the Inter typeface
from Google Fonts and the jsPDF library from cdnjs at startup, and contacts the
AI endpoint you configure. Three further calls happen **only if you ask for
them**: Three.js from cdnjs (live 3D panel), OpenStreetMap Nominatim (place
lookup — rounded coordinates only, never the image), and transformers.js +
CLIP weights from jsdelivr/huggingface (archetype affinity, cached and then run
locally). That is the complete list.

Your API key is stored in this browser only and is **deliberately excluded**
from exported project files, so a project can be shared without leaking a
credential.

## Export

- **📂 Copy to Folder** — copies the culled selection into a timestamped
  subfolder directly under your source folder. Every file is verified
  byte-for-byte (size + SHA-256) after writing, and a
  `_acumen_manifest.csv` carrying every image's score, genre, criterion values,
  narrative, caption and place travels with the photos.
- **📕 Album Package** — the same selection renamed `001_`, `002_`… in
  **capture-time order** so folder-drop album designers lay out spreads in story
  order, with captions/titles/keywords/places embedded in each JPEG as standard
  XMP metadata (EXIF and pixels untouched), plus `cover.txt`, a page-ordered
  `captions.csv`, and an import README.
- **📄 PDF report** — a designed selection report: cover, the album narrative,
  an explicit methodology page, one card per image with thumbnail, score,
  criterion bars and the juror's note, and a competition-entries appendix.
- **📊 CSV** — every field, for spreadsheet analysis.

Chrome/Edge use the File System Access API for direct writes; other browsers
fall back to a generated `.bat` copy script.

## Requirements

- Chrome or Edge recommended (File System Access API for direct copy)
- For local AI: Ollama with a vision-capable model. **Use `gemma4:12b`** — the
  bare `gemma4` tag has been observed replying blind to images even on current
  builds. Run the built-in **👁 Vision Test** before any large batch; it sends a
  generated red-circle image end to end and tells you whether the model can
  actually see.

## Testing

The pure logic is covered by a jsdom harness that loads this exact file and
exercises it — escaping, star thresholds, genre normalisation, CSV safety,
pHash banding, duplicate grouping, response parsing, XMP injection (including
EXIF preservation and pixel integrity), persistence, selection maths, retry
policy, the scoring worker pool, and margin refinement — plus a UI smoke test
that renders every tab, wiki section and help topic. See
[`tests/`](tests/) for how to run it.

## Part of the Sovereign Apps family

Built on the same architecture as Rosetta HTM™ and Retirement Operating
System™: single file, no build step, local-first data, AI provider
neutrality, documentation as a first-class artifact.

<p align="center">
  <sub><i>one file · no server · your data · your AI</i></sub>
</p>
