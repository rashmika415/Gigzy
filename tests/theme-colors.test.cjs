/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Screens and components must take colors from constants/theme.ts so the palette
// stays consistent (and dark mode stays possible). Neutral black/white overlays and
// shadows are fine anywhere; anything else needs a token or a reasoned entry below.
const ALLOWED = [
  // Read-receipt tint drawn on the teal "me" bubble; no matching theme token.
  { file: 'components/messaging/MessageBubble.tsx', value: 'rgba(0,55,49,' },
];

const COLOR = /#[0-9A-Fa-f]{8}\b|#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|rgba?\([^)]*\)/g;
const NEUTRAL = /^(#(?:000|fff|000000|ffffff)(?:[0-9a-f]{2})?|rgba?\(\s*(?:0\s*,\s*0\s*,\s*0|255\s*,\s*255\s*,\s*255)\s*(?:,[^)]*)?\))$/i;

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : []);
}

test('app screens and components use theme color tokens instead of hardcoded colors', () => {
  const root = path.resolve(__dirname, '..');
  const offenders = [];
  for (const file of ['app', 'components'].flatMap(dir => files(path.join(root, dir)))) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (/shadowColor|boxShadow/.test(line)) return;
      for (const [value] of line.matchAll(COLOR)) {
        if (NEUTRAL.test(value)) continue;
        if (ALLOWED.some(rule => rule.file === rel && value.replace(/\s/g, '').startsWith(rule.value))) continue;
        offenders.push(`${rel}:${index + 1} ${value}`);
      }
    });
  }
  assert.deepEqual(offenders, [], 'Use a token from constants/theme.ts (add one there if nothing fits).');
});
