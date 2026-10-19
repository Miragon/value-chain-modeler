// Checks what the production build must carry and the dev server never shows: the mode markup
// written into index.html by the Vite plugin (guide §13.3) and the Lucide/Feather licence comments
// of the shell and the renderer in the bundle (their THIRD_PARTY_NOTICES).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = readdirSync(join(dist, 'assets'))
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(join(dist, 'assets', name), 'utf8'));

const problems = [];
if (html.includes('<!-- miragon-mode -->'))
  problems.push('index.html still has the mode placeholder');
if (!/<meta name="theme-color" content="#[0-9A-Fa-f]{6}"/.test(html)) {
  problems.push('index.html has no theme-color with a colour from the tokens');
}
if (!html.includes('prefers-contrast')) problems.push('index.html has no contrast line');
if (!html.includes('class="cd-shell-document"'))
  problems.push('<html> lacks class="cd-shell-document"');
const LICENCE_COMMENTS = {
  '@miragon/modeler-shell': /@miragon\/modeler-shell icon geometry[\s\S]{0,120}@license ISC/,
  '@miragon/value-chain-renderer':
    /@miragon\/value-chain-renderer icon geometry[\s\S]{0,120}@license ISC/,
};
for (const [source, comment] of Object.entries(LICENCE_COMMENTS)) {
  if (!scripts.some((script) => comment.test(script))) {
    problems.push(`no bundle keeps the Lucide @license comment of ${source}`);
  }
}

if (problems.length > 0) {
  console.error(`apps/webapp build check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('apps/webapp build check: mode markup and licence comments present');
