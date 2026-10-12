const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./helpers/load-ts.cjs');

function setup(relativeTimeFormat, language = 'en') {
  const dictionary = require(`../locales/${language}.json`);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('localization/format.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    Intl: { NumberFormat: Intl.NumberFormat, DateTimeFormat: Intl.DateTimeFormat, RelativeTimeFormat: relativeTimeFormat },
    require: name => {
      if (name === './language') return load('../localization/language.ts');
      if (name === './i18n') return {
        default: { resolvedLanguage: language },
        translate: (key, values = {}) => (dictionary[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? '')),
      };
      throw new Error('Unexpected import ' + name);
    },
  });
  return exports;
}
const now = new Date(2026, 9, 4, 12, 0);
const before = minutes => new Date(now.getTime() - minutes * 60000);

test('gig posted dates render in Hermes without Intl.RelativeTimeFormat', () => {
  const format = setup(undefined);
  assert.equal(format.formatRelativeDate(before(0), now), 'Just now');
  assert.equal(format.formatRelativeDate(before(5), now), '5 minutes ago');
  assert.equal(format.formatRelativeDate(before(120), now), '2 hours ago');
  assert.equal(format.formatRelativeDate(before(1440), now), 'Yesterday');
  assert.equal(format.formatRelativeDate(before(4320), now), '3 days ago');
  assert.ok(format.formatRelativeDate(before(11520), now).length > 0);
});

test('native relative-time fallback remains translated in Sinhala and Tamil', () => {
  for (const language of ['si', 'ta']) {
    const dictionary = require(`../locales/${language}.json`);
    const format = setup(undefined, language);
    assert.equal(format.formatRelativeDate(before(5), now), dictionary['{{count}} minutes ago'].replace('{{count}}', '5'));
    assert.equal(format.formatRelativeDate(before(1440), now), dictionary.Yesterday);
  }
});

test('partial or failing Intl implementations cannot crash gig details', () => {
  class PartialFormatter {}
  class FailingFormatter { static supportedLocalesOf() { throw new Error('Missing locale data'); } }
  for (const constructor of [PartialFormatter, FailingFormatter]) {
    assert.equal(setup(constructor).formatRelativeDate(before(5), now), '5 minutes ago');
  }
});

test('supported relative-time formatting and invalid dates still work', () => {
  const format = setup(Intl.RelativeTimeFormat);
  assert.equal(format.formatRelativeDate(before(120), now), new Intl.RelativeTimeFormat('en-LK', { numeric: 'auto' }).format(-2, 'hour'));
  assert.equal(format.formatRelativeDate(new Date('invalid'), now), '');
});
