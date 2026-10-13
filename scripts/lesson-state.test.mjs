import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lesson-state.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const state=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const native=JSON.parse(readFileSync(new URL('../src/data/native-lessons.json',import.meta.url)));
// Orientation (Module 00) only. Lesson 01 coverage lives in scripts/phase1.test.mjs.
const ids=native.orientationFields.map(field=>field.id), keys=[1,0,2];
const full=()=>({...state.blankDraft(),fields:Object.fromEntries(ids.map(id=>[id,`Answer for ${id}`])),answers:{0:1,1:0,2:2},studied:true,honest:true,completed:true});
test('orientation quiz, fields and starting profile match the existing completion contract',()=>{
 assert.deepEqual(native.orientationQuestions.map(q=>q[2]),keys);
 assert.deepEqual(ids,['orientationPain','orientationUnknown','orientationNext','orientationBias','orientationCounter','orientationConstraint']);
 assert.deepEqual(native.profile.map(q=>q[1].length),state.profileLimits);
 for(const key of ['scenes','questions','lessonLearn','lessonFields'])assert.equal(key in native,false,`Lesson 01 data moved to src/data/lessons/phase-1 (${key})`);
});
test('completion requires every field, correct quiz, study and self-review',()=>{
 assert.equal(state.validDraft(full(),ids,keys),true);
 for(const id of ids)assert.equal(state.validDraft({...full(),fields:{...full().fields,[id]:'  '}},ids,keys),false);
 for(const patch of [{studied:false},{honest:false},{answers:{0:0,1:0,2:2}},{answers:{}}])assert.equal(state.validDraft({...full(),...patch},ids,keys),false);
});
test('editing invalidates completion and never automatically completes a draft',()=>{
 assert.equal(state.reviseDraft(full(),{fields:{...full().fields,orientationPain:''}},ids,keys).completed,false);
 assert.equal(state.reviseDraft({...full(),completed:false},{},ids,keys).completed,false);
 assert.equal(state.reviseDraft(full(),{fields:{...full().fields,orientationPain:'Updated answer'}},ids,keys).completed,true);
 assert.equal(state.reviseDraft(full(),{},ids,keys,false).completed,false);
});
test('legacy drafts normalize safely without trusting malformed values',()=>{
 assert.deepEqual(state.normalizeDraft(null),state.blankDraft());
 assert.deepEqual(state.normalizeDraft('invalid'),state.blankDraft());
 const draft=state.normalizeDraft({fields:{orientationPain:'Time',orientationNext:42},answers:{0:'1',1:null,2:''},studied:'true',honest:true,completed:1});
 assert.deepEqual(draft.fields,{orientationPain:'Time'});
 assert.deepEqual(draft.answers,{0:1});
 assert.equal(draft.studied,false);assert.equal(draft.completed,false);
});
test('orientation profile rejects out-of-range and incomplete answers',()=>{
 const good=state.normalizeProfile({answers:{0:4,1:2,2:7,3:5,4:2},profileCompleted:true,completed:true});
 assert.equal(good.profileCompleted,true);
 for(const [index,limit] of state.profileLimits.entries())assert.equal(state.normalizeProfile({...good,answers:{...good.answers,[index]:limit}}).profileCompleted,false);
 assert.equal(state.normalizeProfile({answers:{0:0},completed:true}).profileCompleted,false);
});
test('deliverable includes latest worksheet, profile, reflections and draft status',()=>{
 const text=state.makeDeliverable('Founder Starting Brief',false,native.orientationFields,{...full(),fields:{...full().fields,orientationNext:''}},['Starting profile: Beginner']);
 assert.match(text,/Status: Draft/);assert.match(text,/Starting profile: Beginner/);
 for(const id of ids.filter(id=>id!=='orientationNext'))assert.ok(text.includes(`Answer for ${id}`));
 assert.match(text,/Not entered/);assert.match(text,/No reviewer submission/);
});
