import {useState} from 'react';
import {ArrowLeft,Volume2} from 'lucide-react';
import {normalizeAnswer,createRun,lessonSession} from './progress.mjs';
import curriculum from './curriculum.json';
import config from './lessons.json';
import useBrowserSpeech from './useBrowserSpeech';
type Phrase={hanzi:string;pinyin:string;es:string;context?:string};
export default function PhrasePractice({phrase,onSave,onClose}:{phrase:Phrase;onSave:(session:ReturnType<typeof lessonSession>)=>void;onClose:()=>void}) {
 const [text,setText]=useState('');const [revealed,setRevealed]=useState(false);const [assisted,setAssisted]=useState(false);const [feedback,setFeedback]=useState('');
 const [id]=useState(()=>crypto.randomUUID());const speech=useBrowserSpeech();
 function check(){const correct=normalizeAnswer(text)===normalizeAnswer(phrase.hanzi);setFeedback(correct?'Tu frase coincide con la que guardaste.':'No coincide con la frase guardada. Puedes verla y volver a intentarlo; también podría existir otra forma válida de decirlo.');
 const at=new Date().toISOString();const lesson={id:'personal',personal:true,title:'Frase personal',level:1,steps:[{id:'personal',kind:'check',answers:[phrase.hanzi]}]};
 const run={...createRun(lesson,at,id),attempts:[{task:'personal',text,correct,assisted,at,modality:'text'}],passed:correct,ended:correct};
 onSave({...lessonSession(run,lesson,curriculum),phrases:[{...phrase,beyond:true}],run:undefined} as ReturnType<typeof lessonSession>);
 }
 return <div className="lesson-shell"><button className="text-button" onClick={()=>{speech.stop();onClose()}}><ArrowLeft size={15}/> Volver al cuaderno</button><section className="guided-room personal-room"><p className="eyebrow">Tu repertorio personal · Práctica escrita</p><h1>¿Cómo lo dirías?</h1><p>{phrase.es}</p>{phrase.context&&<p className="microcopy">{phrase.context}</p>}{revealed&&<div className="lesson-model"><p lang="zh">{phrase.hanzi}</p><span>{phrase.pinyin}</span></div>}<div className="lesson-tools"><button className="ghost" onClick={()=>{setAssisted(true);setRevealed(!revealed)}}>{revealed?'Ocultar frase':'Ver frase'}</button><button className="ghost" onClick={()=>{setAssisted(true);speech.say(phrase.hanzi,config.browserVoiceRate)}}><Volume2 size={15}/> Escuchar</button></div>{speech.error&&<p className="lesson-notice" role="status">{speech.error}</p>}<form className="lesson-answer" onSubmit={e=>{e.preventDefault();check()}}><label htmlFor="personal-answer">Intenta recordarla en chino</label><div><input id="personal-answer" value={text} maxLength={240} onChange={e=>setText(e.target.value)} autoFocus/><button className="primary" disabled={!text.trim()}>Comprobar</button></div></form><p role="status" className="microcopy">{feedback||'Se guarda en el cuaderno sin contar como vocabulario HSK ni evaluación de pronunciación.'}</p></section></div>
}
