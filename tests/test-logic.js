/**
 * Acumen v3.7 test harness.
 * Loads the real single-file app into jsdom and exercises its logic.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = path.join(__dirname, '..', 'Acumen_v3.7.html');
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  ok(name, a === e, `got ${a}, expected ${e}`);
}

// ---------------------------------------------------------------- boot jsdom
const html = fs.readFileSync(FILE, 'utf8');
const vc = new VirtualConsole();
const consoleErrors = [];
vc.on('jsdomError', e => consoleErrors.push(e.message));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: 'https://example.test/'
});
const win = dom.window;

// Minimal stubs for APIs jsdom lacks. Canvas is only needed by import/analysis
// paths, which these tests do not drive.
win.HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillRect(){}, drawImage(){}, beginPath(){}, arc(){}, fill(){}, strokeRect(){},
    fillText(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}, set font(v){}, set textAlign(v){},
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
  };
};
win.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,' + 'A'.repeat(200);
if (!win.crypto) win.crypto = {};
if (!win.crypto.randomUUID) win.crypto.randomUUID = () => 'id-' + Math.random().toString(16).slice(2);

// Fire DOMContentLoaded init
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));


// Top-level `const`/`let` in a classic script live in the global LEXICAL
// environment, not on `window`. Reach them through eval in page context.
const G = name => win.eval(name);
const STATE = G('STATE');

ok('page loads without jsdom errors', consoleErrors.length === 0, consoleErrors.join(' | '));

// ------------------------------------------------- 1. DOM wiring / handlers
// Every inline handler must resolve to something callable. This is what
// catches a renamed or missing function before a user finds it.
const handlerRe = /\b(?:onclick|onchange|oninput)\s*=\s*"([^"]+)"/g;
// Only bare calls: a leading dot means it is a method on some object.
const identRe = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
const declared = new Set();
let m;
while ((m = handlerRe.exec(html))) {
  const code = m[1];
  let f;
  while ((f = identRe.exec(code))) declared.add(f[1]);
}
const jsBuiltins = new Set(['if','for','while','switch','catch','function','return','typeof','parseInt','parseFloat','String','Number','Boolean','Array','Object','Math','JSON','alert','confirm','prompt','isNaN','event']);
const missing = [];
for (const name of declared) {
  if (jsBuiltins.has(name)) continue;
  let resolved = typeof win[name] === 'function';
  if (!resolved) { try { resolved = typeof win.eval(name) === 'function' || typeof win.eval(name) === 'object'; } catch (e) { resolved = false; } }
  if (!resolved) missing.push(name);
}
ok('all inline handlers resolve to functions', missing.length === 0, 'missing: ' + missing.join(', '));

// PROGRESS3D method handlers used in markup
ok('PROGRESS3D exposes resetView/hide',
  typeof G('PROGRESS3D') === 'object' && typeof G('PROGRESS3D').resetView === 'function' && typeof G('PROGRESS3D').hide === 'function');

// Every getElementById target referenced in JS must exist in the markup.
const idRe = /getElementById\(['"]([^'"]+)['"]\)/g;
const missingIds = new Set();
let g;
while ((g = idRe.exec(html))) {
  const id = g[1];
  if (!win.document.getElementById(id)) missingIds.add(id);
}
ok('all getElementById targets exist in markup', missingIds.size === 0, [...missingIds].join(', '));

// Wiki sidebar links must map to real sections
const wikiLinks = [...html.matchAll(/showWikiSection\('([^']+)'\)/g)].map(x => x[1]);
const wikiMissing = wikiLinks.filter(k => !(k in G('WIKI_SECTIONS')));
ok('all wiki links resolve to sections', wikiMissing.length === 0, wikiMissing.join(', '));
const helpKeys = [...html.matchAll(/showHelp\('([^']+)'\)/g)].map(x => x[1]);
const helpMissing = helpKeys.filter(k => !(k in G('HELP_CONTENT')));
ok('all help links resolve to topics', helpMissing.length === 0, helpMissing.join(', '));

// ------------------------------------------------------- 2. escaping (XSS)
eq('esc escapes angle brackets', win.esc('<img src=x onerror=alert(1)>'),
   '&lt;img src=x onerror=alert(1)&gt;');
eq('esc escapes quotes and amp', win.esc(`a"b'c&d`), 'a&quot;b&#39;c&amp;d');
eq('esc handles null', win.esc(null), '');

// End-to-end: a malicious filename must not create an element in the grid.
STATE.images = [{
  id: 'x1', name: 'evil".jpg', path: 'evil.jpg', size: 100, width: 10, height: 10,
  thumbnail: 'data:image/jpeg;base64,AAA', exif: {}, aiScore: null, aiGenre: null,
  aiNarrative: null, aiCriteria: null, stars: 0, status: 'unrated', rejected: false,
  duplicate: false, duplicateGroup: null, duplicateRank: 0, category: 'General'
}];
STATE.images[0].name = '<img src=x onerror=window.__XSS__=1>';
win.renderGrid();
ok('renderGrid does not inject markup from filename',
   win.document.querySelector('#imageGrid img[onerror]') === null && win.__XSS__ === undefined);

// Model-supplied genre must not inject either
STATE.images[0].aiGenre = '<b id="pwned">x</b>';
STATE.images[0].aiScore = 7;
win.renderGrid();
ok('renderGrid does not inject markup from model genre',
   win.document.getElementById('pwned') === null);

// addLog must never parse markup
const logEl = win.document.getElementById('aiLog');
logEl.innerHTML = '';
win.addLog(logEl, 'green', '<b id="logpwn">boom</b>');
ok('addLog renders text, not markup', win.document.getElementById('logpwn') === null);
ok('addLog still shows the text', logEl.textContent.includes('<b id="logpwn">boom</b>'));

// ------------------------------------------------------- 3. scoring helpers
eq('starsFromScore 8.0 -> 5', win.starsFromScore(8.0), 5);
eq('starsFromScore 7.9 -> 4', win.starsFromScore(7.9), 4);
eq('starsFromScore 6.5 -> 4', win.starsFromScore(6.5), 4);
eq('starsFromScore 5.0 -> 3', win.starsFromScore(5.0), 3);
eq('starsFromScore 3.5 -> 2', win.starsFromScore(3.5), 2);
eq('starsFromScore 2.0 -> 1', win.starsFromScore(2.0), 1);
eq('starsFromScore 1.9 -> 0', win.starsFromScore(1.9), 0);
eq('starGlyphs 3', win.starGlyphs(3), '★★★☆☆');
eq('starGlyphs clamps', win.starGlyphs(9), '★★★★★');

eq('normalizeGenre exact', win.normalizeGenre('Landscape', 'General'), 'Landscape');
eq('normalizeGenre lowercase', win.normalizeGenre('portrait', 'General'), 'Portrait');
eq('normalizeGenre multiword', win.normalizeGenre('Still Life', 'General'), 'StillLife');
eq('normalizeGenre slashed', win.normalizeGenre('Street/Documentary', 'General'), 'Street');
eq('normalizeGenre unknown -> fallback', win.normalizeGenre('Sasquatch', 'General'), 'General');
eq('normalizeGenre empty -> fallback', win.normalizeGenre('', 'Portrait'), 'Portrait');

// ------------------------------------------------------- 4. CSV safety
eq('csvCell quotes plain', win.csvCell('hello'), '"hello"');
eq('csvCell doubles quotes', win.csvCell('say "hi"'), '"say ""hi"""');
eq('csvCell neutralises formula', win.csvCell('=cmd|calc'), `"'=cmd|calc"`);
eq('csvCell neutralises plus', win.csvCell('+1'), `"'+1"`);
eq('csvCell handles null', win.csvCell(null), '""');
ok('csvRows uses CRLF', win.csvRows([['a'],['b']]) === '"a"\r\n"b"');

// ------------------------------------------------------- 5. pHash / dedup
eq('hammingDistance identical', win.hammingDistance({h1:0,h2:0},{h1:0,h2:0}), 0);
eq('hammingDistance one bit', win.hammingDistance({h1:1,h2:0},{h1:0,h2:0}), 1);
eq('hammingDistance high bit (sign)', win.hammingDistance({h1:(1<<31),h2:0},{h1:0,h2:0}), 1);
eq('hammingDistance all bits', win.hammingDistance({h1:-1,h2:-1},{h1:0,h2:0}), 64);

// Band keys: 16 bands, and identical hashes share all of them.
const bk1 = win.pHashBandKeys({h1: 0x12345678, h2: -1});
const bk2 = win.pHashBandKeys({h1: 0x12345678, h2: -1});
eq('pHashBandKeys returns 16 bands', bk1.length, 16);
eq('identical hashes share all bands', bk1.join('|'), bk2.join('|'));

// Pigeonhole guarantee: any pair within distance 14 shares >=1 band.
function randHash() {
  return { h1: (Math.random()*2**32)|0, h2: (Math.random()*2**32)|0 };
}
function flipBits(h, n) {
  const out = { h1: h.h1, h2: h.h2 };
  const picks = new Set();
  while (picks.size < n) picks.add(Math.floor(Math.random()*64));
  for (const b of picks) {
    if (b < 32) out.h1 ^= (1 << b); else out.h2 ^= (1 << (b-32));
  }
  return out;
}
let pigeonholeOk = true;
for (let t = 0; t < 400; t++) {
  const a = randHash();
  const dist = 1 + Math.floor(Math.random()*14);   // 1..14
  const b = flipBits(a, dist);
  const A = new Set(win.pHashBandKeys(a));
  const shared = win.pHashBandKeys(b).some(k => A.has(k));
  if (!shared) { pigeonholeOk = false; break; }
}
ok('banded index never misses a pair within distance 14 (pigeonhole)', pigeonholeOk);

// Banded dedup must produce the SAME grouping as brute force.
function makeImg(i, h, size) {
  return {
    id: 'i'+i, name: 'f'+i+'.jpg', size, rejected: false, exif: {},
    pHash: h, colorHist: { r:new Float64Array(16).fill(1/16), g:new Float64Array(16).fill(1/16), b:new Float64Array(16).fill(1/16) },
    aiScore: null, duplicate: false, duplicateGroup: null, duplicateRank: 0
  };
}
const base = randHash();
const imgs = [
  makeImg(0, base, 500),
  makeImg(1, flipBits(base, 2), 400),          // near-duplicate
  makeImg(2, flipBits(base, 3), 300),          // near-duplicate
  makeImg(3, randHash(), 900)                  // unrelated (almost surely)
];
STATE.settings.dupSensitivity = 7;         // threshold 8 bits
const groups = win.findPerceptualDuplicates(imgs);
ok('dedup groups the near-duplicates', imgs[1].duplicate === true && imgs[2].duplicate === true);
ok('dedup keeps the largest as leader', imgs[0].duplicate === false && imgs[1].duplicateGroup === imgs[0].id);
eq('dedup reports one group', groups, 1);

// After AI scores exist, re-running promotes the best-scored frame.
imgs.forEach(i => { i.duplicate = false; i.duplicateGroup = null; i.duplicateRank = 0; });
imgs[0].aiScore = 4.0; imgs[1].aiScore = 9.0; imgs[2].aiScore = 5.0;
win.findPerceptualDuplicates(imgs);
ok('dedup re-ranks by AI score once scored',
   imgs[1].duplicate === false && imgs[0].duplicate === true,
   `leader=${imgs.find(i=>!i.duplicate && i.aiScore!=null)?.name}`);

// ------------------------------------------------------- 6. response parsing
let r = win.parseAIResponse('SCORE: 7.5\nGENRE: Landscape\nREASON: Nice light.', 'General');
ok('parseAIResponse structured', r.success && r.score === 7.5 && r.genre === 'Landscape' && /Nice light/.test(r.narrative));
r = win.parseAIResponse('SCORE: 99\nGENRE: Landscape\nREASON: x', 'General');
eq('parseAIResponse clamps high score', r.score, 10);
r = win.parseAIResponse('GENRE: Still Life\nSCORE: 6', 'General');
eq('parseAIResponse normalises multiword genre', r.genre, 'StillLife');
r = win.parseAIResponse('This photo is 8/10 overall', 'Portrait');
ok('parseAIResponse x/10 fallback', r.success && r.score === 8);
r = win.parseAIResponse('absolutely no numbers here', 'Portrait');
ok('parseAIResponse fails cleanly', r.success === false && typeof r.error === 'string');

const comp = win.parseCompetitionResponse(
  'TECHNICAL: 8\nCOMPOSITION: 8\nLIGHT: 8\nSUBJECT: 8\nIMPACT: 2\nGENRE: Landscape\nNARRATIVE: Blown highlights.',
  'a description', 'General');
ok('parseCompetitionResponse parses criteria', comp.success && comp.criteria.impact === 2);
// Geometric mean of 8,8,8,8,2 = 6.06 -> rounded 6.1 (arithmetic would be 6.8)
eq('geometric mean penalises the fatal flaw', comp.score, 6.1);
const even = win.parseCompetitionResponse(
  'TECHNICAL: 6\nCOMPOSITION: 6\nLIGHT: 6\nSUBJECT: 6\nIMPACT: 6\nGENRE: Portrait\nNARRATIVE: Even.',
  'd', 'General');
eq('geometric mean equals arithmetic when uniform', even.score, 6);

// ------------------------------------------------------- 7. blind-model guard
ok('NO_IMAGE_RE catches "please provide the photograph"',
   G('NO_IMAGE_RE').test('Please provide the photograph you would like me to judge.'));
ok('NO_IMAGE_RE catches "I cannot see any image"',
   G('NO_IMAGE_RE').test('I cannot see any image in your message.'));
ok('NO_IMAGE_RE does not fire on a normal verdict',
   !G('NO_IMAGE_RE').test('SCORE: 7.0 GENRE: Street REASON: strong gesture against the wall.'));

// ------------------------------------------------------- 8. XMP injection
// Build a synthetic JPEG: SOI + APP0(JFIF) + APP1(EXIF) + APP1(old XMP) + SOS-ish tail
function seg(marker, payload) {
  const len = payload.length + 2;
  return Buffer.concat([Buffer.from([0xFF, marker, (len >> 8) & 0xFF, len & 0xFF]), payload]);
}
const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), Buffer.from([0x49,0x49,0x2A,0x00, 8,0,0,0, 0,0])]);
const oldXmpPayload = Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'binary'), Buffer.from('<x:xmpmeta>STALE</x:xmpmeta>', 'utf8')]);
const scanTail = Buffer.from([0xFF, 0xDA, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0xFF, 0xD9]);
const jpeg = Buffer.concat([
  Buffer.from([0xFF, 0xD8]),
  seg(0xE0, Buffer.from('JFIF\0\u0001\u0002\0\0\u0001\0\u0001\0\0', 'binary')),
  seg(0xE1, exifPayload),
  seg(0xE1, oldXmpPayload),
  scanTail
]);

const injected = Buffer.from(win.injectXmpIntoJpeg(new Uint8Array(jpeg), '<x:xmpmeta>FRESH</x:xmpmeta>'));
ok('injected file is still a JPEG (SOI)', injected[0] === 0xFF && injected[1] === 0xD8);
ok('EXIF segment preserved byte-for-byte', injected.includes(exifPayload));
ok('stale XMP packet removed', !injected.includes(Buffer.from('STALE')));
ok('fresh XMP packet present', injected.includes(Buffer.from('FRESH')));
eq('exactly one XMP namespace marker',
   (injected.toString('binary').match(/http:\/\/ns\.adobe\.com\/xap\/1\.0\//g) || []).length, 1);
ok('scan data (pixels) untouched at the tail',
   injected.subarray(injected.length - scanTail.length).equals(scanTail));
ok('injectXmpIntoJpeg rejects non-JPEG', (() => {
  try { win.injectXmpIntoJpeg(new Uint8Array([1,2,3,4]), '<x/>'); return false; }
  catch (e) { return /not a JPEG/.test(e.message); }
})());

// XMP packet content
const packet = win.buildXmpPacket({
  aiCaption: 'Light & shade <here>', aiKeywords: 'a, b, c',
  entryTitle: 'Title "quoted"', geoPlace: 'Old City, Lahore, Pakistan'
});
ok('XMP escapes ampersand', packet.includes('Light &amp; shade'));
ok('XMP escapes angle brackets', packet.includes('&lt;here&gt;'));
ok('XMP maps city', packet.includes('<photoshop:City>Old City</photoshop:City>'));
ok('XMP maps country', packet.includes('<photoshop:Country>Pakistan</photoshop:Country>'));
ok('XMP lists keywords', packet.includes('<rdf:li>a</rdf:li>'));

// ------------------------------------------------------- 9. persistence
STATE.settings.apiKey = 'sk-SECRET-KEY';
const safe = win.exportableSettings();
ok('exportableSettings strips the API key', !('apiKey' in safe));
ok('exportableSettings keeps other settings', safe.model && safe.endpoint);

const rec = win.serializeImage({
  id:'a', name:'n.jpg', path:'p/n.jpg', size:1, width:2, height:3, thumbnail:'t',
  fileIndex:0, exif:{}, pHash:{h1:1,h2:2}, aiScore:7, aiNarrative:'note', aiGenre:'Street',
  aiCaption:'cap', aiKeywords:'k1,k2', geoPlace:'Lahore', entryTitle:'ET',
  entryCategory:'EC', entryStatement:'ES', clipAffinity:88, clipTopGenre:'Street',
  aiCriteria:{technical:7}, aiDescription:'desc',
  combinedScore:7, stars:4, status:'selected', rejected:false, rejectReason:null,
  category:'Street', duplicate:false, duplicateGroup:null, duplicateRank:0
});
['aiCaption','aiKeywords','geoPlace','entryTitle','entryCategory','entryStatement','clipAffinity','clipTopGenre','aiCriteria','aiDescription']
  .forEach(f => ok('serializeImage persists ' + f, rec[f] !== undefined && rec[f] !== null));
ok('serializeImage drops fullDataUrl', rec.fullDataUrl === null);
ok('serializeImage drops colorHist', rec.colorHist === null);

// ------------------------------------------------------- 10. selection logic
function synth(n, scores) {
  return Array.from({length:n}, (_, i) => ({
    id: 's'+i, name: 's'+i+'.jpg', path:'s'+i+'.jpg', size: 1000 - i,
    exif:{}, thumbnail:'data:,', width:10, height:10,
    aiScore: scores ? scores[i] : null, aiGenre:'General', aiNarrative:'n',
    aiCriteria:null, stars:0, status:'unrated', rejected:false, duplicate:false,
    duplicateGroup:null, duplicateRank:0, category:'General'
  }));
}
STATE.images = synth(5, [9.0, 8.5, 3.0, 6.6, 2.5]);
win.document.getElementById('targetCount').value = '2';
win.autoSelect();
const sel = STATE.images.filter(i => i.status === 'selected').map(i => i.name);
eq('autoSelect picks the top N by score', sel, ['s0.jpg','s1.jpg']);
eq('autoSelect assigns 5 stars to >=8', STATE.images[0].stars, 5);
eq('autoSelect assigns 4 stars to 6.6', STATE.images[3].stars, 4);

// Target is clamped to the eligible count, and no NaN average is logged.
STATE.images = synth(3, null);   // nothing scored
win.document.getElementById('targetCount').value = '999';
logEl.innerHTML = '';
win.autoSelect();
eq('target clamps to eligible count', win.document.getElementById('targetCount').value, '3');
ok('no NaN in the auto-select log', !/NaN/.test(logEl.textContent), logEl.textContent);
ok('warns that ranking is size-only when unscored', /FILE SIZE only/.test(logEl.textContent));

// updateStats renders an em dash, not NaN, with nothing scored
win.updateStats();
eq('avg AI shows em dash when unscored', win.document.getElementById('statAvgAI').textContent, '—');

// ------------------------------------------------------ 11. collision naming
const used = new Set();
eq('uniqueDestName first', win.uniqueDestName({name:'a.jpg', path:'x/a.jpg'}, used), 'a.jpg');
eq('uniqueDestName collision uses parent', win.uniqueDestName({name:'a.jpg', path:'y/a.jpg'}, used), 'y_a.jpg');
eq('uniqueDestName second collision suffixes', win.uniqueDestName({name:'a.jpg', path:'y/a.jpg'}, used), 'y_a_1.jpg');

// ------------------------------------------------------ 12. retry / backoff
(async () => {
  // Transient failures must be retried; auth failures must not be.
  let calls = 0;
  win.callOllama = async () => {
    calls++;
    if (calls < 3) { const e = new Error('Ollama HTTP 503: busy'); throw e; }
    return 'SCORE: 6.0\nGENRE: Street\nREASON: ok';
  };
  const out = await win.callProvider('ollama', 'data:image/jpeg;base64,' + 'A'.repeat(200), 'p');
  ok('callProvider retries transient 503', calls === 3 && /SCORE/.test(out), 'calls=' + calls);

  let authCalls = 0;
  win.callOllama = async () => { authCalls++; throw new Error('Auth 401 bad key'); };
  let threw = false;
  try { await win.callProvider('ollama', 'data:,x', 'p'); } catch (e) { threw = true; }
  ok('callProvider does not retry auth failures', threw && authCalls === 1, 'calls=' + authCalls);

  // -------------------------------------------------- 13. scoring worker pool
  // A slow image must not block others: with parallel=4 and one 120ms image,
  // total time should be far below the serial sum.
  STATE.images = synth(8, null);
  STATE.images.forEach(i => { i.aiScore = null; });
  STATE.settings.ai = 'gemini';
  STATE.settings.parallel = 4;
  STATE.settings.scoringRigor = 'quick';
  win.document.getElementById('settingAI').value = 'gemini';
  win.document.getElementById('settingApiKey').value = 'k';
  win.document.getElementById('targetCount').value = '3';

  let inFlight = 0, maxInFlight = 0, scored = 0;
  win.loadForAI = async () => 'data:image/jpeg;base64,' + 'A'.repeat(200);
  win.scoreWithAI = async (img) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(r => setTimeout(r, img.name === 's3.jpg' ? 120 : 10));
    inFlight--; scored++;
    return { success: true, score: 7.0, genre: 'Street', narrative: 'fine' };
  };
  const t0 = Date.now();
  await win.startAIScoring();
  const elapsed = Date.now() - t0;
  eq('worker pool scores every image', scored, 8);
  ok('worker pool runs requests concurrently', maxInFlight >= 3, 'maxInFlight=' + maxInFlight);
  ok('one slow image does not serialise the run', elapsed < 400, 'elapsed=' + elapsed + 'ms');
  ok('scores are applied to the images', STATE.images.every(i => i.aiScore === 7.0));
  ok('stars derived after scoring', STATE.images.every(i => i.stars === 4));

  // -------------------------------------------------- 14. margin refinement
  // Median-of-3 must be robust to a single outlier.
  STATE.images = synth(6, [9, 8, 7.0, 6.9, 6.8, 2]);
  win.document.getElementById('targetCount').value = '3';
  STATE.aiRunning = true; STATE.aiPaused = false;
  let compCalls = 0;
  win.scoreWithAI_Competition = async () => {
    compCalls++;
    // one aberrant high reading, then a consistent one
    return { success: true, score: compCalls % 2 === 1 ? 9.9 : 7.0, genre: 'Street', narrative: 'x' };
  };
  const refined = await win.runMarginRefinement('gemini', logEl);
  ok('margin refinement re-scored the contested band', compCalls > 0, 'calls=' + compCalls);
  ok('median-of-3 resists a single outlier',
     STATE.images.filter(i => i.aiScore === 9.9).length === 0,
     'scores=' + STATE.images.map(i => i.aiScore).join(','));

  // ------------------------------------------------------------ results
  console.log('');
  console.log('='.repeat(58));
  console.log(`PASS ${pass}   FAIL ${fail}`);
  if (failures.length) {
    console.log('-'.repeat(58));
    failures.forEach(f => console.log('  FAIL: ' + f));
  }
  console.log('='.repeat(58));
  process.exit(fail ? 1 : 0);
})();
