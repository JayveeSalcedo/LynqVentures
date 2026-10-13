// Bundle a TypeScript/TSX module for node:test without a browser (React stays external).
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const cache = new Map();

export async function load(entry) {
  if (cache.has(entry)) return cache.get(entry);
  const result = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react', 'react-dom'], loader: { '.css': 'empty' }, logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  cache.set(entry, module.exports);
  return module.exports;
}

/** Minimal in-memory localStorage for state tests. */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear(),
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    dump: () => Object.fromEntries(data),
  };
}
