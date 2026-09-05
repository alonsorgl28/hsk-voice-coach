import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makePlan,validateLearningEvent,chineseAllowed,readHistory,upsertSession} from '../src/learning.mjs';
const curriculum=JSON.parse(readFileSync(new URL('../src/curriculum.json',import.meta.url),'utf8'));
const plan=makePlan(curriculum,1,'introductions',[]);
const messages=[{role:'agent',text:'你是学生吗？'},{role:'user',text:'我学生'},{role:'agent',text:'我是学生。'}];
const correction={kind:'correction',hanzi:'我是学生。',pinyin:'Wǒ shì xuésheng.',explanation:'Faltaba 是.',evidence:'我学生'};
test('every topic has eligible words and no more than five new targets',()=>{
 for(const level of curriculum.levels) for(const topic of curriculum.topics){
  const p=makePlan(curriculum,level.id,topic.id,[]);
  assert.ok(p.targets.length<=5);assert.ok(p.allowed.every(w=>w.level<=level.id));
  for(const word of p.topic.words)assert.ok(p.allowed.some(w=>w.hanzi===word));
 }
});
test('review comes only from real history and excludes words above selected level',()=>{
 const p=makePlan(curriculum,1,'introductions',[{mode:'voice',practiced:['叫','名字','人','车站']},{mode:'demo',practiced:['中国']}]);
 assert.deepEqual(p.review,['叫','名字','人']);assert.deepEqual(p.targets,['中国','学生']);
});
test('Chinese segmentation rejects advanced vocabulary and accepts allowed compounds',()=>{
 const words=plan.allowed.map(w=>w.hanzi);
 assert.ok(chineseAllowed('你叫什么名字？',words));assert.equal(chineseAllowed('讨论宏观经济。',words),false);
 assert.equal(chineseAllowed('人名',words),false);
});
test('a correction requires an exact student quote, not the teacher or a fabricated phrase',()=>{
 assert.equal(validateLearningEvent(correction,plan,messages).evidence,'我学生');
 assert.throws(()=>validateLearningEvent({...correction,evidence:'我很好'},plan,messages));
 assert.throws(()=>validateLearningEvent({...correction,evidence:'你是学生吗？'},plan,messages));
 assert.throws(()=>validateLearningEvent({...correction,hanzi:'我是一名大学生。'},plan,messages));
});
test('summary retains evidenced words and errors; rejects invented practice',()=>{
 const summary={kind:'summary',practiced:['我','学生'],errors:[correction],recommendation:'Practicar 是.',homework:'Repetir la frase.',completed:false};
 assert.equal(validateLearningEvent(JSON.stringify(summary),plan,messages).completed,false);
 assert.throws(()=>validateLearningEvent({...summary,practiced:['中国']},plan,messages));
 assert.throws(()=>validateLearningEvent(summary,plan,[]));
 assert.throws(()=>validateLearningEvent({...summary,errors:[{...correction,evidence:'我中国'}]},plan,messages));
});
test('invalid storage and malformed tool data do not become sessions',()=>{
 for(const value of ['broken','{}','[null]','[{"id":"test"}]'])assert.deepEqual(readHistory({getItem:()=>value},'test'),[]);
 assert.deepEqual(readHistory({getItem:()=>{throw Error('blocked')}},'test'),[]);
 for(const data of ['broken',null,{}, {kind:'summary'}, {...correction,pinyin:42}])assert.throws(()=>validateLearningEvent(data,plan,messages));
});
test('upserts are idempotent and history has a fixed retention limit',()=>{
 const sessions=[{id:'a'},{id:'b'}];assert.deepEqual(upsertSession(sessions,{id:'a',duration:60},2),[{id:'a',duration:60},{id:'b'}]);
 assert.deepEqual(upsertSession(sessions,{id:'c'},2),[{id:'c'},{id:'a'}]);
});
