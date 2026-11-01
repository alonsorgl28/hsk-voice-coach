// Progress is reconstructed from dated evidence. Old notebooks remain readable.
const DAY = 86400000;
/** @typedef {{word:string,stage:string,successfulReviews:number,nextDue:number,lastSeen:number,modality:string,lastIndependent?:number}} WordProgress */
/** @typedef {{task:string,text:string,correct:boolean,assisted:boolean,modality:string,at:string}} Attempt */
/** @typedef {{text:string,at:string}} Exposure */
export const normalizeAnswer = text => typeof text === 'string' ? text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase() : '';
export function wordsIn(text, words) {
  const remaining = [...words].sort((a,b)=>b.hanzi.length-a.hanzi.length);
  const result = new Set();
  for (const chunk of String(text).match(/[\p{Script=Han}]+/gu) || []) {
    for (let i=0;i<chunk.length;) {
      const word=remaining.find(w=>chunk.startsWith(w.hanzi,i));
      if(word){result.add(word.hanzi);i+=word.hanzi.length;}else i++;
    }
  }
  return [...result];
}
export function deriveProgress(history, curriculum, now=Date.now()) {
  const entries=[];
  for(const session of history.filter(s=>s.mode!=='demo')) {
    // Historical mentions do not prove independence or comprehension.
    for(const message of session.messages || []) {
      if(message.role==='agent')for(const word of wordsIn(message.text,curriculum.words))entries.push({word,stage:'exposed',at:message.receivedAt||session.date,modality:session.mode==='text'?'reading':'exposure'});
    }
    for(const word of session.practiced || []) {
      if(curriculum.words.some(w=>w.hanzi===word) && session.messages?.some(m=>m.role==='user'&&!m.control&&wordsIn(m.text,curriculum.words).includes(word)))
        entries.push({word,stage:'observed',at:session.date,modality:session.mode==='text'?'text':'transcript'});
    }
    for(const event of Array.isArray(session.learningEvents)?session.learningEvents:[]) {
      if(!event||event.scope==='personal'||!Array.isArray(event.words)||!['exposed','recognized','repeated','independent','needs_review'].includes(event.stage)||!Number.isFinite(Date.parse(event.at))) continue;
      for(const word of event.words || []) if(curriculum.words.some(w=>w.hanzi===word)) entries.push({...event,word});
    }
  }
  /** @type {Record<string, WordProgress>} */
  const progress={};
  const rank={exposed:0,observed:1,recognized:2,repeated:3,independent:4};
  for(const e of entries.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))) {
    const at=Date.parse(e.at);if(!Number.isFinite(at)||at>now)continue;
    const p=progress[e.word] || {word:e.word,stage:'exposed',successfulReviews:0,nextDue:at,lastSeen:at,modality:e.modality||'unknown'};
    if(e.stage==='needs_review'){p.nextDue=at;p.successfulReviews=0;p.lastIndependent=undefined;}
    if(e.stage==='independent') {
      // One day must pass before a new success can extend the interval.
      if(p.lastIndependent === undefined || at-p.lastIndependent >= DAY) {
        p.successfulReviews++;p.lastIndependent=at;
        const days=curriculum.reviewIntervalsDays[Math.min(p.successfulReviews-1,curriculum.reviewIntervalsDays.length-1)];
        p.nextDue=at+days*DAY;
      }
    } else if(e.stage!=='exposed' && !p.successfulReviews) p.nextDue=Math.min(p.nextDue,at);
    if(rank[e.stage]>=rank[p.stage]){p.stage=e.stage;p.modality=e.modality||p.modality;}
    p.lastSeen=Math.max(at,p.lastSeen);
    progress[e.word]=p;
  }
  return progress;
}
export function reviewQueue(history,curriculum,level,now=Date.now()) {
  return Object.values(deriveProgress(history,curriculum,now)).filter(p=>p.nextDue<=now&&curriculum.words.some(w=>w.hanzi===p.word&&w.level<=level))
    .sort((a,b)=>a.nextDue-b.nextDue||a.successfulReviews-b.successfulReviews).map(p=>p.word);
}
export function createRun(lesson, now=new Date().toISOString(), id=crypto.randomUUID()) {
  return {id,date:now,lessonId:lesson.id,index:0,hintCount:0,modelVisible:false,attempts:/** @type {Attempt[]} */([]),exposures:/** @type {Exposure[]} */([]),passed:false,ended:false};
}
export function recordAttempt(run,lesson,text,{modality='text',at=new Date().toISOString()}={}) {
  const task=lesson.steps[run.index];
  if(run.ended||!task||typeof text!=='string'||!text.trim()||text.length>1000)throw Error('Respuesta no válida.');
  const correct=task.answers.some(answer=>normalizeAnswer(answer)===normalizeAnswer(text));
  const assisted=run.hintCount>0||run.modelVisible||task.kind==='practice';
  const attempt={task:task.id,text:text.trim(),correct,assisted,modality,at};
  return {...run,attempts:[...run.attempts,attempt],passed:correct};
}
export function nextStep(run,lesson,skip=false) {
  const task=lesson.steps[run.index];
  if(run.ended||(!run.passed&&!(skip&&task.allowSkip)))throw Error('Responde o pide ayuda antes de continuar.');
  if(run.index===lesson.steps.length-1)return {...run,ended:true};
  return {...run,index:run.index+1,hintCount:0,modelVisible:lesson.steps[run.index+1].kind==='practice',passed:false};
}
export function runEvents(run,lesson,curriculum) {
  return [...(run.exposures||[]).map(e=>({stage:'exposed',words:wordsIn(e.text,curriculum.words),at:e.at,modality:'listening',evidence:e.text,scope:lesson.personal?'personal':'hsk',task:'audio'})),...run.attempts.map(a=>({
    stage:!a.correct?'needs_review':lesson.steps.find(s=>s.id===a.task)?.kind==='listen'?'recognized':a.assisted?'repeated':'independent',
    words:!a.correct?wordsIn(lesson.steps.find(s=>s.id===a.task)?.answers[0]||'',curriculum.words):lesson.steps.find(s=>s.id===a.task)?.kind==='listen'?(lesson.steps.find(s=>s.id===a.task)?.words||[]):wordsIn(a.text,curriculum.words),at:a.at,modality:a.modality,evidence:a.text,scope:lesson.personal?'personal':'hsk',task:a.task
  }))];
}
export function lessonSession(run,lesson,curriculum) {
  const events=runEvents(run,lesson,curriculum);
  const practiced=[...new Set(events.filter(e=>['repeated','independent'].includes(e.stage)&&e.scope!=='personal').flatMap(e=>e.words))];
  const independent=run.attempts.filter(a=>a.correct&&!a.assisted&&lesson.steps.find(s=>s.id===a.task)?.kind!=='listen').length;
  return {id:run.id,date:run.date,level:lesson.level,topic:lesson.title,mode:'guided',duration:Math.max(0,Math.floor((Date.now()-Date.parse(run.date))/1000)),messages:run.attempts.map(a=>({role:'user',text:a.text})),feedback:[],practiced:[],learningEvents:events,run,lessonSnapshot:lesson,ended:run.ended,
    summary:run.ended?{kind:'summary',practiced,errors:[],recommendation:independent?'Recupera estas frases mañana antes de mirar el modelo.':'Vuelve a practicar con pistas y luego retíralas.',homework:'Intenta responder una variante en la próxima sesión.',completed:run.ended}:undefined};
}

export function validRun(run,lesson) {
  return !!run&&typeof run.id==='string'&&run.lessonId===lesson.id&&Number.isFinite(Date.parse(run.date))&&Number.isInteger(run.index)&&run.index>=0&&run.index<lesson.steps.length&&Number.isInteger(run.hintCount)&&run.hintCount>=0&&typeof run.modelVisible==='boolean'&&typeof run.ended==='boolean'&&typeof run.passed==='boolean'&&Array.isArray(run.attempts)&&run.attempts.every(a=>a&&lesson.steps.some(s=>s.id===a.task)&&typeof a.text==='string'&&typeof a.correct==='boolean'&&typeof a.assisted==='boolean'&&typeof a.modality==='string'&&Number.isFinite(Date.parse(a.at)))&&(!run.exposures||(Array.isArray(run.exposures)&&run.exposures.every(e=>e&&typeof e.text==='string'&&Number.isFinite(Date.parse(e.at)))));
}
