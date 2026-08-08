# Acumen v3.7 — Release Notes

From cull to album. v3.2 decided *which* photographs survive; v3.7 adds the
layer that turns a surviving selection into something finished — captioned,
narrated, verified, and ready for an album designer or a competition entry —
and hardens the engine underneath it.

## From cull to album

- **Captions & keywords** for every selected image. The vision model names a
  landmark only when confident, cross-checked against the photo's EXIF GPS
  reverse-geocoded through OpenStreetMap Nominatim (opt-in; rounded
  coordinates only, never the image). People are always described, never
  identified — a deliberate privacy line enforced in the prompt.
- **Album narrative** — ~500 words woven from the real places, dates and
  captions in the selection plus the context you supply. Anti-hallucination
  rules are baked into the prompt; the result is editable, and your edits are
  what export.
- **Suggest Titles** — five candidates grounded in the collection. The adopted
  title leads the PDF cover, names the album package folder, and heads
  `_album_narrative.txt`.
- **Draft Entries** — a competition entry title, a standard category and a
  ~70-word artist statement per image, built strictly from that image's own
  caption, juror's note, place and date.
- **📕 Album Package** — the selection renamed `001_`, `002_`… in
  **capture-time order** so folder-drop album designers lay out spreads in
  story order. Captions, entry titles, keywords and places are embedded in
  each JPEG as a standard **XMP packet** (`dc:description`, `dc:title`,
  `dc:subject`, `photoshop:City/State/Country`) by a pure byte-level APP1
  splice — EXIF and pixel data are never touched, and any pre-existing XMP is
  removed so no reader sees stale metadata. Ships with `cover.txt`, a
  page-ordered `captions.csv`, and an import README.

## Archetype Affinity (CLIP)

An optional second opinion from a completely different model family: CLIP
embeds each image and all fifteen genre archetype descriptions into one shared
space and reports the affinity for the assigned genre. Agreement with the LLM
judge is meaningful corroboration; disagreement is a flag worth a human look,
not a verdict. Runs entirely in your browser via transformers.js — the one-time
~90 MB weight download is cached and images never leave your machine. Math in
Wiki → Math & Formulas §11.

## Live 3D progress

Scoring and affinity render as a live 3D scene in which **position is the
data**: a card's height *is* its score, its lane *is* its genre, the brass line
*is* the 8.0 competition threshold, and in the CLIP view a card's distance from
an archetype node *is* (1 − affinity). Competition mode's Pass 4 draws the
selection cutoff as a plane and re-flies refined cards to their median-of-3
heights — the recount, animated. Fully isolated: no WebGL or a blocked CDN
simply hides the panel. On-screen cards are capped at 120 with textures
disposed on retirement, so long runs stay smooth and memory stays flat.

## Vision reliability

- **👁 Vision Test** — sends a generated red-circle image end to end and tells
  you whether the configured model can actually *see*, before you commit to an
  overnight batch. Reports the transport used and the Ollama version, and on
  failure gives an ordered remediation ladder.
- **Ollama transport fix.** Gemma 4-class unified-multimodal models only accept
  images via `/api/chat`; the legacy `/api/generate` `images` field is silently
  dropped for them, which is what made the model answer "please provide the
  photograph" while the request looked perfectly correct. Acumen now sends via
  `/api/chat` with an automatic `/api/generate` fallback for older builds.
- **Blind-model guard.** A text-only model used to skip an entire batch one
  image at a time. Three consecutive "no image received" replies now stop the
  run and point at the Vision Test.
- Default model is now **`gemma4:12b`** — the bare `gemma4` tag has been
  observed replying blind to images even on current builds.

## Correctness and security fixes

- **API keys are no longer written into saved project files.** A project can be
  shared with a collaborator without leaking a credential; the key stays in
  this browser's local storage only.
- **HTML injection closed.** Filenames and model output (genre, narrative,
  caption) reach the DOM through a single escaping choke point, and the
  activity log now renders text rather than parsing markup. A file named
  `a" onerror="…".jpg` previously executed.
- **Enrichment fields survive save/reload.** Manual save and autosave now share
  one serializer, so captions, keywords, places, competition entries and CLIP
  affinity can no longer be persisted by one path and dropped by the other.
- **Silent autosave failure is now surfaced.** Exceeding the browser's ~5–10 MB
  storage quota previously failed without a word — you could finish an 8-hour
  run believing progress was safe when nothing had been written. It now
  degrades to dropping thumbnails, and says so.
- **Copy to Folder actually works.** It filtered on a property that never
  existed (`i.selected` rather than `i.status === 'selected'`), so it always
  reported an empty selection.
- **Every written file is verified** — byte count *and* SHA-256 read back
  against the source, for both Copy to Folder and Album Package. An
  out-of-space destination stops the run instead of emitting one error per
  remaining file.
- **CSV exports are inert.** Values beginning `=`, `+`, `-` or `@` are prefixed
  so a caption or filename cannot execute as a formula in Excel or Sheets.
- **Genre normalisation.** `"Still Life"`, `"street/documentary"` and
  `"PORTRAIT"` now fold onto canonical keys, so rubric lookups, 3D lanes, PDF
  anchors and CLIP labels can no longer silently miss.
- Re-running duplicate detection after scoring now promotes the highest-scored
  frame in each group, which is what the UI and wiki always claimed.
- Fixed a `NaN` average in the Auto-Select log, an unclamped target spinner,
  a leaked window listener in the 3D panel, an invisible log dot colour, and
  manual star ratings that were neither undoable nor reflected in the stats.

## Efficiency

- **Continuous worker pool for scoring.** Batches were awaited with
  `Promise.all`, so every batch cost as much as its slowest image — against a
  180-second timeout that is a great deal of idle capacity. Workers now pull
  the next image the moment their own request finishes.
- **Bounded retry with exponential backoff and jitter** on transient failures
  (429/5xx/network). Auth failures and timeouts are deliberately *not* retried.
- **Duplicate detection is banded.** A 16-band index over the 64-bit pHash
  prunes the candidate set before pairwise comparison. By the pigeonhole
  principle any pair within the maximum threshold of 14 bits must share a band,
  so the result is identical to the previous brute-force scan — just far less
  of it.
- Import no longer does an O(n²) `indexOf` per image (~6M scans at 3,500
  files); a Map makes it linear.

## Documentation

- Three new wiki sections: **Captions & Narrative**, **3D Progress**, and
  **Album Package**, each including an honest account of what leaves your
  machine and what a given claim does and does not guarantee.
- Corrected the standing inconsistencies: Competition mode is documented as
  four passes everywhere, the model tag is `gemma4:12b` throughout, the
  architecture diagram names the function that actually runs, and the retired
  export buttons are gone from the tables.
- The PDF report is now a designed artifact: cover (leading with the adopted
  album title), the album narrative, an explicit methodology page, per-image
  cards with criterion bars and the juror's note, and a competition-entries
  appendix — the appendix the tooltips had been promising.

## Tests

A jsdom harness now loads this exact file and exercises it — 187 assertions
across escaping, scoring maths, pHash banding, duplicate grouping, response
parsing, XMP injection (including EXIF preservation and pixel integrity),
persistence, selection maths, retry policy, the worker pool and margin
refinement, plus a UI smoke test over every tab, wiki section and help topic.
See `tests/`.

## Suggested repo topics

photography · photo-culling · single-file · local-first · privacy ·
ollama · ai · clip · xmp · image-processing

---

## v3.2 — first public release

Master-anchored genre scoring across 15 genres with an anti-mimicry guard;
four-pass Competition mode (describe+classify, criterion scoring by geometric
mean, temporal dedup, margin refinement); one-click Copy to Folder with
manifest CSV; the built-in wiki defining every formula; 3D glassmorphic design
system, brand orb, mobile bottom nav and tap-friendly tooltips.
