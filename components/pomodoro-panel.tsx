"use client";

import { useEffect, useRef, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, Settings2, SkipForward, Timer, X } from "lucide-react";
import { z } from "zod";
import { plannerRefSchema } from "@/lib/planner-schema";
import type { Subject } from "@/lib/study";
import { changePhase, defaultPomodoro, newTimer, pomodoroSettingsSchema, pomodoroTimerSchema, setRunning, tickTimer, type Phase, type PomodoroSettings } from "@/lib/pomodoro";

const contextSchema=z.object({subjectId:z.string().min(1).max(100),topic:z.string().min(1).max(200),taskId:z.string().max(100).optional(),plannerRef:plannerRefSchema.optional()}).strict();
export type FocusContext=z.infer<typeof contextSchema>;
export type FocusRequest=FocusContext & {id:string};
export type FocusRegistration=FocusContext & {minutes:number;pomodoros:number;token:string};
const savedSchema=z.object({version:z.literal(1),settings:pomodoroSettingsSchema,timer:pomodoroTimerSchema,context:contextSchema});
const phaseLabels:Record<Phase,string>={focus:"Foco",short:"Pausa curta",long:"Pausa longa"};

export default function PomodoroPanel({subjects,storageKey,expanded,request,receipt,onOpen,onRegister,notify}:{subjects:Subject[];storageKey:string;expanded:boolean;request:FocusRequest|null;receipt:string;onOpen:()=>void;onRegister:(value:FocusRegistration)=>void;notify:(message:string)=>void}) {
  const [settings,setSettings]=useState(defaultPomodoro);
  const [timer,setTimer]=useState(()=>newTimer(defaultPomodoro));
  const [context,setContext]=useState<FocusContext>({subjectId:subjects[0]?.id||"",topic:"Sessão livre de estudo"});
  const [ready,setReady]=useState(false);
  const [options,setOptions]=useState(false);
  const [soundAvailable,setSoundAvailable]=useState(true);
  const [storageAvailable,setStorageAvailable]=useState(true);
  const [notice,setNotice]=useState("");
  const audioRef=useRef<AudioContext|null>(null);
  const pendingReceipt=useRef("");
  const handledRequest=useRef("");
  const timerRef=useRef(timer); const settingsRef=useRef(settings);
  useEffect(()=>{ timerRef.current=timer; settingsRef.current=settings; },[timer,settings]);

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(storageKey);
      if(raw){const parsed=savedSchema.safeParse(JSON.parse(raw));if(parsed.success && subjects.some(s=>s.id===parsed.data.context.subjectId)){
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore this browser's saved timer after hydration.
        setSettings(parsed.data.settings);setContext(parsed.data.context);
        const t=tickTimer(parsed.data.timer,parsed.data.settings);
        // Resume the one saved stage; never start unattended rounds after reopening.
        setTimer(t.finished?setRunning(t.timer,false):t.timer);
      }}
    }catch{setStorageAvailable(false);}
    setReady(true);
  // The key belongs to the authenticated account. Subjects are loaded before mounting.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[storageKey]);

  useEffect(()=>{
    if(!ready)return;
    try{localStorage.setItem(storageKey,JSON.stringify({version:1,settings,timer,context}));}catch{
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Report an external browser storage failure.
      setStorageAvailable(false);
    }
  },[timer,settings,context,ready,storageKey]);

  function unlockAudio(){
    if(!settingsRef.current.sound)return;
    try{audioRef.current??=new AudioContext();void audioRef.current.resume().catch(()=>setSoundAvailable(false));}catch{setSoundAvailable(false);}
  }
  useEffect(()=>{
    if(!ready || !request || request.id===handledRequest.current)return;
    handledRequest.current=request.id;
    const current=timerRef.current;
    if((current.running||current.focusMs>0) && !window.confirm("Trocar de missão e descartar o tempo ainda não registrado no timer?"))return;
    setContext({subjectId:request.subjectId,topic:request.topic,...(request.taskId?{taskId:request.taskId}:{}),...(request.plannerRef?{plannerRef:request.plannerRef}:{})});
    setTimer(newTimer(settingsRef.current));setNotice("Missão selecionada. Ajuste seu ritmo e clique em Começar.");
  },[request,ready]);

  useEffect(()=>{
    if(!receipt || receipt!==pendingReceipt.current)return;
    pendingReceipt.current="";setTimer(newTimer(settingsRef.current));setNotice("Estudo registrado. Pronta para o próximo bloco!");
  },[receipt]);

  useEffect(()=>{
    if(!ready)return;
    const tick=()=>{
      const result=tickTimer(timerRef.current,settingsRef.current);
      timerRef.current=result.timer;setTimer(result.timer);
      if(!result.finished)return;
      const message=result.finished==="focus"?"Foco concluído! Hora de respirar. Seu tempo está pronto para registrar.":"Pausa concluída. Vamos para o próximo bloco de foco?";
      setNotice(message);notify(message);
      if(settingsRef.current.sound && audioRef.current){try{
        const audio=audioRef.current,oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=740;
        gain.gain.setValueAtTime(.12,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.7);oscillator.start();oscillator.stop(audio.currentTime+.7);
      }catch{setSoundAvailable(false);}}
      if(settingsRef.current.notifications && "Notification" in window && Notification.permission==="granted")try{new Notification("SosoEstuda · Pomodoro",{body:message,icon:"/favicon.svg"});}catch{/* The visible alert still works. */}
    };
    const interval=setInterval(tick,500);document.addEventListener("visibilitychange",tick);
    return()=>{clearInterval(interval);document.removeEventListener("visibilitychange",tick);};
  },[ready,notify]);
  useEffect(()=>()=>{void audioRef.current?.close();},[]);

  function updateSettings(next:PomodoroSettings){
    const parsed=pomodoroSettingsSchema.safeParse(next);if(!parsed.success)return;
    const current=timerRef.current;
    setSettings(parsed.data);
    if(!current.running && current.remainingMs===current.totalMs)setTimer(changePhase(current,current.phase,parsed.data));
  }
  async function notifications(enabled:boolean){
    if(!enabled){updateSettings({...settings,notifications:false});return;}
    if(!("Notification" in window)){setNotice("Este navegador não oferece notificações. O alerta visual continua ativo.");return;}
    try{const permission=await Notification.requestPermission();updateSettings({...settingsRef.current,notifications:permission==="granted"});if(permission!=="granted")setNotice("Notificações não foram permitidas. Você pode habilitá-las nas configurações do navegador.");}catch{setNotice("Não foi possível habilitar notificações neste navegador.");}
  }
  function register(){
    const paused=setRunning(timerRef.current,false);setTimer(paused);
    if(paused.focusMs<60000)return;
    const token=crypto.randomUUID();pendingReceipt.current=token;
    onRegister({...context,minutes:Math.min(720,Math.floor(paused.focusMs/60000)),pomodoros:paused.completedFocus,token});
  }
  const seconds=Math.ceil(timer.remainingMs/1000),clock=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  const active=timer.running||timer.focusMs>0||timer.completedFocus>0;
  const progress=100*(1-timer.remainingMs/timer.totalMs);
  if(!expanded)return active?<section className="pomodoro-compact" aria-label="Pomodoro em andamento"><Timer size={21}/><div><strong>{phaseLabels[timer.phase]} · {clock}</strong><span>{context.topic}</span></div><button className="secondary-button small-button" onClick={onOpen}>Abrir timer</button></section>:null;
  return <section className={`pomodoro-panel phase-${timer.phase}`} aria-label="Timer Pomodoro">
    <div className="pomodoro-main"><div className="pomodoro-heading"><span className="eyebrow">SUA MISSÃO AGORA</span><button className="icon-button" aria-label="Opções do Pomodoro" aria-expanded={options} onClick={()=>setOptions(!options)}><Settings2 size={20}/></button></div>
      <div className="pomodoro-tabs" role="group" aria-label="Etapa do timer">{(Object.keys(phaseLabels) as Phase[]).map(phase=><button key={phase} aria-pressed={timer.phase===phase} className={timer.phase===phase?"active":""} onClick={()=>{if(timer.running&&!window.confirm("Interromper a etapa atual e trocar?"))return;setTimer(changePhase(timerRef.current,phase,settings));}}>{phaseLabels[phase]}</button>)}</div>
      <div className="pomodoro-clock" style={{"--timer-progress":`${progress}%`} as React.CSSProperties}><div><span>{timer.phase==="focus"?<Timer size={21}/>:<Coffee size={21}/>} {phaseLabels[timer.phase]}</span><strong role="timer" aria-label={`${phaseLabels[timer.phase]}: ${clock}`}>{clock}</strong><small>Bloco {timer.round%settings.rounds+1} de {settings.rounds}</small></div></div>
      <div className="pomodoro-controls"><button className="icon-button" title="Reiniciar etapa" aria-label="Reiniciar etapa" onClick={()=>{if(window.confirm("Reiniciar esta etapa? O tempo de foco já estudado será preservado para registro."))setTimer(changePhase(timerRef.current,timer.phase,settings));}}><RotateCcw size={21}/></button><button className="primary-button pomodoro-start" disabled={!ready} onClick={()=>{unlockAudio();setTimer(setRunning(timerRef.current,!timer.running));}}>{timer.running?<Pause size={22}/>:<Play size={22} fill="currentColor"/>}{timer.running?"Pausar":"Começar"}</button><button className="icon-button" title="Pular etapa" aria-label="Pular etapa" onClick={()=>{const next=timer.phase==="focus"?(timer.round%settings.rounds===settings.rounds-1?"long":"short"):"focus";setTimer(changePhase(timerRef.current,next,settings));setNotice("Etapa pulada. Somente blocos de foco completos contam para conquistas.");}}><SkipForward size={22}/></button></div>
      <p className="pomodoro-notice" role="status">{notice||"Um bloco de cada vez. As pausas também fazem parte do caminho."}</p>
    </div>
    <div className="pomodoro-side"><h2>Prepare seu foco</h2><label className="form-field">Disciplina<select className="form-select" value={context.subjectId} disabled={active} onChange={e=>setContext({subjectId:e.target.value,topic:context.topic})}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="form-field">O que você vai estudar?<input className="form-input" value={context.topic} maxLength={200} disabled={active} onChange={e=>setContext({...context,topic:e.target.value||"Sessão livre de estudo"})}/></label>
      <div className="pomodoro-bank"><span>FOCO PARA REGISTRAR</span><strong>{Math.floor(timer.focusMs/60000)} min</strong><p>{timer.completedFocus} {timer.completedFocus===1?"Pomodoro completo":"Pomodoros completos"} · pausas excluídas</p></div>
      <button className="primary-button" disabled={timer.focusMs<60000} onClick={register}>Registrar estudo e ganhar XP</button><small>O registro pede sua confirmação. Só os blocos completos contam como Pomodoros; o foco parcial também conta como tempo estudado.</small>
      {active&&<button className="ghost-button" onClick={()=>{if(window.confirm("Descartar todo o tempo ainda não registrado e recomeçar?"))setTimer(newTimer(settings));}}><X size={15}/>Descartar sessão</button>}
      <button className="section-link" onClick={()=>setOptions(!options)}><Settings2 size={15}/>{options?"Fechar configurações":"Personalizar meu ritmo"}</button>
    </div>
    {options&&<div className="pomodoro-options"><h3>Do seu jeito</h3><div className="pomodoro-presets">{[[25,5,15],[50,10,20],[90,15,30]].map(([focus,short,long])=><button className="secondary-button small-button" key={focus} onClick={()=>updateSettings({...settings,focus,short,long})}>{focus}/{short}/{long} min</button>)}</div><div className="form-grid">{([["focus","Foco (min)",180],["short","Pausa curta (min)",60],["long","Pausa longa (min)",120],["rounds","Pausa longa a cada",12]] as const).map(([key,label,max])=><label className="form-field" key={key}>{label}<input className="form-input" type="number" min={key==="rounds"?2:1} max={max} value={settings[key]} onChange={e=>updateSettings({...settings,[key]:Number(e.target.value)})}/></label>)}</div><p className="field-hint">Mudanças de duração valem a partir da próxima etapa ou ao reiniciar a atual.</p><div className="pomodoro-switches"><label><input type="checkbox" checked={settings.autoBreak} onChange={e=>updateSettings({...settings,autoBreak:e.target.checked})}/>Iniciar pausas automaticamente</label><label><input type="checkbox" checked={settings.autoFocus} onChange={e=>updateSettings({...settings,autoFocus:e.target.checked})}/>Iniciar foco automaticamente</label><label><input type="checkbox" checked={settings.sound} onChange={e=>{updateSettings({...settings,sound:e.target.checked});if(e.target.checked){settingsRef.current={...settings,sound:true};unlockAudio();}}}/>Som ao concluir</label><label><input type="checkbox" checked={settings.notifications} onChange={e=>void notifications(e.target.checked)}/>Notificações do navegador</label></div></div>}
    {!soundAvailable&&<p className="field-hint">O som não está disponível. Os alertas visuais continuam ativos.</p>}{!storageAvailable&&<p className="field-hint">O navegador bloqueou o armazenamento do timer. Mantenha esta página aberta para preservar a sessão.</p>}
  </section>;
}
