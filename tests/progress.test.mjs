import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,recordAttempt,nextStep,lessonSession,deriveProgress,reviewQueue,validRun,normalizeAnswer} from '../src/progress.mjs';
import {makePlan,readHistory,validateLearningEvent} from '../src/learning.mjs';
const c=JSON.parse(readFileSync(new URL('../src/curriculum.json',import.meta.url),'utf8'));
const lesson=JSON.parse(readFileSync(new URL('../src/lessons.json',import.meta.url),'utf8')).lessons[0];
const date='2026-10-01T12:00:00.000Z', day=86400000, start=Date.parse(date);
const event=(stage,at=date,words=['水'])=>({stage,at,words,modality:'text',scope:'hsk'});
const session=events=>({id:'test',date,mode:'guided',learningEvents:events,messages:[],practiced:[]});
test('teacher-only vocabulary and app commands cannot count as practiced',()=>{
 const plan=makePlan(c,1,'introductions',[]);
 const summary={kind:'summary',practiced:['学生'],errors:[],recommendation:'x',homework:'x',completed:true};
 assert.throws(()=>validateLearningEvent(summary,plan,[{role:'agent',text:'你是学生吗？'},{role:'user',text:'No entendí'}]));
 assert.throws(()=>validateLearningEvent(summary,plan,[{role:'user',control:true,text:'我是学生'}]));
 const actual=validateLearningEvent(summary,plan,[{role:'user',text:'我是学生'}]);
 assert.equal(actual.completed,false);
});
test('one independent answer schedules a day; duplicates in that day cannot inflate recall',()=>{
 const p=deriveProgress([session([event('independent'),event('independent',new Date(start+1000).toISOString())])],c,start+2000)['水'];
 assert.equal(p.successfulReviews,1);assert.equal(p.nextDue,start+day);
});
test('a later-day answer extends retention; personal and demo evidence stay separate',()=>{
 const later=new Date(start+day).toISOString();
 const p=deriveProgress([session([event('independent'),event('independent',later),{...event('independent',later,['茶']),scope:'personal'}]),{...session([event('independent',date,['米饭'])]),mode:'demo'}],c,start+day)['水'];
 assert.equal(p.successfulReviews,2);assert.equal(p.nextDue,start+4*day);
 const all=deriveProgress([session([{...event('independent'),scope:'personal'}])],c,start+day);assert.deepEqual(all,{});
});
test('review queue uses deadlines, not the array order, and respects selected HSK level',()=>{
 const history=[session([event('independent',new Date(start+2*day).toISOString(),['茶'])]),session([event('recognized',date,['水','车站'])])];
 assert.deepEqual(reviewQueue(history,c,1,start+2*day),['水']);
 assert.deepEqual(reviewQueue(history,c,2,start+2*day),['水','车站']);
});
test('failed practice schedules the word again',()=>{
 const p=deriveProgress([session([event('independent'),event('needs_review',new Date(start+1000).toISOString())])],c,start+2000)['水'];
 assert.equal(p.nextDue,start+1000);assert.equal(p.successfulReviews,0);
});
test('malformed or future evidence is ignored instead of crashing',()=>{
 assert.deepEqual(deriveProgress([{...session([]),learningEvents:[null,{}, {stage:'independent',at:date,words:'水'}, event('independent',new Date(start+day).toISOString())]}],c,start),{});
});
test('a lesson cannot skip a check or finish on an incorrect answer',()=>{
 const run=createRun(lesson,date,'run');assert.ok(validRun(run,lesson));
 assert.throws(()=>nextStep(run,lesson));
 const skip=nextStep(run,lesson,true);assert.equal(skip.index,1);
 assert.throws(()=>nextStep(skip,lesson,true));
 const bad=recordAttempt(run,lesson,'我喝茶',{at:date});assert.equal(bad.passed,false);assert.throws(()=>nextStep(bad,lesson));
});
test('hiding a model does not erase assistance from that exercise',()=>{
 let run=createRun(lesson,date,'run');run={...run,modelVisible:false,hintCount:1};
 run=recordAttempt(run,lesson,'我喝水。',{at:date});assert.equal(run.attempts[0].assisted,true);
 assert.equal(lessonSession(run,lesson,c).learningEvents[0].stage,'repeated');
});
test('full lesson survives notebook serialization and records real typed attempts',()=>{
 let run=createRun(lesson,date,'run');
 for(const task of lesson.steps){run=recordAttempt(run,lesson,task.answers[0],{at:date,modality:task.kind==='listen'?'reading':'text'});run=nextStep(run,lesson);}
 assert.equal(run.ended,true);assert.equal(run.attempts.length,5);
 const saved=lessonSession(run,lesson,c);const notebook=readHistory({getItem:()=>JSON.stringify([saved])},'test');
 assert.equal(notebook.length,1);assert.ok(validRun(notebook[0].run,lesson));assert.equal(notebook[0].summary.completed,true);
 assert.ok(saved.learningEvents.some(e=>e.stage==='recognized'&&e.modality==='reading'));
 assert.ok(saved.learningEvents.some(e=>e.stage==='independent'&&e.evidence==='我喝茶'));
});
test('one historical occurrence does not remove a learning target',()=>{
 const history=[{date,mode:'voice',practiced:['喝','水','茶'],messages:[{role:'user',text:'我喝水和茶'}]}];
 assert.ok(makePlan(c,1,'food',history,start+day).targets.includes('水'));
});
test('normalization tolerates punctuation but rejects empty and oversize answers',()=>{
 assert.equal(normalizeAnswer(' 我喝水。 '),'我喝水');
 const run=createRun(lesson,date,'run');assert.throws(()=>recordAttempt(run,lesson,''));assert.throws(()=>recordAttempt(run,lesson,'我'.repeat(1001)));
 assert.equal(validRun({...run,index:99},lesson),false);assert.equal(validRun({...run,attempts:[null]},lesson),false);
});

test('a later exposure does not replace the modality of stronger evidence',()=>{
 const history=[{mode:'guided',messages:[],learningEvents:[
  {words:['水'],stage:'independent',at:'2026-10-20T10:00:00Z',modality:'text'},
  {words:['水'],stage:'exposed',at:'2026-10-21T10:00:00Z',modality:'listening'}
 ]}];
 const p=deriveProgress(history,c,Date.parse('2026-10-22T10:00:00Z'))['水'];
 assert.equal(p.stage,'independent');assert.equal(p.modality,'text');
});
