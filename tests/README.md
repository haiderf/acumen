# Acumen tests

Acumen is deliberately a single file with no build step, so the tests sit
*beside* it rather than inside it: they load `Acumen_v3.7.html` into
[jsdom](https://github.com/jsdom/jsdom) and exercise the real application —
the same bytes a user opens in Chrome.

```bash
cd tests
npm install
npm test
```

## What is covered

**`test-logic.js`** — the parts whose silent misbehaviour would corrupt a cull
without anyone noticing:

| Area | Checks |
| --- | --- |
| DOM wiring | every inline `onclick`/`onchange` resolves to a real function; every `getElementById` target exists; every wiki and help link resolves |
| Escaping | `esc()` behaviour, plus end-to-end proof that a malicious **filename** or **model-supplied genre** cannot inject markup into the grid, and that the log renders text rather than HTML |
| Scoring maths | star thresholds at every boundary, geometric mean (including that 8/8/8/8/2 scores *below* its arithmetic mean), genre normalisation of `"Still Life"` / `"street/documentary"` / unknown values |
| CSV safety | quote doubling, and neutralisation of spreadsheet formula injection (`=`, `+`, `-`, `@`) |
| Perceptual hashing | Hamming distance including the sign bit, and a randomised **pigeonhole proof** that the 16-band index never misses a pair within the maximum threshold of 14 bits |
| Duplicate detection | near-duplicates grouped, largest kept as leader, and re-ranking by AI score once scores exist |
| Response parsing | structured, JSON, `x/10` and bare-number fallbacks; score clamping; clean failure |
| Blind-model guard | the "please provide an image" signature is caught and a normal verdict is not |
| XMP injection | EXIF preserved byte-for-byte, stale XMP removed, exactly one namespace marker, **scan data (pixels) untouched**, non-JPEG rejected, XML escaping |
| Persistence | the API key is stripped from exported settings; every enrichment field survives serialisation |
| Selection | top-N by score, star assignment, target clamped to the eligible count, no `NaN` average when nothing is scored |
| Concurrency | the worker pool runs requests concurrently and one slow image does not serialise the run |
| Retry policy | transient 5xx retried, auth failures *not* retried |
| Margin refinement | median-of-3 resists a single aberrant reading |

**`test-ui.js`** — a smoke test that renders every tab, all 19 wiki sections and
all 6 help topics, round-trips the theme, switches every AI provider, and calls
every toolbar action against an **empty library** to prove none of them throw.

## Notes

- Canvas is stubbed: jsdom has no 2D context, and the import/analysis path that
  needs one is not driven by these tests.
- Top-level `const` in a classic script lives in the global *lexical*
  environment rather than on `window`, so the harness reaches `STATE`,
  `PROGRESS3D` and friends through `window.eval`.
- The 3D panel and the network providers are not exercised directly; both are
  wrapped in guards such that failure cannot affect scoring, and the provider
  layer is tested through injected stubs.
