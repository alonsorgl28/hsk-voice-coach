import { useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { ArrowRight, AudioLines, BookOpen, Check, ChevronDown, Download, Headphones, Mic, MicOff, Settings, Square, X } from 'lucide-react';
import curriculum from './curriculum.json';
import { makePlan, readHistory, upsertSession, validateLearningEvent } from './learning.mjs';

type Message = {role:'user'|'agent'; text:string; eventId?:number};
type Word = typeof curriculum.words[number];
type Feedback = {kind:'lesson'|'correction'; hanzi:string; pinyin:string; explanation:string; evidence?:string};
type Summary = {kind:'summary'; practiced:string[]; errors:Feedback[]; recommendation:string; homework:string; completed:boolean};
type Session = {id:string; conversationId?:string; date:string; level:number; topic:string; mode:'voice'|'text'; duration:number; messages:Message[]; feedback:Feedback[]; practiced:string[]; summary?:Summary; ended:boolean};
const HISTORY_KEY = 'hsk-coach.sessions.v1';
const AGENT_KEY = 'hsk-coach.agent.v1';
const safeGet = (key:string) => {try{return localStorage.getItem(key) || ''}catch{return ''}};
const time = (seconds:number) => `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;

export default function App() {
  const [history,setHistory] = useState<Session[]>(() => readHistory(localStorage,HISTORY_KEY));
  const [agentId,setAgentId] = useState(safeGet(AGENT_KEY) || import.meta.env.VITE_ELEVENLABS_AGENT_ID || '');
  const [configOpen,setConfigOpen] = useState(false);
  const [level,setLevel] = useState(1);
  const [topicId,setTopicId] = useState('introductions');
  const [view,setView] = useState<'practice'|'notebook'>('practice');
  const [mode,setMode] = useState<'voice'|'text'>('voice');
  const [active,setActive] = useState<Session|null>(null);
  const [selected,setSelected] = useState<Session|null>(null);
  const [error,setError] = useState('');
  const [storageError,setStorageError] = useState('');
  const [text,setText] = useState('');
  const [seconds,setSeconds] = useState(0);
  const [starting,setStarting] = useState(false);
  const [closing,setClosing] = useState(false);
  const [demo,setDemo] = useState(false);
  const session = useRef<Session|null>(null);
  const historyRef = useRef(history);
  const startedAt = useRef(0);
  const plan = makePlan(curriculum,level,topicId,history);
  const planRef = useRef(plan);
  const closingAt = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const startLock = useRef(false);

  function save(patch:Partial<Session>) {
    if (!session.current) return;
    const updated = {...session.current,...patch,duration:startedAt.current ? Math.max(0,Math.floor((Date.now()-startedAt.current)/1000)) : 0};
    session.current=updated; setActive(updated);
    if (!updated.messages.length) return;
    const next = upsertSession(historyRef.current,updated,curriculum.historyLimit) as Session[];
    historyRef.current=next; setHistory(next);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(next));setStorageError('')}catch{setStorageError('El navegador no pudo guardar la sesión. Descarga tu cuaderno antes de cerrar.');}
  }

  const conversation = useConversation({
    onConnect:({conversationId}) => {startedAt.current=Date.now();save({conversationId});setStarting(false)},
    onMessage:({message,role,event_id}) => {
      if(!session.current || !['user','agent'].includes(role)) return;
      const messages=[...session.current.messages];
      const index=event_id === undefined ? -1 : messages.findIndex(m=>m.eventId===event_id && m.role===role);
      const item:Message={role:role as Message['role'],text:message,eventId:event_id};
      if(index>=0) messages[index]=item; else messages.push(item);
      save({messages});
    },
    onAgentResponseCorrection:({original_agent_response,corrected_agent_response}) => {
      if(!session.current) return;
      const messages=[...session.current.messages];
      const reverseIndex=[...messages].reverse().findIndex(m=>m.role==='agent' && m.text===original_agent_response);
      const index=reverseIndex<0?-1:messages.length-1-reverseIndex;
      if(index>=0) {messages[index]={...messages[index],text:corrected_agent_response};save({messages});}
    },
    onDisconnect:() => {save({ended:true});setStarting(false);setClosing(false);startLock.current=false},
    onError:() => {setError('No se pudo mantener la conexión. Revisa tu conexión, el micrófono y la configuración del agente.');setStarting(false)},
    clientTools:{
      record_learning:({payload}) => {
        try{
          if(!session.current || session.current.ended) return 'ERROR: no active session';
          const result=validateLearningEvent(payload,planRef.current,session.current.messages);
          if(result.kind==='summary') save({summary:result as Summary,practiced:(result as Summary).practiced});
          else save({feedback:[...session.current.feedback,result as Feedback]});
          return 'OK: saved locally. Do not read the JSON aloud.';
        }catch(e){return `ERROR: ${e instanceof Error ? e.message : 'Invalid payload'}. Fix the evidence or vocabulary and retry.`;}
      }
    }
  });
  const connected=conversation.status==='connected';
  const busy=starting || connected || conversation.status==='connecting';

  async function start() {
    if(startLock.current || busy) return;
    if(!/^agent_[a-zA-Z0-9]+$/.test(agentId.trim())){setConfigOpen(true);setError('Configura un Agent ID válido de ElevenLabs.');return;}
    startLock.current=true; setStarting(true);setError('');setDemo(false);setClosing(false);setSeconds(0);closingAt.current=0;startedAt.current=0;
    planRef.current=plan;
    session.current={id:crypto.randomUUID(),date:new Date().toISOString(),level,topic:plan.topic.title,mode,duration:0,messages:[],feedback:[],practiced:[],ended:false};
    setActive(session.current);
    try {
      await conversation.startSession({agentId:agentId.trim(),connectionType:mode==='text'?'websocket':'webrtc',textOnly:mode==='text',dynamicVariables:{
        hsk_level:level, topic:plan.topic.title, session_minutes:curriculum.sessionMinutes,
        allowed_vocabulary:JSON.stringify(plan.allowed), new_words:JSON.stringify(plan.targets),
        review_words:JSON.stringify(plan.review), previous_recommendation:history.find(s=>s.summary)?.summary?.recommendation || 'Primera sesión; no atribuyas conocimientos previos.'
      }});
    }catch{setError(mode==='voice'?'No se inició la conversación. Permite el micrófono y comprueba que el agente esté publicado para este dominio.':'No se inició el chat. Comprueba el Agent ID, los dominios permitidos y la configuración de texto.');save({ended:true});}
    finally{setStarting(false);startLock.current=false;}
  }
  async function stop() {try{await conversation.endSession()}catch{setError('La conexión no se cerró normalmente.')}finally{save({ended:true});setClosing(false);setStarting(false);startLock.current=false;}}
  function requestSummary() {
    if(!connected || closingAt.current) return;
    setClosing(true);closingAt.current=Date.now();
    conversation.sendUserMessage('Terminemos la sesión. Resume únicamente lo que realmente practicamos, registra el resumen con record_learning y dame una tarea breve. Si no hicimos el miniquiz, marca completed=false.');
  }
  useEffect(()=>{
    if(!connected) return;
    const timer=window.setInterval(()=>{
      const elapsed=Math.floor((Date.now()-startedAt.current)/1000);setSeconds(elapsed);
      if(elapsed>=curriculum.sessionMinutes*60 || (closingAt.current && Date.now()-closingAt.current>=45000)) void stop();
      else if(elapsed>=(curriculum.sessionMinutes-1)*60 && !closingAt.current) requestSummary();
    },500);
    return()=>clearInterval(timer);
  },[connected]);
  useEffect(()=>{transcriptEnd.current?.scrollIntoView({block:'nearest',behavior:'smooth'})},[active?.messages.length]);
  useEffect(()=>{if(!busy)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[busy]);

  function exportNotebook() {
    const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),sessions:historyRef.current},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hsk-voice-coach-cuaderno.json';a.click();URL.revokeObjectURL(url);
  }
  function sendText(event:React.FormEvent) {
    event.preventDefault();if(!text.trim() || !connected) return;
    const value=text.trim();setText('');conversation.sendUserMessage(value);
    // SDK echoes user messages; that event is the single transcript source.
  }
  const shown=selected || active;
  const practiced=[...new Set(history.flatMap(s=>s.practiced))];
  const currentFeedback=active?.feedback.at(-1);
  const visibleWords:Word[]=plan.allowed.filter((w:Word)=>plan.topic.words.includes(w.hanzi));
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={()=>{setView('practice');setSelected(null)}} aria-label="HSK Voice Coach, inicio"><span className="seal" lang="zh">言</span><span>HSK <b>Voice Coach</b><small>UN EXPERIMENTO DE MIRÓ LABS</small></span></a>
      <nav aria-label="Navegación principal"><button className={view==='practice'?'nav-active':''} onClick={()=>{setView('practice');setSelected(null)}}>Práctica diaria</button><button className={view==='notebook'?'nav-active':''} onClick={()=>{setView('notebook');setSelected(null)}}><BookOpen size={16}/> Mi cuaderno{history.length>0 && <span className="count">{history.length}</span>}</button></nav>
      <button className="icon-button" aria-label="Configurar ElevenLabs" onClick={()=>setConfigOpen(true)}><Settings size={20}/></button>
    </header>
    <main>
      {view==='practice' ? <>
        <div className="page-intro"><div><p className="eyebrow">TU MOMENTO DE MANDARÍN</p><h1>Un poco, <em>cada día.</em></h1><p>Diez minutos de conversación. Una palabra más cerca.</p></div><label className="level-select">Tu nivel <span><select aria-label="Nivel HSK" disabled={busy} value={level} onChange={e=>{setLevel(Number(e.target.value));setTopicId('introductions')}}>{curriculum.levels.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select><ChevronDown size={15}/></span></label></div>
        <div className="workspace">
          <section className="conversation-panel" aria-label="Conversación con tu profesora">
            <div className="panel-top"><span className="eyebrow">{plan.topic.title.toUpperCase()}</span><span className="timer"><span className={connected?'status-dot live':'status-dot'}/>{time(seconds)} <span>/ {time(curriculum.sessionMinutes*60)}</span></span></div>
            <div className={'teacher '+(connected?'teacher-active':'')}>
              <div className={'voice-symbol '+(conversation.isSpeaking?'speaking':'')} aria-hidden="true"><span lang="zh">言</span><i/><i/><i/></div>
              <p className="teacher-name">Tu profesora de mandarín <span>IA</span></p>
              <h2 lang="zh">你好！</h2><p className="pinyin">Nǐ hǎo!</p>
              <p className="teacher-caption">{connected ? (closing?'Preparando tu resumen…':conversation.isSpeaking?'Escucha, la profesora está hablando.':mode==='text'?'Escribe tu respuesta abajo.':'Te escucho. Tómate tu tiempo.') : 'Hola. Empecemos con algo sencillo.'}</p>
            </div>
            {demo ? <div className="demo-transcript"><span className="eyebrow">VISTA DE EJEMPLO · SIN CONEXIÓN</span><p lang="zh">你叫什么名字？</p><p className="pinyin">Nǐ jiào shénme míngzi?</p><p>¿Cómo te llamas? Puedes responder: <span lang="zh">我叫…</span> <i>Wǒ jiào…</i></p><button className="text-button" onClick={()=>setDemo(false)}>Cerrar ejemplo <X size={14}/></button></div> : active && active.messages.length>0 ? <div className="transcript" aria-label="Transcripción de la sesión" role="log">{active.messages.map((m,i)=><div className={'message '+m.role} key={`${m.eventId ?? i}-${m.role}`}><span>{m.role==='user'?'TÚ':'PROFESORA'}</span><p>{m.text}</p></div>)}<div ref={transcriptEnd}/></div> : null}
            {currentFeedback && !active?.ended && <FeedbackCard feedback={currentFeedback}/>}
            {error && <p role="alert" className="error">{error}</p>}
            <div className="session-controls">
              {connected ? <><div className="connected-controls">{mode==='voice' && <button className="secondary" onClick={()=>conversation.setMuted(!conversation.isMuted)}>{conversation.isMuted?<MicOff size={18}/>:<Mic size={18}/>} {conversation.isMuted?'Activar micrófono':'Silenciar'}</button>}<button className="primary" disabled={closing} onClick={requestSummary}><Check size={18}/> Resumir y terminar</button><button className="icon-button" aria-label="Desconectar ahora" onClick={()=>void stop()}><Square size={18}/></button></div><form onSubmit={sendText} className="chat-input"><input aria-label="Tu respuesta" placeholder="También puedes escribir en español o mandarín…" value={text} onChange={e=>{setText(e.target.value);conversation.sendUserActivity()}} maxLength={1000}/><button className="icon-button" aria-label="Enviar respuesta" disabled={!text.trim()}><ArrowRight size={20}/></button></form>{closing && <small>Guardaremos la transcripción aunque no llegue el resumen. La conexión se cerrará en un máximo de 45 segundos.</small>}</> : <><div className="mode-toggle" aria-label="Modo de conversación"><button disabled={busy} aria-pressed={mode==='voice'} onClick={()=>setMode('voice')}><Mic size={15}/> Voz</button><button disabled={busy} aria-pressed={mode==='text'} onClick={()=>setMode('text')}>Texto</button></div><button className="primary start-button" disabled={busy} onClick={()=>void start()}>{starting?<AudioLines size={19}/>:mode==='voice'?<Mic size={19}/>:<ArrowRight size={19}/>} {starting?'Conectando…':agentId?'Empezar mi práctica':'Conectar ElevenLabs'} <ArrowRight size={18}/></button><p className="microcopy">{agentId?'La sesión usa créditos de ElevenLabs.':'Configura tu agente para conversar.'} {mode==='voice'?'Tu voz se envía a ElevenLabs.':'Tus mensajes se envían a ElevenLabs.'}</p>{!active && <button className="text-button" onClick={()=>setDemo(!demo)}>Ver un ejemplo sin usar créditos <ArrowRight size={14}/></button>}</>}
            </div>
          </section>
          <aside className="lesson-sidebar">
            <div className="lesson-number">PRÁCTICA / {String(history.length+1).padStart(2,'0')}</div><h2>Hoy, hablemos<br/><em>de lo cotidiano.</em></h2><p className="sidebar-copy">Elige una situación para tu conversación.</p>
            <label className="topic-label">Tema de hoy<select aria-label="Tema de hoy" disabled={busy} value={topicId} onChange={e=>setTopicId(e.target.value)}>{curriculum.topics.filter(t=>(t.minLevel || 1)<=level).map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
            <div className="vocab-heading"><h3>Palabras para hoy</h3><span>{plan.targets.length} nuevas como máximo</span></div>
            <div className="vocabulary">{visibleWords.map((w,i)=><div className="word-row" key={w.hanzi}><span className="word-index">0{i+1}</span><span lang="zh" className="hanzi">{w.hanzi}</span><span><b>{w.pinyin}</b><small>{w.es}</small></span></div>)}</div>
            <div className="review-note"><BookOpen size={18}/><p>{plan.review.length?<>Repasaremos: <span lang="zh">{plan.review.join(' · ')}</span></>:'Tu próxima sesión retomará las palabras que practiques hoy.'}</p></div>
            <details className="session-flow"><summary>El ritmo de tu sesión <ChevronDown size={15}/></summary><ol>{['Saludo y calentamiento','Repaso de hasta tres palabras anteriores','Hasta cinco palabras nuevas','Conversación o roleplay','Corrección y repetición','Miniquiz de tres preguntas','Resumen y una pequeña tarea'].map(s=><li key={s}>{s}</li>)}</ol></details>
          </aside>
        </div>
        {active?.ended && active.messages.length>0 && <section className="session-result"><p className="eyebrow">TU SESIÓN ESTÁ EN EL CUADERNO</p><SessionDetail session={active}/></section>}
        <div className="bottom-note"><Headphones size={18}/><p>Un lugar para equivocarte, repetir y seguir. Las indicaciones de pronunciación son aproximadas.</p><span>POWERED BY <b><span className="el-mark" aria-hidden="true"><i/><i/></span> ElevenLabs</b></span></div>
      </> : <>
        <div className="page-intro"><div><p className="eyebrow">TU APRENDIZAJE, A MANO</p><h1>Mi <em>cuaderno.</em></h1><p>{history.length} sesiones guardadas · {practiced.length} palabras practicadas</p></div><button className="secondary" disabled={!history.length} onClick={exportNotebook}><Download size={17}/> Descargar cuaderno</button></div>
        {selected ? <section className="notebook-detail"><button className="text-button" onClick={()=>setSelected(null)}>← Todas las sesiones</button><SessionDetail session={shown!}/><details><summary>Transcripción completa</summary>{selected.messages.map((m,i)=><div className="message" key={i}><span>{m.role==='user'?'TÚ':'PROFESORA'}</span><p>{m.text}</p></div>)}</details></section> : history.length ? <div className="session-list">{history.map(s=><button key={s.id} onClick={()=>setSelected(s)}><span className="session-date">{new Date(s.date).toLocaleDateString('es',{day:'2-digit',month:'short'})}</span><span><b>{s.topic}</b><small>HSK {s.level} · {time(s.duration)} · {s.summary?.completed?'Práctica completada':'Práctica parcial'} · {s.mode==='voice'?'Voz':'Texto'}</small></span><span>{s.practiced.length} palabras</span><ArrowRight size={20}/></button>)}</div> : <div className="empty-notebook"><BookOpen size={38}/><h2>La primera página está por escribir.</h2><p>Aquí estarán tus conversaciones, correcciones y próximas tareas.</p><button className="primary" onClick={()=>setView('practice')}>Ir a mi práctica <ArrowRight size={17}/></button></div>}
        <p className="privacy-note">Tu cuaderno se guarda en este navegador. No se sincroniza entre dispositivos. ElevenLabs procesa la conversación y puede conservarla según la configuración de tu agente.</p>
      </>}
      {storageError && <p role="alert" className="error">{storageError} <button className="text-button" onClick={exportNotebook}>Descargar</button></p>}
    </main>
    <footer><span>HSK Voice Coach <span className="footer-dot">·</span> MIRÓ Labs</span><span>{curriculum.framework} · Repertorio inicial de 40 palabras</span><a href="https://github.com/alonsorgl28/hsk-voice-coach" target="_blank" rel="noreferrer">Ver proyecto ↗</a></footer>
    {configOpen && <div className="modal-backdrop" onClick={()=>setConfigOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setConfigOpen(false);if(e.key==='Tab'){const items=[...e.currentTarget.querySelectorAll<HTMLElement>('button,input,a')].filter(x=>!(x as HTMLButtonElement).disabled);const first=items[0],last=items.at(-1);if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus()}}}}><button className="icon-button modal-close" aria-label="Cerrar configuración" onClick={()=>setConfigOpen(false)}><X size={20}/></button><p className="eyebrow">TU PROFESORA, CONECTADA</p><h2 id="settings-title">Conectar ElevenLabs</h2><p>Usa el identificador público de tu agente configurado para HSK Voice Coach.</p><label>Agent ID<input autoFocus disabled={busy} value={agentId} placeholder="agent_…" onChange={e=>setAgentId(e.target.value)} /></label><p className="microcopy">El Agent ID no es una API key. No pegues claves secretas aquí.</p><a href="https://elevenlabs.io/app/agents" target="_blank" rel="noreferrer">Abrir ElevenAgents ↗</a><button className="primary" disabled={busy || !/^agent_[a-zA-Z0-9]+$/.test(agentId.trim())} onClick={()=>{try{localStorage.setItem(AGENT_KEY,agentId.trim());setError('');setConfigOpen(false)}catch{setError('No se pudo guardar la configuración en este navegador.')}}}>Guardar conexión <Check size={18}/></button><p className="microcopy">Antes de conectar: publica el agente y configura las variables dinámicas y la herramienta record_learning del repositorio.</p></section></div>}
  </div>;
}
function FeedbackCard({feedback}:{feedback:Feedback}) {return <div className="feedback-card"><span className="eyebrow">{feedback.kind==='correction'?'UNA PEQUEÑA CORRECCIÓN':'PARA RECORDAR'}</span><p lang="zh">{feedback.hanzi}</p><p className="pinyin">{feedback.pinyin}</p><p>{feedback.explanation}</p>{feedback.evidence && <small>Tu respuesta: {feedback.evidence}</small>}</div>}
function SessionDetail({session}:{session:Session}) {return <><h2>{session.topic}</h2>{session.summary ? <div className="summary-grid"><div><h3>Vocabulario practicado</h3><p lang="zh">{session.summary.practiced.join(' · ') || 'Sin palabras registradas.'}</p><h3>Errores y frases corregidas</h3>{session.summary.errors.length?session.summary.errors.map((f,i)=><FeedbackCard key={i} feedback={f}/>):<p>No se registraron errores con evidencia. Esto no equivale a una evaluación de pronunciación.</p>}</div><div><h3>La próxima vez</h3><p>{session.summary.recommendation}</p><h3>Tu pequeña tarea</h3><p>{session.summary.homework}</p><small>{session.summary.completed?'Flujo completo según la profesora.':'Sesión parcial; quedan actividades por completar.'}</small></div></div> : <p>Transcripción guardada. La profesora no envió un resumen válido antes de la desconexión; no se atribuye progreso ni vocabulario.</p>}</>}
