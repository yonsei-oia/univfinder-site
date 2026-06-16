/* Precompile the in-browser JSX so production does not depend on @babel/standalone.
 *
 * Why: index.html historically shipped a <script type="text/babel"> block that the
 * browser compiled at runtime via @babel/standalone. That CDN is unpinned, and when
 * unpkg started serving Babel 8 (whose preset-react defaults to the *automatic* JSX
 * runtime -> emits `import {jsx}`), the in-browser transform broke with
 * "Cannot use import statement outside a module" -> blank page. Browser page
 * translators can also break the in-browser transformer.
 *
 * Fix: compile the JSX here (classic runtime -> React.createElement, no imports) and
 * ship plain JS. No @babel/standalone in the browser.
 *
 * Source of truth: index.src.html  (edit this, keep the <script type="text/babel"> block)
 * Build output:    index.html       (deployed; do not hand-edit)
 * Run:             npm install && node build.cjs   (or: node build.cjs with @babel/standalone resolvable)
 */
const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');

const dir = __dirname;
const src = fs.readFileSync(path.join(dir, 'index.src.html'), 'utf8');

const OPEN = '<script type="text/babel">';
const i = src.indexOf(OPEN);
if (i < 0) throw new Error('No <script type="text/babel"> block found in index.src.html');
const j = src.indexOf('</script>', i + OPEN.length);
if (j < 0) throw new Error('Unterminated text/babel block');

const jsx = src.slice(i + OPEN.length, j);
const { code } = Babel.transform(jsx, {
  presets: [['react', { runtime: 'classic' }]], // classic -> React.createElement, no imports
  sourceType: 'script',
  compact: false,
  comments: false,
});

if (/(^|\n)\s*import\s/.test(code)) {
  throw new Error('Compiled output unexpectedly contains an import statement — aborting.');
}

let html = src.slice(0, i) + '<script>\n' + code + '\n    ' + src.slice(j);
// Drop the now-unused in-browser Babel CDN <script>.
html = html.replace(
  /[ \t]*<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\r?\n/,
  ''
);

fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(`Built index.html — precompiled JSX with Babel ${Babel.version} (classic runtime), removed @babel/standalone CDN.`);
