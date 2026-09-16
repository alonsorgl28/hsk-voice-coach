import { useCallback, useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { ArrowRight, ArrowLeft, BookOpen, Check, Download, Mic, MicOff, Settings, X } from 'lucide-react';
import curriculum from './curriculum.json';
import { makePlan, readHistory, upsertSession, validateLearningEvent, validatePhrase } from './learning.mjs';
import { glossChinese } from './subtitles.mjs';
import Gradient, { type OrbState } from './Gradient';

type Message = {role:'user'|'agent'; text:string; eventId?:number};
type Word = typeof curriculum.words[number];
type Feedback = {kind:'lesson'|'correction'; hanzi:string; pinyin:string; explanation:string; evidence?:string};
type Summary = {kind:'summary'; practiced:string[]; errors:Feedback[]; recommendation:string; homework:string; completed:boolean};
type Phrase = {hanzi:string; pinyin:string; es:string; context:string; beyond:boolean};
type Token = {hanzi?:string; pinyin?:string; es?:string; text?:string};
type Session = {id:string; conversationId?:string; date:string; level:number; topic:string; mode:'voice'|'text'; duration:number; messages:Message[]; feedback:Feedback[]; practiced:string[]; phrases?:Phrase[]; summary?:Summary; ended:boolean};
type Density = 'hanzi'|'pinyin'|'full';

const HISTORY_KEY = 'hsk-coach.sessions.v1';
const AGENT_KEY = 'hsk-coach.agent.v1';
const DENSITY_KEY = 'hsk-coach.density.v1';
const DEMO_LINE = '你叫什么名字？';
// The example view also shows a pinned phrase, because that is the feature worth showing.
const DEMO_PHRASE:Phrase = {hanzi:'我不知道怎么说。', pinyin:'Wǒ bù zhīdào zěnme shuō.', es:'No sé cómo se dice.', context:'Úsala cuando te quedes en blanco. Ella te dará la frase.', beyond:true};
const DENSITIES:Density[] = ['hanzi','pinyin','full'];
const DENSITY_LABEL:Record<Density,string> = {hanzi:'汉字', pinyin:'+ pinyin', full:'+ significado'};
const safeGet = (key:string) => {try{return localStorage.getItem(key) || ''}catch{return ''}};
const demoRequested = () => {try{return new URLSearchParams(location.search).get('demo')==='1'}catch{return false}};

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
  const [starting,setStarting] = useState(false);
  const [closing,setClosing] = useState(false);
  const [phrase,setPhrase] = useState<Phrase|null>(() => demoRequested() ? DEMO_PHRASE : null);
  // ?demo=1 opens the example view directly, so the app can be shown without spending credits.
  const [demo,setDemo] = useState(demoRequested);
  const [density,setDensity] = useState<Density>(() => {const v=safeGet(DENSITY_KEY) as Density; return DENSITIES.includes(v)?v:'full'});
  const [compact,setCompact] = useState(() => window.matchMedia?.('(max-width: 640px)').matches ?? false);
  const session = useRef<Session|null>(null);
  const historyRef = useRef(history);
  const startedAt = useRef(0);
  const plan = makePlan(curriculum,level,topicId,history);
  const planRef = useRef(plan);
  const closingAt = useRef(0);
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
      },
      // The phrase the student asked for. It is pinned on screen until dismissed,
      // because you cannot repeat what vanished while you were still reading it.
      suggest_phrase:({payload}) => {
        try{
          if(!session.current || session.current.ended) return 'ERROR: no active session';
          const result=validatePhrase(payload,planRef.current) as Phrase;
          setPhrase(result);
          save({phrases:[...(session.current.phrases ?? []),result]});
          return 'OK: pinned on screen. Say it once, then ask the student to repeat it.';
        }catch(e){return `ERROR: ${e instanceof Error ? e.message : 'Invalid payload'}. Retry with hanzi, pinyin and es.`;}
      }
    }
  });
  const connected=conversation.status==='connected';
  // The orb reads the live audio every frame, so it must not go through React state.
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const getLevel = useCallback(() => {
    const live = conversationRef.current;
    try { return live.isSpeaking ? live.getOutputVolume() : live.getInputVolume(); } catch { return 0; }
  },[]);
  const busy=starting || connected || conversation.status==='connecting';
  const live=connected || starting;

  async function start() {
    if(startLock.current || busy) return;
    if(!/^agent_[a-zA-Z0-9]+$/.test(agentId.trim())){setConfigOpen(true);setError('Configura un Agent ID válido de ElevenLabs.');return;}
    startLock.current=true; setStarting(true);setError('');setDemo(false);setClosing(false);setPhrase(null);closingAt.current=0;startedAt.current=0;
    planRef.current=plan;
    session.current={id:crypto.randomUUID(),date:new Date().toISOString(),level,topic:plan.topic.title,mode,duration:0,messages:[],feedback:[],practiced:[],phrases:[],ended:false};
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
  // The clock still runs the session; it just no longer sits on screen counting at you.
  useEffect(()=>{
    if(!connected) return;
    const timer=window.setInterval(()=>{
      const elapsed=Math.floor((Date.now()-startedAt.current)/1000);
      if(elapsed>=curriculum.sessionMinutes*60 || (closingAt.current && Date.now()-closingAt.current>=45000)) void stop();
      else if(elapsed>=(curriculum.sessionMinutes-1)*60 && !closingAt.current) requestSummary();
    },500);
    return()=>clearInterval(timer);
  },[connected]);
  useEffect(()=>{const mq=window.matchMedia('(max-width: 640px)');const sync=()=>setCompact(mq.matches);mq.addEventListener('change',sync);return()=>mq.removeEventListener('change',sync)},[]);
  useEffect(()=>{if(!busy)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[busy]);
  useEffect(()=>{if(!live)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&phrase)setPhrase(null)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[live,phrase]);

  function exportNotebook() {
    const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),sessions:historyRef.current},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hsk-voice-coach-cuaderno.json';a.click();URL.revokeObjectURL(url);
  }
  function sendText(event:React.FormEvent) {
    event.preventDefault();if(!text.trim() || !connected) return;
    const value=text.trim();setText('');conversation.sendUserMessage(value);
    // SDK echoes user messages; that event is the single transcript source.
  }
  function cycleDensity() {
    setDensity(current=>{const next=DENSITIES[(DENSITIES.indexOf(current)+1)%DENSITIES.length];try{localStorage.setItem(DENSITY_KEY,next)}catch{/* preferencia no crítica */}return next});
  }

  const shown=selected || active;
  const practiced=[...new Set(history.flatMap(s=>s.practiced))];
  const visibleWords:Word[]=plan.allowed.filter((w:Word)=>plan.topic.words.includes(w.hanzi));
  const lastAgentLine=demo ? DEMO_LINE : (active?.messages.filter(m=>m.role==='agent').at(-1)?.text ?? '');
  // The subtitle holds until the next line replaces it. Nothing fades out from under you.
  const subtitle:Token[]=glossChinese(lastAgentLine,curriculum.words);
  const subtitleWeight=subtitle.reduce((n,tk)=>n+(tk.hanzi?tk.hanzi.length*2:Math.ceil((tk.text?.length ?? 0)/2)),0);
  const subtitleSize=subtitleWeight>90?'xs':subtitleWeight>56?'s':subtitleWeight>30?'m':'l';
  const orbState:OrbState = !connected ? 'idle'
    : conversation.isSpeaking ? 'speaking'
    : (closing || active?.messages.at(-1)?.role==='user') ? 'thinking'
    : 'listening';
  const caption = connected
    ? (closing?'Preparando tu resumen…':conversation.isSpeaking?'':mode==='text'?'Escribe tu respuesta.':'Te escucho.')
    : starting ? 'Conectando…' : '';

  // ── The conversation. Nothing on screen but the orb and what she just said. ──
  if (live || (demo && !active)) return <div className="room">
    <button className="room-exit" aria-label="Terminar la sesión" onClick={()=>{if(demo&&!active){setDemo(false);return}void stop()}}><X size={20}/></button>
    <div className="room-orb"><Gradient state={demo?'speaking':orbState} getLevel={getLevel} size={compact?(phrase?200:258):(phrase?300:380)}/></div>
    {caption && <p className="room-caption">{caption}</p>}
    {subtitle.length>0 && <Subtitle tokens={subtitle} density={density} size={subtitleSize}/>}
    {density==='full' && subtitle.some(t=>t.es) && <p className="room-gloss">Significado palabra por palabra, no una traducción literal.</p>}
    {error && <p role="alert" className="room-error">{error}</p>}
    {phrase && <PhraseCard phrase={phrase} onClose={()=>setPhrase(null)}/>}
    <div className="room-controls">
      {subtitle.some(t=>t.hanzi) && <button className="ghost" onClick={cycleDensity} aria-label="Cambiar el detalle de los subtítulos">{DENSITY_LABEL[density]}</button>}
      {connected && mode==='voice' && <button className="ghost" onClick={()=>conversation.setMuted(!conversation.isMuted)}>{conversation.isMuted?<MicOff size={16}/>:<Mic size={16}/>} {conversation.isMuted?'Activar':'Silenciar'}</button>}
      {connected && <button className="ghost" disabled={closing} onClick={requestSummary}><Check size={16}/> Terminar</button>}
      {demo && !active && <button className="ghost" onClick={()=>setDemo(false)}>Cerrar el ejemplo</button>}
    </div>
    {connected && mode==='text' && <form onSubmit={sendText} className="room-input"><input aria-label="Tu respuesta" placeholder="Escribe en español o mandarín…" value={text} onChange={e=>{setText(e.target.value);conversation.sendUserActivity()}} maxLength={1000}/><button className="icon-button" aria-label="Enviar" disabled={!text.trim()}><ArrowRight size={18}/></button></form>}
  </div>;

  // ── Everything else: choosing a session, and the notebook. ──
  return <div className="page">
    <header className="bar">
      <button className="wordmark" onClick={()=>{setView('practice');setSelected(null)}}>HSK <b>Voice Coach</b></button>
      <div>
        <button className={view==='notebook'?'ghost on':'ghost'} onClick={()=>{setView('notebook');setSelected(null)}}><BookOpen size={16}/> Cuaderno{history.length>0 && <span className="count">{history.length}</span>}</button>
        <button className="icon-button" aria-label="Configurar ElevenLabs" onClick={()=>setConfigOpen(true)}><Settings size={18}/></button>
      </div>
    </header>
    <main>
      {view==='practice' ? <section className="start">
        <div className="start-orb"><Gradient state="idle" getLevel={getLevel} size={compact?168:208}/></div>
        <h1>Un poco, <em>cada día.</em></h1>
        <p className="start-copy">Diez minutos de conversación. Si no sabes decir algo, pregúntaselo — te dará la frase y la dejará escrita.</p>
        <div className="start-picks">
          <label>Nivel<select aria-label="Nivel HSK" value={level} onChange={e=>{setLevel(Number(e.target.value));setTopicId('introductions')}}>{curriculum.levels.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
          <label>Tema<select aria-label="Tema de hoy" value={topicId} onChange={e=>setTopicId(e.target.value)}>{curriculum.topics.filter(t=>(t.minLevel || 1)<=level).map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
          <label>Modo<select aria-label="Modo" value={mode} onChange={e=>setMode(e.target.value as 'voice'|'text')}><option value="voice">Voz</option><option value="text">Texto</option></select></label>
        </div>
        <button className="primary" disabled={busy} onClick={()=>void start()}>{agentId?'Empezar':'Conectar ElevenLabs'} <ArrowRight size={17}/></button>
        <p className="microcopy">{agentId?'La sesión usa créditos de ElevenLabs.':'Configura tu agente para conversar.'} {mode==='voice'?'Tu voz se envía a ElevenLabs.':'Tus mensajes se envían a ElevenLabs.'}</p>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="start-words"><span>Hoy</span>{visibleWords.map(w=><i key={w.hanzi}><b lang="zh">{w.hanzi}</b> {w.pinyin}</i>)}</div>
        {!active && <button className="text-button" onClick={()=>{setDemo(true);setPhrase(DEMO_PHRASE)}}>Ver un ejemplo sin usar créditos</button>}
        {active?.ended && active.messages.length>0 && <div className="after"><SessionDetail session={active}/></div>}
      </section> : <section className="notebook">
        <div className="notebook-head"><h1>Mi <em>cuaderno.</em></h1><button className="ghost" disabled={!history.length} onClick={exportNotebook}><Download size={16}/> Descargar</button></div>
        <p className="start-copy">{history.length} sesiones · {practiced.length} palabras practicadas</p>
        {selected ? <div className="notebook-detail"><button className="text-button" onClick={()=>setSelected(null)}><ArrowLeft size={14}/> Todas las sesiones</button><SessionDetail session={shown!}/><details><summary>Transcripción completa</summary>{selected.messages.map((m,i)=><div className="line" key={i}><span>{m.role==='user'?'TÚ':'PROFESORA'}</span><p>{m.text}</p></div>)}</details></div>
        : history.length ? <div className="session-list">{history.map(s=><button key={s.id} onClick={()=>setSelected(s)}><span className="date">{new Date(s.date).toLocaleDateString('es',{day:'2-digit',month:'short'})}</span><span><b>{s.topic}</b><small>HSK {s.level} · {s.summary?.completed?'Completada':'Parcial'}</small></span><span className="count-words">{s.practiced.length}</span><ArrowRight size={18}/></button>)}</div>
        : <div className="empty"><BookOpen size={32}/><p>La primera página está por escribir.</p><button className="primary" onClick={()=>setView('practice')}>Ir a mi práctica <ArrowRight size={16}/></button></div>}
        <p className="microcopy">Tu cuaderno se guarda en este navegador. No se sincroniza entre dispositivos.</p>
      </section>}
      {storageError && <p role="alert" className="error">{storageError} <button className="text-button" onClick={exportNotebook}>Descargar</button></p>}
    </main>
    {configOpen && <Config agentId={agentId} setAgentId={setAgentId} busy={busy} onError={setError} onClose={()=>setConfigOpen(false)}/>}
  </div>;
}

function Subtitle({tokens,density,size}:{tokens:Token[]; density:Density; size:string}) {
  return <p className={`subtitle subtitle-${density} subtitle-${size}`}>
    {tokens.map((t,i)=> t.text !== undefined
      ? <span className="subtitle-es" key={i}>{t.text}</span>
      : <span className={'subtitle-word'+(t.es?'':' subtitle-plain')} key={i}>
          <b lang="zh">{t.hanzi}</b>
          {density!=='hanzi' && t.pinyin && <i>{t.pinyin}</i>}
          {density==='full' && t.es && <small>{t.es.split(';')[0].trim()}</small>}
        </span>)}
  </p>;
}

// Pinned, never auto-dismissed: this is the answer to "¿cómo digo…?" and you need
// it to stay put while you say it back.
function PhraseCard({phrase,onClose}:{phrase:Phrase; onClose:()=>void}) {
  return <aside className="phrase" role="note">
    <button className="icon-button phrase-close" aria-label="Cerrar la frase" onClick={onClose}><X size={16}/></button>
    <span className="phrase-label">PARA DECIRLO</span>
    <p className="phrase-hanzi" lang="zh">{phrase.hanzi}</p>
    <p className="phrase-pinyin">{phrase.pinyin}</p>
    <p className="phrase-es">{phrase.es}</p>
    {phrase.context && <p className="phrase-context">{phrase.context}</p>}
    {phrase.beyond && <p className="phrase-beyond">Fuera de tu nivel de hoy. Queda en el cuaderno, pero no cuenta como vocabulario practicado.</p>}
  </aside>;
}

function FeedbackCard({feedback}:{feedback:Feedback}) {
  return <div className="feedback"><span className="phrase-label">{feedback.kind==='correction'?'UNA CORRECCIÓN':'PARA RECORDAR'}</span><p lang="zh" className="phrase-hanzi">{feedback.hanzi}</p><p className="phrase-pinyin">{feedback.pinyin}</p><p>{feedback.explanation}</p>{feedback.evidence && <small>Tu respuesta: {feedback.evidence}</small>}</div>;
}

function SessionDetail({session}:{session:Session}) {
  return <><h2>{session.topic}</h2>{session.summary ? <div className="summary">
    <div><h3>Vocabulario practicado</h3><p lang="zh">{session.summary.practiced.join(' · ') || 'Sin palabras registradas.'}</p><h3>Correcciones</h3>{session.summary.errors.length?session.summary.errors.map((f,i)=><FeedbackCard key={i} feedback={f}/>):<p>No se registraron errores con evidencia. Esto no equivale a una evaluación de pronunciación.</p>}</div>
    <div><h3>La próxima vez</h3><p>{session.summary.recommendation}</p><h3>Tu tarea</h3><p>{session.summary.homework}</p>{session.phrases && session.phrases.length>0 && <><h3>Frases que pediste</h3>{session.phrases.map((p,i)=><p key={i}><b lang="zh">{p.hanzi}</b> — {p.es}</p>)}</>}<small>{session.summary.completed?'Flujo completo según la profesora.':'Sesión parcial; quedan actividades por completar.'}</small></div>
  </div> : <p>Transcripción guardada. La profesora no envió un resumen válido antes de la desconexión; no se atribuye progreso ni vocabulario.</p>}</>;
}

function Config({agentId,setAgentId,busy,onError,onClose}:{agentId:string; setAgentId:(v:string)=>void; busy:boolean; onError:(v:string)=>void; onClose:()=>void}) {
  return <div className="backdrop" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose()}}>
    <button className="icon-button modal-close" aria-label="Cerrar" onClick={onClose}><X size={18}/></button>
    <h2 id="settings-title">Conectar ElevenLabs</h2>
    <p>Usa el identificador público de tu agente.</p>
    <label>Agent ID<input autoFocus disabled={busy} value={agentId} placeholder="agent_…" onChange={e=>setAgentId(e.target.value)}/></label>
    <p className="microcopy">El Agent ID no es una API key. No pegues claves secretas aquí.</p>
    <a href="https://elevenlabs.io/app/agents" target="_blank" rel="noreferrer">Abrir ElevenLabs ↗</a>
    <button className="primary" disabled={busy || !/^agent_[a-zA-Z0-9]+$/.test(agentId.trim())} onClick={()=>{try{localStorage.setItem(AGENT_KEY,agentId.trim());onError('');onClose()}catch{onError('No se pudo guardar la configuración en este navegador.')}}}>Guardar <Check size={16}/></button>
  </section></div>;
}
