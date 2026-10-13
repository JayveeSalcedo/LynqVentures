import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
test('orientation renders as React without iframe or legacy scripts (Lesson 01 is covered by phase1.test.mjs)',async()=>{
 const bundled=await build({entryPoints:['src/NativeLesson.tsx'],bundle:true,platform:'node',format:'cjs',write:false,external:['react','react-dom'],loader:{'.css':'empty'}});
 const module={exports:{}};
 new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const {NativeLesson}=module.exports;
  const html=renderToString(createElement(NativeLesson,{orientation:true,navigate:()=>{},onProgress:()=>{}}));
  assert.doesNotMatch(html,/<iframe|<script/);
  assert.match(html,/Knowledge check/);
  assert.match(html,/What best describes you/);
  assert.match(html,/Five-question starting profile/);
  assert.match(html,/Mark Module 00 complete locally/);
  assert.match(html,/Begin Phase 01 →/);
  assert.doesNotMatch(html,/Preferred name|Founder Profile|Clear local draft/);
});
test('download creates a Markdown file with current content and releases its object URL',async()=>{
 const bundled=await build({entryPoints:['src/components/LessonParts.tsx'],bundle:true,platform:'node',format:'cjs',write:false,external:['react'],loader:{'.css':'empty'}});
 const module={exports:{}};
 new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const oldDocument=globalThis.document, oldCreate=URL.createObjectURL, oldRevoke=URL.revokeObjectURL, oldTimeout=globalThis.setTimeout;
 let blob,clicked=false,cleanup,revoked;
 const anchor={click(){clicked=true;}};
 try {
  globalThis.document={createElement(tag){assert.equal(tag,'a');return anchor;}};
  URL.createObjectURL=value=>{blob=value;return 'blob:test-export';};
  URL.revokeObjectURL=value=>{revoked=value;};
  globalThis.setTimeout=callback=>{cleanup=callback;return 0;};
  module.exports.downloadText('# Founder Profile\n\nCurrent draft','LYNQ-Founder-Profile.md');
  assert.equal(clicked,true);assert.equal(anchor.download,'LYNQ-Founder-Profile.md');assert.equal(anchor.href,'blob:test-export');
  assert.equal(blob.type,'text/markdown;charset=utf-8');assert.equal(await blob.text(),'# Founder Profile\n\nCurrent draft');
  cleanup();assert.equal(revoked,'blob:test-export');
 } finally {globalThis.document=oldDocument;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;globalThis.setTimeout=oldTimeout;}
});
