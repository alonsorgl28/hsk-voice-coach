import {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Check, Mic, MicOff, Pause, RotateCcw, Volume2, Snail, HelpCircle, Repeat, PhoneOff} from 'lucide-react';
import courseData from './course.json';
import curriculum from './curriculum.json';
import Gradient from './Gradient';
import useBrowserSpeech from './useBrowserSpeech';
import {createCourseRun, courseAttempt, courseNext, canAdvance, setSupport, restartRun, recordExposure, courseSession, validCourseRun, routeUtterance,
  phraseOf, phraseIndex, coachContext, stepOpening, resultUpdate, captionLine, reviewedIndex, wordsUpTo, deriveCourseProgress, goalStatus, normalizePinyin} from './course.mjs';
import {normalizeAnswer} from './progress.mjs';

export type Phrase = {id:string; hanzi:string; pinyin:string; es:string; prefix?:boolean; listed?:boolean};
export type Step = {id:string; kind:'teach'|'understand'|'respond'|'recall'; title:string; prompt:string; lines?:{who:string;phrase:string}[]; note?:string; ref?:string; cue?:string; answers?:string[]; support?:string; options?:string[]; choices?:string[]; answer?:string};
export type Lesson = {id:string; number:number; status:string; version:number; review?:boolean; title:{hanzi:string;pinyin:string;es:string}; objective:string; book:{printed:string;pdf:string;workbook?:string}; goals:{id:string;es:string;phrases:string[]}[]; words:{hanzi:string;pinyin:string;es:string}[]; phrases:Phrase[]; steps:Step[]};
export type Course = typeof courseData & {lessons:(Lesson|{id:string;number:number;status:string;title:Lesson['title'];objective:string;book:Lesson['book']})[]};
export const course = courseData as unknown as Course;
type Run = ReturnType<typeof createCourseRun>;
type Attempt = Run['attempts'][number];
type Message = {role:string; text:string; eventId?:number; control?:boolean; receivedAt?:string};
export type CourseCoach = {connected:boolean; starting:boolean; speaking:boolean; muted:boolean; error:string; messages:Message[];
  feedback:{kind:string;hanzi:string;pinyin:string;explanation:string;evidence?:string}[]; captions:Map<string,{hanzi:string;pinyin:string;es:string}>;
  start:(context:string)=>void; stop:()=>void; context:(text:string)=>void; control:(text:string)=>void; setMuted:(muted:boolean)=>void; getLevel:()=>number};

const HANZI_KEY = 'hsk-coach.hanzi.v1';
const KIND_LABEL = {teach:'Aprender', understand:'Entender', respond:'Responder', recall:'Recordar'};
const MODALITY = {transcript:'por voz (transcripción, sin evaluar tonos)', pinyin:'escrita en pinyin (sin evaluar tonos)', text:'escrita en caracteres', choice:'elegida entre opciones', 'listening-choice':'al escuchar', 'reading-choice':'leyendo el pinyin'} as Record<string,string>;
const allPhrases = phraseIndex(course) as Map<string,Phrase>;
const reviewed = reviewedIndex(course);
const safeGet = (key:string) => {try{return localStorage.getItem(key)}catch{return null}};
// Stable shuffle per run and step, so the right answer is not always in the same place.
const hash = (text:string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const mixed = <T,>(items:T[], seed:string, key:(item:T)=>string) => [...items].sort((a, b) => hash(seed + key(a)) - hash(seed + key(b)));

// Everything visible is pinyin + Spanish first. Characters are a secondary layer.
function PhraseView({phrase, hanzi, onPlay, size='m', disabled}:{phrase:Phrase; hanzi:boolean; onPlay?:()=>void; size?:'l'|'m'|'s'; disabled?:boolean}) {
  return <div className={`cphrase cphrase-${size}`}>
    {onPlay && <button className="play" aria-label={`Escuchar ${phrase.pinyin}`} disabled={disabled} onClick={onPlay}><Volume2 size={size==='s'?14:17}/></button>}
    <div>
      {hanzi && <span className="cphrase-zh" lang="zh">{phrase.hanzi}</span>}
      <b className="cphrase-py" lang="zh-Latn">{phrase.pinyin}</b>
      <span className="cphrase-es">{phrase.es}</span>
    </div>
  </div>;
}

export default function CourseLesson({lesson, resume, onSave, onClose, onNext, history, coach}:{lesson:Lesson; resume?:Run; onSave:(session:ReturnType<typeof courseSession>)=>void; onClose:()=>void; onNext?:()=>void; history:{learningEvents?:unknown[]}[]; coach:CourseCoach}) {
  const [run, setRun] = useState<Run>(() => resume && validCourseRun(resume, lesson) ? resume : createCourseRun(lesson));
  const runRef = useRef(run); runRef.current = run;
  const [hanzi, setHanzi] = useState(() => safeGet(HANZI_KEY) === '1');
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState(false);
  const [explain, setExplain] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [notice, setNotice] = useState('');
  // "Intentar otra vez" hides the last feedback without deleting the attempt.
  // Feedback is scoped to the current visit of the step: an answer from an earlier pass never shows here.
  const [dismissed, setDismissed] = useState(() => {
    const r = runRef.current, task = lesson.steps[r.index].id;
    const last = r.attempts.map(a => a.task).lastIndexOf(task);
    return r.passed && last >= 0 ? last : r.attempts.length;
  });
  const speech = useBrowserSpeech();
  const step = lesson.steps[run.index];
  const find = (id?:string) => id ? (phraseOf(lesson, id) || allPhrases.get(id)) as Phrase|undefined : undefined;
  const cue = find(step.cue);
  const support = find(step.support);
  const stepStart = useRef({messages: coach.messages.length, feedback: coach.feedback.length});
  const handled = useRef(new Set<string>());
  const appAudio = useRef<{start:number;end:number}[]>([]);
  const mutedRef = useRef(coach.muted); mutedRef.current = coach.muted;
  const announced = useRef('');
  const restarts = useRef(0);
  const carryNotice = useRef('');
  const mounted = useRef(false);
  const progress = useMemo(() => deriveCourseProgress(history as never, course, curriculum.reviewIntervalsDays), [history]);
  const words = useMemo(() => [...wordsUpTo(course, lesson), ...curriculum.words, ...curriculum.scaffolding], [lesson]);
  const lastAttempt: Attempt|undefined = run.attempts.slice(dismissed).filter(a => a.task === step.id).at(-1);

  function change(next:Run) {runRef.current = next; setRun(next); onSave(courseSession(next, lesson, course));}
  useEffect(() => {onSave(courseSession(runRef.current, lesson, course));}, []);

  // New step: clear everything that belonged to the previous one, so no stale correction is shown.
  useEffect(() => {
    stepStart.current = {messages: coach.messages.length, feedback: coach.feedback.length};
    if (mounted.current) setDismissed(runRef.current.attempts.length);
    mounted.current = true;
    setTyped(''); setHeard(false); setExplain(false); setShowOptions(false); setNotice(carryNotice.current); carryNotice.current = ''; speech.stop();
  }, [run.index, run.id]);

  // A new voice session starts with an empty transcript: read it from the beginning.
  useEffect(() => {if (coach.connected) {stepStart.current = {messages: 0, feedback: 0}; handled.current.clear();}}, [coach.connected]);

  // The app and the teacher run ONE class: on connect and on every step change she receives the same state.
  useEffect(() => {
    if (!coach.connected) {announced.current = ''; return;}
    const key = `${run.id}:${run.index}:${restarts.current}`;
    if (announced.current === key) return;
    const first = !announced.current;
    announced.current = key;
    // On connect the app already sent this context; wait for the short greeting to finish before opening the step.
    if (first) {const t = window.setTimeout(() => coach.control(stepOpening(lesson, runRef.current)), course.greetingWaitMs); return () => window.clearTimeout(t);}
    coach.context(coachContext(lesson, runRef.current, {course, progress})); coach.control(stepOpening(lesson, runRef.current));
  }, [coach.connected, run.index, run.id, restarts.current]);

  // ── Audio played by the app. The microphone is muted while it plays and the window is never graded. ──
  function play(phrase:Phrase|undefined, slow = false, after?:()=>void) {
    if (!phrase || phrase.prefix) {
      if (phrase?.prefix) setNotice('Esta frase se completa con tu nombre: «Wǒ jiào» + tu nombre.');
      return;
    }
    const window_ = {start: Date.now(), end: Number.POSITIVE_INFINITY};
    appAudio.current = [...appAudio.current.slice(-20), window_];
    const wasMuted = mutedRef.current;
    if (coach.connected && !wasMuted) coach.setMuted(true);
    speech.say(phrase.hanzi, slow ? course.browserVoiceSlowRate : course.browserVoiceRate, () => {
      setHeard(true);
      change(recordExposure(runRef.current, phrase.id, {modality: 'listening'}));
      after?.();
    }, () => {
      window_.end = Date.now() + course.appAudioTailMs;
      if (coach.connected && !wasMuted) window.setTimeout(() => coach.setMuted(false), 300);
    });
  }
  function playDialog() {
    const lines = (step.lines || []).map(l => find(l.phrase)).filter(Boolean) as Phrase[];
    const next = (i:number) => {if (i < lines.length) play(lines[i], false, () => window.setTimeout(() => next(i + 1), 450));};
    next(0);
  }
  const focusPhrase = cue || support || find(step.lines?.[0]?.phrase);

  // ── Answers ──
  function submit(text:string, modality:string) {
    if (runRef.current.ended || !text.trim()) return;
    if (step.kind !== 'teach' && step.kind !== 'understand' && runRef.current.passed) return;
    const answers = (step.answers || []).map(find).filter(Boolean) as Phrase[];
    const since = coach.messages.slice(stepStart.current.messages);
    const teacherModeled = coach.connected && since.some(m => m.role === 'agent' && answers.some(a => !a.prefix && normalizeAnswer(m.text).includes(normalizeAnswer(a.hanzi))));
    let next = courseAttempt(runRef.current, lesson, text, {modality, teacherModeled});
    const attempt = next.attempts.at(-1)!;
    // A correction reveals the model: from here on, this step counts as assisted.
    if (!attempt.correct && step.kind !== 'teach') next = {...next, supportUsed: true};
    change(next); setTyped(''); setNotice('');
    if (coach.connected && modality !== 'transcript' && step.kind !== 'teach') {
      coach.context(resultUpdate(step, attempt, lesson));
      coach.control(`(Mensaje de la app) Respondí ${modality === 'pinyin' ? 'por escrito' : 'eligiendo una opción'}: «${text}».`);
    } else if (coach.connected && step.kind !== 'teach') coach.context(resultUpdate(step, attempt, lesson));
  }
  function advance(skip = false) {
    try {speech.stop(); change(courseNext(runRef.current, lesson, {skip}));}
    catch (e) {setNotice(e instanceof Error ? e.message : 'No se pudo avanzar.');}
  }
  function toggleSupport(visible:boolean) {
    change(setSupport(runRef.current, visible));
    if (coach.connected) coach.context(visible ? 'El estudiante pidió ver el apoyo en pantalla.' : 'El estudiante retiró el apoyo: no le des la respuesta salvo que la pida.');
  }
  function command(kind:string, fromVoice = false) {
    if (kind === 'restart') {speech.stop(); restarts.current++; const message = 'Volvimos al principio de la lección. Lo que ya practicaste sigue guardado.'; if (runRef.current.index === 0) setNotice(message); else carryNotice.current = message; change(restartRun(runRef.current, lesson)); return;}
    if (kind === 'next') {if (canAdvance(runRef.current, lesson)) advance(); return;}
    if (kind === 'explain') setExplain(true);
    if (kind === 'wait') speech.stop();
    if (fromVoice) return; // The teacher heard it herself.
    if (coach.connected) {
      const text = {wait:'Espera, necesito un momento. No digas nada hasta que yo vuelva a hablar.', repeat:'Repite exactamente tu última frase, sin cambiar palabras y sin añadir otra pregunta.', slow:'Repite esa misma frase más despacio. Después espera mi respuesta.', explain:'No entendí. Explícame en español, en una frase, qué significa tu última frase.'}[kind];
      if (text) coach.control(text);
    } else if (kind === 'repeat') play(focusPhrase);
    else if (kind === 'slow') play(focusPhrase, true);
  }

  // ── Voice transcripts: commands, talk or attempts. ──
  useEffect(() => {
    if (!coach.connected) return;
    const pool = [...(step.answers || []), ...(step.lines || []).map(l => l.phrase)].map(find).filter(Boolean) as Phrase[];
    for (const [i, m] of coach.messages.entries()) {
      if (i < stepStart.current.messages) continue;
      const key = m.eventId === undefined ? `${i}:${m.text}` : `${m.role}:${m.eventId}`;
      if (m.role !== 'user' || m.control || handled.current.has(key)) continue;
      handled.current.add(key);
      const route = routeUtterance(m.text, pool, {at: m.receivedAt, appAudio: appAudio.current});
      if (route.type === 'command') command(route.command, true);
      else if (route.type === 'attempt' && step.kind !== 'understand') submit(m.text, 'transcript');
      else if (route.reason === 'app-audio') setNotice('Se ignoró lo que el micrófono captó mientras sonaba el audio de la app.');
    }
  }, [coach.messages, coach.connected]);

  function close() {speech.stop(); if (coach.connected) coach.stop(); onClose();}

  // ── Teacher line, captioned with reviewed pinyin and Spanish. ──
  // Empty turns ("...") never replace the last useful line: you keep what she said until she says something new.
  const lastTeacher = coach.connected ? coach.messages.filter(m => m.role === 'agent' && /[\p{L}\p{Script=Han}]/u.test(m.text)).at(-1)?.text : undefined;
  const caption = lastTeacher ? captionLine(lastTeacher, {reviewed, agent: coach.captions, words}) : [];
  const correction = coach.feedback.slice(stepStart.current.feedback).filter(f => f.kind === 'correction').at(-1);
  const taught = lesson.steps.slice(0, run.index + 1).flatMap(s => (s.lines || []).map(l => l.phrase));
  const listPhrases = [...new Set([...taught, ...(step.cue ? [step.cue] : []), ...(run.supportVisible && step.support ? [step.support] : [])])].map(find).filter(p => p && p.listed !== false) as Phrase[];
  const noAudio = !speech.available;
  const voiceStatus = coach.starting ? 'Conectando con la profesora…' : coach.connected ? (coach.speaking ? 'La profesora habla' : coach.muted ? 'Micrófono en pausa' : 'Te escucho. Responde en voz alta cuando quieras.') : 'Profesora de voz desconectada. Puedes seguir con audio del navegador, opciones o pinyin.';

  if (run.ended) {
    const done = deriveCourseProgress([...history, courseSession(run, lesson, course)] as never, course, curriculum.reviewIntervalsDays);
    return <div className="course-shell">
      <header className="course-head"><button className="text-button" onClick={close}><ArrowLeft size={15}/> Volver a la ruta</button><span>Lección {lesson.number}{lesson.review ? ' · repaso' : ''}</span></header>
      <section className="course-done">
        <Gradient state="idle" getLevel={() => 0} size={96}/>
        <p className="eyebrow">Lección guardada</p>
        <h1>{lesson.review ? 'Repaso terminado.' : 'Ya puedes tener este intercambio.'}</h1>
        <div className="goal-list">{lesson.goals.map(g => {const s = goalStatus(g, done); return <p key={g.id}><b>{g.es}</b><span className={`stage stage-${s.stage}`}>{s.label}</span></p>;})}</div>
        <div className="cphrase-list">{lesson.phrases.filter(p => p.listed !== false).map(p => <PhraseView key={p.id} phrase={p} hanzi={hanzi} size="s" onPlay={p.prefix ? undefined : () => play(p)}/>)}</div>
        <p className="microcopy">«Dicha con apoyo» significa que la dijiste con el modelo reciente o visible. «Usada sin modelo» solo cuenta en los pasos de recordar sin ayuda. Ninguna marca evalúa tonos ni pronunciación. El repaso aparecerá otro día.</p>
        <div className="course-actions">{onNext && !lesson.review && <button className="primary" onClick={() => {speech.stop(); if (coach.connected) coach.stop(); onNext();}}>Siguiente lección <ArrowRight size={16}/></button>}<button className="ghost" onClick={close}>Volver a la ruta</button></div>
      </section>
    </div>;
  }

  return <div className="course-shell">
    <header className="course-head">
      <button className="text-button" onClick={close}><ArrowLeft size={15}/> Guardar y salir</button>
      <span className="course-title">Lección {lesson.number}{lesson.review ? ' · repaso' : ''} · {lesson.title.pinyin} · {lesson.title.es}</span>
      <button className={hanzi ? 'ghost on hanzi-toggle' : 'ghost hanzi-toggle'} aria-pressed={hanzi} onClick={() => {const v = !hanzi; setHanzi(v); try {localStorage.setItem(HANZI_KEY, v ? '1' : '0')} catch {/* preferencia no crítica */}}}>{hanzi ? 'Ocultar caracteres' : 'Ver caracteres'}</button>
    </header>
    <div className="course-progress" role="progressbar" aria-valuemin={1} aria-valuemax={lesson.steps.length} aria-valuenow={run.index + 1} aria-label="Avance de la lección">{lesson.steps.map((s, i) => <span key={s.id} className={i < run.index ? 'done' : i === run.index ? 'now' : ''}/>)}</div>

    <section className="teacher" aria-live="polite">
      <div className="teacher-row">
        <Gradient state={speech.speaking || coach.speaking ? 'speaking' : coach.connected ? 'listening' : 'idle'} getLevel={coach.connected ? coach.getLevel : () => 0} size={56}/>
        <div className="teacher-status"><b>Tu profesora</b><span>{voiceStatus}</span></div>
        {coach.connected
          ? <div className="teacher-actions"><button className="ghost" onClick={() => coach.setMuted(!coach.muted)}>{coach.muted ? <MicOff size={15}/> : <Mic size={15}/>} {coach.muted ? 'Activar micrófono' : 'Pausar micrófono'}</button><button className="ghost" onClick={coach.stop}><PhoneOff size={15}/> Terminar voz</button></div>
          : <button className="primary" disabled={coach.starting} onClick={() => {speech.stop(); coach.start(coachContext(lesson, runRef.current, {course, progress}));}}><Mic size={16}/> {coach.starting ? 'Conectando…' : 'Practicar con la profesora'}</button>}
      </div>
      {coach.error && <p className="error" role="alert">{coach.error} La lección sigue funcionando sin voz.</p>}
      {caption.length > 0 && <div className="teacher-line">{caption.map((part, i) => part.type === 'es'
        ? <p key={i} className="tl-es">{part.text}</p>
        : <div key={i} className="tl-zh">{hanzi && <span lang="zh">{part.hanzi}</span>}{part.pinyin ? <b>{part.pinyin}</b> : null}{part.es ? <small>{part.es}</small> : <small className="tl-missing">{part.pinyin ? 'Pinyin por palabras · sin traducción revisada. Dile «no entendí».' : 'Sin pinyin ni traducción revisados. Dile «no entendí» o «repite».'}</small>}</div>)}</div>}
      <div className="commands" aria-label="Control de la clase">
        <button className="chip" onClick={() => command('wait')}><Pause size={13}/> Espera</button>
        <button className="chip" disabled={coach.speaking || (!coach.connected && noAudio)} onClick={() => command('repeat')}><Repeat size={13}/> Repite</button>
        <button className="chip" disabled={coach.speaking || (!coach.connected && noAudio)} onClick={() => command('slow')}><Snail size={13}/> Más lento</button>
        <button className="chip" onClick={() => command('explain')}><HelpCircle size={13}/> No entendí</button>
        <button className="chip" onClick={() => command('restart')}><RotateCcw size={13}/> Al principio</button>
      </div>
    </section>

    <main className="course-step">
      <p className="eyebrow">{KIND_LABEL[step.kind]} · paso {run.index + 1} de {lesson.steps.length}</p>
      <h1>{step.prompt}</h1>
      {noAudio && <p className="lesson-notice">Este navegador no tiene voz en mandarín. Lee el pinyin en voz alta; puedes seguir con opciones o escribiendo. {coach.connected ? '' : 'La profesora de voz sí tiene audio.'}</p>}
      {speech.error && !noAudio && <p className="lesson-notice" role="status">{speech.error}</p>}

      {step.kind === 'teach' && <>
        <div className="dialog">{(step.lines || []).map((l, i) => {const p = find(l.phrase)!; return <div key={i} className="dialog-line"><span className="who">{l.who}</span><PhraseView phrase={p} hanzi={hanzi} size="l" disabled={speech.speaking || coach.speaking} onPlay={() => play(p)}/></div>;})}</div>
        <div className="step-tools"><button className="ghost" disabled={speech.speaking || coach.speaking || noAudio} onClick={playDialog}><Volume2 size={15}/> Escuchar el diálogo</button><button className="ghost" disabled={speech.speaking || coach.speaking || noAudio} onClick={() => play(find(step.lines?.at(-1)?.phrase), true)}><Snail size={15}/> Respuesta más lenta</button></div>
        {step.note && <p className="note">{step.note}</p>}
        <p className="microcopy">Repite cada frase en voz alta. {coach.connected ? 'La profesora te escucha; repetir no se cuenta como dominio.' : 'Sin micrófono no se registra tu voz; es práctica libre.'}</p>
      </>}

      {step.kind === 'understand' && cue && <>
        <div className="cue">
          <button className="play play-big" aria-label="Escuchar la frase" disabled={speech.speaking || coach.speaking || noAudio} onClick={() => play(cue)}><Volume2 size={22}/></button>
          <div>{hanzi && <span className="cphrase-zh" lang="zh">{cue.hanzi}</span>}{(heard || noAudio || run.passed) ? <b className="cphrase-py">{cue.pinyin}</b> : <b className="cphrase-py muted">Escucha primero</b>}{run.passed && <span className="cphrase-es">{cue.es}</span>}</div>
        </div>
        {!heard && !noAudio && !run.passed && <button className="text-button" onClick={() => setHeard(true)}>No puedo escuchar ahora: leer el pinyin</button>}
        <div className="options">{mixed(step.choices || [], run.id + step.id, c => c).map(choice => <button key={choice} className={'option' + (run.passed && choice === step.answer ? ' right' : '')} disabled={run.passed} onClick={() => submit(choice, speech.speaking || runRef.current.exposures.some(e => e.phrase === cue.id) ? 'listening-choice' : 'reading-choice')}>{choice}</button>)}</div>
      </>}

      {(step.kind === 'respond' || step.kind === 'recall') && <>
        {cue && <div className="cue"><span className="who">Ella</span><PhraseView phrase={cue} hanzi={hanzi} size="l" disabled={speech.speaking || coach.speaking} onPlay={() => play(cue)}/></div>}
        <div className="answer">
          <p className="answer-label">Tu respuesta</p>
          {run.supportVisible && support
            ? <div className="support"><PhraseView phrase={support} hanzi={hanzi} size="l" disabled={speech.speaking || coach.speaking} onPlay={support.prefix ? undefined : () => play(support)}/><button className="text-button" onClick={() => toggleSupport(false)}>Quitar apoyo, ya puedo</button></div>
            : <button className="ghost" onClick={() => toggleSupport(true)}>{step.kind === 'recall' ? 'No me acuerdo: ver la frase' : 'Mostrar apoyo'}</button>}
          {run.supportUsed && !run.supportVisible && <p className="microcopy">Retiraste el apoyo. Ya lo viste en este paso, así que la respuesta se guarda como «con apoyo».</p>}
          {!run.passed && <>
            <p className="microcopy">{coach.connected ? 'Dilo en voz alta. También puedes elegir o escribir en pinyin.' : 'Dilo en voz alta para practicar y después elige o escribe en pinyin para comprobar.'}</p>
            {(step.kind === 'respond' || showOptions)
              ? <div className="options">{mixed(step.options || [], run.id + step.id, id => id).map(id => {const p = find(id)!; return <button key={id} className="option" onClick={() => submit(p.prefix ? p.pinyin.replace('…', '(tu nombre)') : p.hanzi, 'choice')}><b>{p.pinyin}</b><small>{p.es}</small></button>;})}</div>
              : <button className="text-button" onClick={() => setShowOptions(true)}>Elegir entre opciones</button>}
            <form className="pinyin-form" onSubmit={e => {e.preventDefault(); const value = typed.trim(); if (value) submit(value, /\p{Script=Han}/u.test(value) ? 'text' : 'pinyin');}}>
              <label htmlFor="pinyin-answer">O escríbelo en pinyin</label>
              <div><input id="pinyin-answer" value={typed} maxLength={200} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={support?.prefix ? 'wo jiao + tu nombre' : 'por ejemplo: ni hao'} onChange={e => setTyped(e.target.value)}/><button className="primary" disabled={!normalizePinyin(typed) && !/\p{Script=Han}/u.test(typed)}>Comprobar <Check size={15}/></button></div>
              <small>Sin tonos también vale: al escribir no se evalúan los tonos.</small>
            </form>
          </>}
        </div>
      </>}

      {lastAttempt && step.kind !== 'teach' && <FeedbackBox attempt={lastAttempt} step={step} expected={step.kind === 'understand' ? undefined : support} passed={run.passed} hanzi={hanzi}
        onRetry={() => setDismissed(runRef.current.attempts.length)} onHelp={() => toggleSupport(true)} onSkip={step.kind === 'recall' && !run.passed ? () => advance(true) : undefined}/>}
      {step.kind !== 'teach' && lastAttempt === undefined && step.kind === 'recall' && <button className="text-button" onClick={() => advance(true)}>Aún no lo recuerdo: repasarlo otro día</button>}
      {correction && <aside className="lesson-correction"><span className="eyebrow">Una corrección de la profesora</span><p><b>{correction.pinyin}</b></p>{hanzi && <p lang="zh">{correction.hanzi}</p>}<p>{correction.explanation}</p>{correction.evidence && <small>Tu frase: {correction.evidence}</small>}</aside>}
      {explain && focusPhrase && <aside className="explain"><span className="eyebrow">Qué significa</span><PhraseView phrase={focusPhrase} hanzi={hanzi} size="m"/>{step.note && <p>{step.note}</p>}<button className="text-button" onClick={() => setExplain(false)}>Entendido</button></aside>}
      {notice && <p className="lesson-notice" role="status">{notice}</p>}

      <div className="course-actions">
        <button className="primary" disabled={!canAdvance(run, lesson)} onClick={() => advance()}>{run.index === lesson.steps.length - 1 ? 'Terminar la lección' : step.kind === 'teach' ? 'Entendido, sigamos' : 'Siguiente'} <ArrowRight size={16}/></button>
        {!run.passed && step.kind !== 'teach' && <span className="microcopy">{step.kind === 'understand' ? 'Elige una opción para seguir.' : 'Responde por voz, elige o escribe para seguir.'}</span>}
      </div>
      {step.ref && <p className="book-ref">Libro: lección {lesson.number}, {step.ref}. Ejercicio propio basado en esa sección.</p>}
    </main>

    {listPhrases.length > 0 && <section className="exchange">
      <p className="eyebrow">Frases de este intercambio</p>
      <div className="cphrase-list">{listPhrases.map(p => <PhraseView key={p.id} phrase={p} hanzi={hanzi} size="s" disabled={speech.speaking || coach.speaking || noAudio} onPlay={p.prefix ? undefined : () => play(p)}/>)}</div>
    </section>}
  </div>;
}

function FeedbackBox({attempt, step, expected, passed, hanzi, onRetry, onHelp, onSkip}:{attempt:Attempt; step:Step; expected?:Phrase; passed:boolean; hanzi:boolean; onRetry:()=>void; onHelp:()=>void; onSkip?:()=>void}) {
  if (attempt.correct || passed) return <div className="feedback-box ok" role="status"><Check size={16}/><div>
    <b>{step.kind === 'understand' ? 'Eso es.' : 'Coincide con una respuesta prevista.'}</b>
    <span>Respuesta {MODALITY[attempt.modality] || attempt.modality}{attempt.assisted && step.kind !== 'understand' ? ', con apoyo' : ''}.</span>
  </div></div>;
  return <div className="feedback-box retry" role="status"><div>
    <b>{step.kind === 'understand' ? 'No es eso.' : 'Aún no coincide.'}</b>
    {step.kind === 'understand'
      ? <span>Escúchala otra vez y vuelve a elegir.</span>
      : <span>Escribiste o dijiste «{attempt.text}». Se esperaba algo como: {expected && <>{hanzi && <i lang="zh">{expected.hanzi} · </i>}<b>{expected.pinyin}</b> — {expected.es}</>}</span>}
    <div className="feedback-actions"><button className="ghost" onClick={onRetry}>Intentar otra vez</button>{step.kind !== 'understand' && <button className="ghost" onClick={onHelp}>Seguir con ayuda</button>}{onSkip && <button className="text-button" onClick={onSkip}>Repasarlo otro día</button>}</div>
  </div></div>;
}

