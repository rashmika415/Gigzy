const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
module.exports = function load(relativePath, mocks = {}) {
  const cache = new Map();
  function read(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInNewContext(source, { exports, console, setTimeout, clearTimeout, require: name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('.')) return read(path.resolve(path.dirname(file), name + '.ts'));
      throw new Error(`Unexpected import ${name}`);
    }});
    return exports;
  }
  return read(path.resolve(__dirname, '..', relativePath));
};
