const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const load = require('./helpers/load-ts.cjs');
const { createGeoapifyMapHTML } = load('../services/geoapifyMap.ts');

test('map document escapes user content, preserves attribution and uses Geoapify tiles', () => {
  const title = '</script><script>alert(1)</script>';
  const html = createGeoapifyMapHTML([{ key: '6,79', coordinates: { latitude: 6, longitude: 79 }, gigs: [{ title }] }], 'test-key');
  assert.equal(html.includes(title), false);
  assert.ok(html.includes('maps.geoapify.com/v1/tile/osm-carto/'));
  assert.ok(html.includes('OpenStreetMap contributors'));
  assert.ok(html.includes('Powered by'));
  assert.equal(html.includes('googleapis.com'), false);
});

test('map bridge opens the selected pin, fits locations, handles GPS and reports tile failures', () => {
  const events = [], markers = [], views = [];
  let fit = null;
  const tileEvents = {};
  const map = { setView: (...args) => { views.push(args); return map; }, fitBounds: points => { fit = points; }, removeLayer() {} };
  const tile = { on: (name, callback) => { tileEvents[name] = callback; }, addTo() {} };
  const L = {
    map: () => map, tileLayer: () => tile, divIcon: value => value,
    marker: () => { const marker = { addTo: () => marker, bindTooltip() {}, on: (_, fn) => { marker.click = fn; } }; markers.push(marker); return marker; },
    circleMarker: () => ({ addTo() { return this; } }),
  };
  const context = { L, document: { createElement: () => ({}) }, window: { parent: { postMessage: message => events.push(message) }, addEventListener() {} } };
  const pins = ['a', 'b'].map((key, index) => ({ key, coordinates: { latitude: 6 + index, longitude: 79 }, gigs: [{ title: key }] }));
  const html = createGeoapifyMapHTML(pins, 'test-key');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  scripts.forEach(match => vm.runInNewContext(match[1], context));
  assert.equal(events.at(-1).type, 'ready');
  assert.equal(fit.length, 2);
  markers[1].click();
  assert.equal(events.at(-1).key, 'b');
  context.window.gigzyCommand({ type: 'locate', latitude: 6.5, longitude: 79.5 });
  assert.equal(views.at(-1)[0][0], 6.5);
  tileEvents.load();
  assert.equal(events.at(-1).type, 'error');
  tileEvents.tileload();
  assert.equal(events.at(-1).type, 'loaded');
});
