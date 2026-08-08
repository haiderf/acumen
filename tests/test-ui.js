/** UI smoke test: render every tab, wiki section and help topic. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'Acumen_v3.7.html'), 'utf8');
const vc = new VirtualConsole();
const errs = [];
vc.on('jsdomError', e => errs.push(e.message));

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/' });
const win = dom.window;
win.HTMLCanvasElement.prototype.getContext = () => ({
  fillRect(){}, drawImage(){}, beginPath(){}, arc(){}, fill(){}, strokeRect(){}, fillText(){},
  getImageData: (x,y,w,h) => ({ data: new Uint8ClampedArray(w*h*4) })
});
win.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,AAAA';
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));

let pass = 0, fail = 0;
const problems = [];
const check = (n, c, d) => c ? pass++ : (fail++, problems.push(n + (d ? ' :: ' + d : '')));

// Tabs
for (const tab of ['import', 'cull', 'settings', 'wiki']) {
  try {
    win.showTab(tab);
    const el = win.document.getElementById('tab-' + tab);
    check(`tab ${tab} activates`, el && el.classList.contains('active'));
  } catch (e) { check(`tab ${tab} activates`, false, e.message); }
}

// Wiki sections
const sections = Object.keys(win.eval('WIKI_SECTIONS'));
console.log('wiki sections:', sections.length);
for (const key of sections) {
  try {
    win.showWikiSection(key);
    const c = win.document.getElementById('wikiContent');
    check(`wiki "${key}" renders`, c.innerHTML.length > 200, `len=${c.innerHTML.length}`);
    check(`wiki "${key}" has a heading`, !!c.querySelector('h2'));
    // Unresolved template placeholders or literal "undefined" are a red flag
    check(`wiki "${key}" has no undefined text`, !/>\s*undefined\s*</.test(c.innerHTML));
  } catch (e) { check(`wiki "${key}" renders`, false, e.message); }
}

// Help topics
const topics = Object.keys(win.eval('HELP_CONTENT'));
console.log('help topics:', topics.length);
for (const key of topics) {
  try {
    win.showHelp(key);
    const c = win.document.getElementById('helpContent');
    check(`help "${key}" renders`, c.innerHTML.length > 100, `len=${c.innerHTML.length}`);
  } catch (e) { check(`help "${key}" renders`, false, e.message); }
}
win.closeHelp();

// Theme toggle round-trip
try {
  const before = win.eval('STATE.theme');
  win.toggleTheme();
  const after = win.eval('STATE.theme');
  check('theme toggles', before !== after);
  win.toggleTheme();
  check('theme toggles back', win.eval('STATE.theme') === before);
} catch (e) { check('theme toggles', false, e.message); }

// Provider switching updates the settings panel
for (const p of ['none', 'ollama', 'gemini', 'groq', 'openai']) {
  try {
    win.document.getElementById('settingAI').value = p;
    win.updateAISettings();
    const keyRow = win.document.getElementById('apiKeyRow').style.display;
    const expectKey = (p !== 'none' && p !== 'ollama');
    check(`provider ${p} shows API key row correctly`, expectKey ? keyRow === 'block' : keyRow === 'none', `display=${keyRow}`);
  } catch (e) { check(`provider ${p}`, false, e.message); }
}

// Empty-state guards: actions on an empty library must not throw
win.eval('STATE').images = [];
win.alert = () => {};
win.confirm = () => false;
win.prompt = () => null;
for (const fn of ['autoSelect', 'clearSelection', 'undoSelection', 'renderGrid', 'updateStats', 'toggleCompare', 'detectDuplicates', 'exportCSV', 'exportPDF', 'copySelectedToFolder', 'exportAlbumPackage']) {
  try { win[fn](); check(`${fn}() survives an empty library`, true); }
  catch (e) { check(`${fn}() survives an empty library`, false, e.message); }
}

check('no jsdom runtime errors', errs.length === 0, errs.join(' | '));

console.log('');
console.log('='.repeat(58));
console.log(`PASS ${pass}   FAIL ${fail}`);
problems.forEach(p => console.log('  FAIL: ' + p));
console.log('='.repeat(58));
process.exit(fail ? 1 : 0);
