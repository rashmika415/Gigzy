const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createInstance } = require('i18next');
const load = require('./helpers/load-ts.cjs');
const { resolveLanguage } = load('../localization/language.ts');
const en = require('../locales/en.json');
const si = require('../locales/si.json');
const ta = require('../locales/ta.json');

test('saved language wins; supported device languages are detected; unsupported preferences fall back safely', () => {
  assert.equal(resolveLanguage('ta', ['si-LK']), 'ta');
  assert.equal(resolveLanguage(null, ['fr-FR', 'si-LK']), 'si');
  assert.equal(resolveLanguage('invalid', ['TA_lk']), 'ta');
  assert.equal(resolveLanguage(null, ['de-DE']), 'en');
  assert.equal(resolveLanguage(null, []), 'en');
});

test('all bundled languages cover the same keys and preserve interpolation arguments', () => {
  const placeholders = text => (text.match(/\{\{[^}]+\}\}/g) ?? []).sort();
  for (const dictionary of [si, ta]) {
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(dictionary)) {
      assert.deepEqual(placeholders(value), placeholders(en[key]), key);
      assert.equal(typeof value, 'string');
    }
  }
});

test('language switching translates static labels and counts without changing interpolated gig titles', async () => {
  const i18n = createInstance();
  await i18n.init({ resources: { en: { translation: en }, si: { translation: si }, ta: { translation: ta } },
    lng: 'en', fallbackLng: 'en', keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false } });
  for (const [language, dictionary] of [['si', si], ['ta', ta], ['en', en]]) {
    await i18n.changeLanguage(language);
    assert.equal(i18n.t('Home'), dictionary.Home);
    assert.equal(i18n.t('Mapped gigs: {{count}}', { count: 3 }), dictionary['Mapped gigs: {{count}}'].replace('{{count}}', '3'));
    assert.ok(i18n.t('Remove {{value0}} from saved gigs', { value0: 'Original gig title' }).includes('Original gig title'));
    assert.equal(i18n.t('Unknown future message'), 'Unknown future message');
  }
});
