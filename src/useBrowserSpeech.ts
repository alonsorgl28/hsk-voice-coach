import {useEffect, useRef, useState} from 'react';
// Browser audio is explicitly separate from ElevenLabs and never grades pronunciation.
export default function useBrowserSpeech() {
  const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
  const [speaking,setSpeaking]=useState(false);
  const [error,setError]=useState('');
  const token=useRef(0);
  // Called once when the current utterance ends, fails or is cancelled (used to give the microphone back).
  const settle=useRef<(()=>void)|null>(null);
  const settled=()=>{const done=settle.current;settle.current=null;done?.()};
  const stop=()=>{token.current++;window.speechSynthesis?.cancel();setSpeaking(false);settled()};
  useEffect(()=>{
    if(!('speechSynthesis' in window))return;
    const load=()=>setVoices(window.speechSynthesis.getVoices().filter(v=>/^zh([_-]|$)/i.test(v.lang)));
    load();window.speechSynthesis.addEventListener('voiceschanged',load);
    return()=>{token.current++;window.speechSynthesis.cancel();window.speechSynthesis.removeEventListener('voiceschanged',load)};
  },[]);
  function say(text:string,rate:number,onEnd?:()=>void,onSettled?:()=>void) {
    stop();setError('');
    if(!voices.length){setError('No hay una voz de mandarín disponible en este navegador. Puedes practicar por escrito o usar la profesora de ElevenLabs.');onSettled?.();return;}
    const current=token.current;settle.current=onSettled||null;
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.voice=voices.find(v=>v.lang.replace('_','-')==='zh-CN') || voices[0];
    utterance.lang=utterance.voice.lang;utterance.rate=rate;
    utterance.onstart=()=>{if(token.current===current)setSpeaking(true)};
    utterance.onend=()=>{if(token.current===current){setSpeaking(false);onEnd?.();settled()}};
    utterance.onerror=()=>{if(token.current===current){setSpeaking(false);setError('No se pudo reproducir el audio. Inténtalo de nuevo o continúa por escrito.');settled()}};
    window.speechSynthesis.speak(utterance);
  }
  return {say,stop,speaking,error,available:voices.length>0};
}
