import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const curriculum = JSON.parse(readFileSync(new URL('../src/data/curriculum.json', import.meta.url)));
const original = readFileSync(new URL('../LYNQ_Academy_All_Phases.html', import.meta.url), 'utf8');
function originalValue(name) {
  const start = original.indexOf(`const ${name}`);
  const equal = original.indexOf('=', start);
  // Find the JSON literal's end without evaluating the original application.
  const rest = original.slice(equal + 1).trimStart();
  let quoted = false, escaped = false, depth = 0;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') {quoted = false; if (depth === 0) return JSON.parse(rest.slice(0,i+1));} }
    else if (c === '"') quoted = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {depth--; if (depth === 0) return JSON.parse(rest.slice(0,i+1));}
  }
  throw new Error(`Missing ${name}`);
}
test('all 100 lesson names and validation schemas are preserved', () => {
  assert.deepEqual(curriculum.names, originalValue('names'));
  assert.deepEqual(curriculum.schemas, originalValue('schemas'));
  assert.equal(Object.keys(curriculum.schemas).length,100);
  assert.equal(curriculum.phases.length,5);
  for (const phase of curriculum.phases) assert.equal(phase.modules.length,4);
});
test('legacy reference documents are preserved unchanged apart from the retired navigation bridge', () => {
  const documents = [originalValue('orientationDocument'), ...originalValue('documents')];
  documents.forEach((expected,i) => {
    const name = i ? `phase-${i}` : 'orientation';
    const actual = readFileSync(new URL(`../legacy/lessons/${name}.html`,import.meta.url),'utf8');
    assert.equal(actual.replace('<script src="./native-bridge.js"></script>',''),expected);
    for (const script of actual.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(script[1],{filename:name});
  });
});
