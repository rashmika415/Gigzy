/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const dictionaries = ['en', 'si', 'ta'].map(language => require(`../locales/${language}.json`));
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(directory, entry.name)] : []);
}
test('every literal UI translation key is available in all three languages', () => {
  const missing = [];
  for (const file of ['app','components'].flatMap(dir => files(path.resolve(__dirname,'..',dir)))) {
    const tree = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isCallExpression(node) && ['t','tr','translate'].includes(node.expression.getText(tree))
        && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        if (dictionaries.some(dictionary => !Object.hasOwn(dictionary,key))) missing.push(`${path.basename(file)}: ${key}`);
      }
      ts.forEachChild(node,visit);
    }
    visit(tree);
  }
  assert.deepEqual([...new Set(missing)], []);
});
