import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Lightbulb,Volume2,Eye,EyeOff,Mic,MicOff} from 'lucide-react';
import curriculum from './curriculum.json';
import lessons from './lessons.json';
import {createRun,recordAttempt,nextStep,lessonSession,validRun,normalizeAnswer} from './progress.mjs';
import Gradient from './Gradient';
import useBrowserSpeech from './useBrowserSpeech';

type Lesson=typeof lessons.lessons[number];
type Run=ReturnType<typeof createRun>;
type Coach={phrase?:React.ReactNode;phraseText?:string;connected:boolean;starting:boolean;speaking:boolean;muted:boolean;messages:{role:string;text:string;eventId?:number;control?:boolean}[];feedback:{kind:string;hanzi:string;pinyin:string;explanation:string;evidence?:string}[];error:string;start:(context:string)=>void;stop:()=>void;context:(text:string)=>void;mute:()=>void;getLevel:()=>number};
export default function GuidedLesson({resume,onSave,onClose,coach}:{resume?:Run;onSave:(session:ReturnType<typeof lessonSession>)=>void;onClose:()=>void;coach:Coach}) {
  const lesson:Lesson=lessons.lessons.find(l=>l.id===resume?.lessonId)||lessons.lessons[0];
  const [run,setRun]=useState<Run>(()=>validRun(resume,lesson)?resume!:createRun(lesson));
  const runRef=useRef(run);runRef.current=run;
  const [text,setText]=useState('');
  const [notice,setNotice]=useState('');
  const [pinyin,setPinyin]=useState(false);
  const [meaning,setMeaning]=useState(false);
  const [heard,setHeard]=useState(false);
  const [reading,setReading]=useState(false);
  const [tone,setTone]=useState(false);
  const [toneTarget]=useState(()=>Math.floor(Math.random()*lessons.toneExercise.choices.length));
  const [toneHeard,setToneHeard]=useState(false);
  const [toneFeedback,setToneFeedback]=useState('');
  const speech=useBrowserSpeech();
  const handled=useRef(new Set<unknown>());
  const stageMessageStart=useRef(coach.messages.length);
  const step=lesson.steps[run.index];
  useEffect(()=>{onSave(lessonSession(runRef.current,lesson,curriculum));},[]);
  const model=('model' in step&&step.model)||step.audio;
  const modelPinyin=('modelPinyin' in step&&step.modelPinyin)||step.pinyin;
  const modelMeaning=('modelMeaning' in step&&step.modelMeaning)||step.meaning;
  const visible=run.modelVisible;
  function change(next:Run){runRef.current=next;setRun(next);onSave(lessonSession(next,lesson,curriculum));}
  function submit(value:string,modality='text') {
    if(runRef.current.ended||!value.trim())return;
    if(step.kind==='listen'&&!heard&&!reading){setNotice('Escucha primero o elige la alternativa de lectura.');return;}
    const teacherSupplied=coach.connected&&(coach.messages.slice(stageMessageStart.current).some(m=>m.role==='agent'&&step.answers.some(answer=>normalizeAnswer(m.text).includes(normalizeAnswer(answer))))||step.answers.some(answer=>normalizeAnswer(coach.phraseText||'').includes(normalizeAnswer(answer))));
    const attempted=teacherSupplied?{...runRef.current,hintCount:runRef.current.hintCount+1}:runRef.current;
    const next=recordAttempt(attempted,lesson,value,{modality});
    change(next);setText('');
    setNotice(next.passed?(modality==='transcript'?'La transcripción coincide. No es una evaluación de tonos.':step.kind==='listen'?'Has identificado la intención.':'La frase coincide con una respuesta de este ejercicio.'):'Esta respuesta no coincide con las frases previstas. Prueba otra vez o pide una pista; no estamos evaluando tu pronunciación.');
  }
  useEffect(()=>{
    if(!coach.connected){handled.current.clear();return;}
    for(const m of coach.messages){
      const key=m.eventId===undefined?m:m.role+':'+m.eventId;
      if(m.role!=='user'||m.control||handled.current.has(key))continue;
      handled.current.add(key);
      if(step.kind!=='listen'&&!runRef.current.passed)submit(m.text,'transcript');
    }
  },[coach.messages,coach.connected]);
  useEffect(()=>{
    stageMessageStart.current=coach.messages.length;
    setText('');setNotice('');setHeard(false);setReading(false);setMeaning(false);setPinyin(false);speech.stop();
    coach.context(`Etapa de práctica guiada: ${step.label}. Objetivo: ${step.prompt}. Pregunta/modelo del ejercicio: ${step.kind==='talk'?step.audio:'No des la respuesta antes del intento'}. Espera la respuesta del estudiante; la app controla el avance. No anuncies dominio ni califiques tonos.`);
  },[run.index]);
  function play(slow=false){
    if(coach.connected&&!coach.muted){setNotice('Silencia el micrófono de ElevenLabs antes de reproducir el modelo del navegador. Así evitamos registrar la voz del modelo como tu respuesta.');return;}
    if(coach.connected){coach.context(`El estudiante solicita repetir la frase de esta etapa: ${step.audio}. Espera su siguiente mensaje.`);setNotice('Para repetir con la profesora, pídeselo por voz. El botón de audio reproduce el modelo con la voz del navegador.');}
    if(step.kind!=='listen')change({...runRef.current,modelVisible:true});
    const index=run.index;speech.say(step.kind==='talk'?step.audio:model,slow?lessons.browserVoiceSlowRate:lessons.browserVoiceRate,()=>{if(runRef.current.index===index){setHeard(true);change({...runRef.current,exposures:[...(runRef.current.exposures||[]),{text:step.kind==='talk'?step.audio:model,at:new Date().toISOString()}]})}});
  }
  function advance(skip=false){try{speech.stop();change(nextStep(runRef.current,lesson,skip));}catch(e){setNotice(e instanceof Error?e.message:'No se pudo avanzar.')}}
  function close(){speech.stop();coach.stop();onClose()}
  const currentFeedback=coach.feedback.filter(f=>f.kind==='correction').at(-1);
  const lastTeacher=coach.messages.filter(m=>m.role==='agent').at(-1)?.text;
  if(run.ended)return <div className="lesson-shell"><button className="text-button" onClick={close}><ArrowLeft size={15}/> Volver a mi práctica</button><section className="lesson-finished"><Gradient state="idle" getLevel={()=>0} size={150}/><p className="eyebrow">Lección guardada</p><h1>Una frase que puedes volver a usar.</h1><p>Has completado los ejercicios de «{lesson.title}». Tu cuaderno conserva las respuestas y la ayuda utilizada.</p><div className="lesson-summary">{run.attempts.filter(a=>a.correct).map((a,i)=><p key={i}><span lang="zh">{a.text}</span><small>{a.modality==='transcript'?'Transcripción de voz':a.modality==='listening'?'Reconocimiento al escuchar':a.modality==='reading'?'Reconocimiento al leer':'Respuesta escrita'} · {a.assisted?'con ayuda':'sin modelo visible'}</small></p>)}</div><p className="microcopy">Completar una lección no certifica fluidez ni pronunciación. Mañana se podrá comprobar qué recuerdas antes de repasar.</p><button className="primary" onClick={close}>Volver al inicio <ArrowRight size={16}/></button></section></div>;
  return <div className="lesson-shell">
    <header className="lesson-header"><button className="text-button" onClick={close}><ArrowLeft size={15}/> Guardar y salir</button><span>HSK {lesson.level} · {lesson.title}</span></header>
    <nav className="lesson-steps" aria-label="Etapas de la lección">{lesson.steps.map((s,i)=><span key={s.id} aria-current={i===run.index?'step':undefined} className={i<run.index?'done':''}><b>{i<run.index?'✓':String(i+1).padStart(2,'0')}</b> {s.label}</span>)}</nav>
    <section className="guided-room">
      <p className="lesson-objective">{lesson.objective}</p>
      <Gradient state={speech.speaking||coach.speaking?'speaking':coach.connected?'listening':'idle'} getLevel={coach.connected?coach.getLevel:()=>0} size={185}/>
      <p className="eyebrow">{run.index===0&&!resume?'Punto de partida':step.label} · {run.index+1} de {lesson.steps.length}</p>
      <h1>{step.prompt}</h1>
      {(visible||step.kind==='talk')&&<div className="lesson-model"><p lang="zh">{step.kind==='talk'&&!visible?step.audio:model}</p>{pinyin&&<span>{step.kind==='talk'&&!visible?step.pinyin:modelPinyin}</span>}{meaning&&<small>{step.kind==='talk'&&!visible?step.meaning:modelMeaning}</small>}</div>}
      <div className="lesson-tools">
        <button className="ghost" disabled={speech.speaking||coach.speaking} onClick={()=>play()}><Volume2 size={15}/> {speech.speaking?'Reproduciendo…':'Escuchar'}</button>
        <button className="ghost" disabled={speech.speaking||coach.speaking} onClick={()=>play(true)}>Más lento</button>
        <button className="ghost" aria-pressed={visible} onClick={()=>change({...runRef.current,modelVisible:!run.modelVisible,hintCount:run.hintCount+1})}>{visible?<EyeOff size={15}/>:<Eye size={15}/>} {visible?'Ocultar modelo':'Ver modelo'}</button>
        <button className="ghost" aria-pressed={pinyin} onClick={()=>{setPinyin(!pinyin);change({...runRef.current,modelVisible:true,hintCount:run.hintCount+1})}}>Pinyin</button>
        <button className="ghost" aria-pressed={meaning} onClick={()=>{setMeaning(!meaning);change({...runRef.current,modelVisible:true,hintCount:run.hintCount+1})}}>Significado</button>
      </div>
      <p className="microcopy">Audio del navegador en mandarín. Para conversar por voz, conecta tu profesora abajo.</p>
      {speech.error&&<p role="status" className="lesson-notice">{speech.error}</p>}
      {step.kind==='listen'&&<>
        {!heard&&!reading&&<button className="text-button" onClick={()=>{setReading(true);change({...runRef.current,modelVisible:true,hintCount:run.hintCount+1})}}>No tengo audio: practicar lectura</button>}
        <div className="lesson-choices">{'choices' in step&&step.choices?.map(choice=><button className="ghost" key={choice} disabled={run.passed||(!heard&&!reading)} onClick={()=>submit(choice,reading?'reading':'listening')}>{choice}</button>)}</div>
      </>}
      {step.kind!=='listen'&&<form className="lesson-answer" onSubmit={e=>{e.preventDefault();submit(text)}}><label htmlFor="lesson-answer">Tu respuesta en chino</label><div><input id="lesson-answer" placeholder="Escribe tu frase…" value={text} maxLength={1000} disabled={run.passed} onChange={e=>setText(e.target.value)}/><button className="primary" disabled={!text.trim()||run.passed} type="submit">Comprobar <Check size={15}/></button></div></form>}
      {run.hintCount>0&&!run.passed&&<p className="lesson-hint">{step.hints[Math.min(run.hintCount-1,step.hints.length-1)]}</p>}
      {!run.passed&&<button className="text-button" onClick={()=>change({...runRef.current,hintCount:run.hintCount+1})}><Lightbulb size={15}/> {run.hintCount?'Otra pista':'Necesito una pista'}</button>}
      {notice&&<p role="status" className={'lesson-notice '+(run.passed?'success':'')}>{notice}</p>}
      {currentFeedback&&<aside className="lesson-correction"><span className="eyebrow">Una corrección</span><p>Tu frase: {currentFeedback.evidence}</p><p lang="zh">{currentFeedback.hanzi}</p><p>{currentFeedback.pinyin}</p><p>{currentFeedback.explanation}</p></aside>}
      <div className="lesson-next"><button className="primary" disabled={!run.passed} onClick={()=>advance()}>{run.index===lesson.steps.length-1?'Terminar y guardar':'Siguiente ejercicio'} <ArrowRight size={16}/></button>{'allowSkip' in step&&step.allowSkip&&!run.passed&&<button className="text-button" onClick={()=>advance(true)}>Necesito aprenderlo primero</button>}</div>
    </section>
    <aside className="lesson-coach"><div><strong>Conversar con mi profesora</strong><p>ElevenLabs · usa créditos de tu cuenta y envía tu voz a la plataforma.</p></div>{coach.connected?<div className="lesson-tools"><button className="ghost" onClick={coach.mute}>{coach.muted?<MicOff size={15}/>:<Mic size={15}/>} {coach.muted?'Activar micrófono':'Silenciar'}</button><button className="text-button" onClick={coach.stop}>Desconectar</button></div>:<button className="ghost" disabled={coach.starting} onClick={()=>{speech.stop();coach.start(`Práctica guiada: ${lesson.title}. Etapa ${step.label}. ${step.prompt}. ${lesson.objective}. Haz una sola pregunta corta y espera; la app decide cuándo avanzar.`)}}><Mic size={15}/> {coach.starting?'Conectando…':'Conectar voz'}</button>}
      {coach.error&&<p className="error" role="alert">{coach.error}</p>}{coach.connected&&lastTeacher&&<p className="coach-caption">{lastTeacher}</p>}{coach.phrase}
    </aside>
    <details className="tone-practice" onToggle={e=>{if(!(e.currentTarget as HTMLDetailsElement).open){speech.stop();setTone(false)}else setTone(true)}}><summary>Afinar el oído · hē / hé</summary>{tone&&<><p>{lessons.toneExercise.prompt} La voz del navegador es un apoyo, no una referencia de evaluación acústica.</p><button className="ghost" disabled={speech.speaking||coach.speaking||(coach.connected&&!coach.muted)} onClick={()=>{setToneFeedback('');speech.say(lessons.toneExercise.choices[toneTarget].hanzi,lessons.browserVoiceRate,()=>setToneHeard(true))}}><Volume2 size={15}/> Escuchar palabra</button><div className="lesson-choices">{lessons.toneExercise.choices.map((choice,i)=><button className="ghost" key={choice.hanzi} disabled={!toneHeard} onClick={()=>setToneFeedback(i===toneTarget?'Coincide con el modelo reproducido. Prueba a repetirlo; aquí no se evalúa tu pronunciación.':'El modelo era '+lessons.toneExercise.choices[toneTarget].pinyin+'. Escúchalo de nuevo y compara.')}><span lang="zh">{choice.hanzi}</span> {choice.pinyin} · {choice.es}</button>)}</div><p role="status">{toneFeedback}</p></>}</details>
  </div>;
}
