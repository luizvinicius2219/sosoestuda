"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, CheckCheck, Globe2, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import type { AssistantMessage } from "@/lib/assistant-schema";

const prompts=["Me ajude a organizar meus estudos de hoje.","Registre um estudo que acabei de fazer.","Pesquise novidades oficiais sobre o meu concurso.","Me explique uma dúvida e faça perguntas para eu praticar."];
function linkedText(text:string):ReactNode[]{
  const nodes:ReactNode[]=[];
  const pattern=/\[([^\]\n]{1,300})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]+)/g;
  let cursor=0;for(const match of text.matchAll(pattern)){
    if(match.index!>cursor)nodes.push(text.slice(cursor,match.index));
    const href=match[2]||match[3];nodes.push(<a key={match.index} href={href} target="_blank" rel="noreferrer">{match[1]||href}</a>);cursor=match.index!+match[0].length;
  }
  if(cursor<text.length)nodes.push(text.slice(cursor));return nodes;
}
function Message({message}:{message:AssistantMessage}){
  const csp="default-src 'none'; style-src 'unsafe-inline'; img-src data: https://www.gstatic.com; base-uri 'none'; form-action 'none'";
  return <article className={`lia-message ${message.role}`}><div className="lia-message-label">{message.role==="assistant"?<><span className="lia-avatar"><Sparkles size={16}/></span>Lia</>:"Você"}<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Recife"})}</time></div><div className="lia-message-content">{linkedText(message.content)}</div>
    {!!message.actions?.length&&<div className="lia-action-list">{message.actions.map((action,i)=><div key={`${action.id}-${i}`}><CheckCheck size={16}/><span>{action.title}</span><small>Salvo no app</small></div>)}</div>}
    {!!message.sources?.length&&<div className="lia-sources"><strong><Globe2 size={14}/> Fontes da pesquisa</strong>{message.sources.map((source,i)=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>{i+1}</span>{source.title}</a>)}</div>}
    {message.searchHtml&&<iframe className="lia-search-suggestions" title="Sugestões de pesquisa do Google" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"></head><body style="margin:0">${message.searchHtml}</body></html>`}/>}
  </article>;
}

export default function LiaPanel({messages,configured,busy,initialPrompt,onSend}:{messages:AssistantMessage[];configured:boolean;busy:boolean;initialPrompt:{id:string;text:string}|null;onSend:(input:{message:string;requestId:string;web:boolean;actions:boolean})=>Promise<void>}){
  const [text,setText]=useState(initialPrompt?.text||"");const [web,setWeb]=useState(true),[actions,setActions]=useState(true),[error,setError]=useState("");
  const bottom=useRef<HTMLDivElement|null>(null),input=useRef<HTMLTextAreaElement|null>(null);
  const attempt=useRef<{key:string;id:string}|null>(null);
  useEffect(()=>{if(initialPrompt)input.current?.focus();},[initialPrompt]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:"nearest",behavior:"instant"});},[messages.length,busy]);
  async function send(){
    const message=text.trim();if(!message||busy||!configured)return;
    const key=JSON.stringify({message,web,actions});if(attempt.current?.key!==key)attempt.current={key,id:crypto.randomUUID()};
    setError("");
    try{await onSend({message,requestId:attempt.current.id,web,actions});setText("");attempt.current=null;input.current?.focus();}
    catch(e){setError(e instanceof Error?e.message:"Não consegui enviar agora. Tente novamente.");}
  }
  return <section className="lia-panel" aria-label="Conversa com a Lia">
    <div className="lia-profile"><span className="lia-avatar large"><Sparkles size={28}/></span><div><span className="eyebrow">SUA PARCEIRA DE APROVAÇÃO</span><h1>Oi, eu sou a Lia <span>💜</span></h1><p>Vamos juntas: uma dúvida, um plano e uma conquista de cada vez.</p></div><span className={`lia-status ${configured?"online":""}`}>{configured?"Conectada ao Gemini":"Aguardando conexão"}</span></div>
    {!configured&&<p className="inline-alert">A conexão com o Gemini ainda precisa ser configurada pelo responsável pelo app.</p>}
    <div className="lia-conversation" role="log" aria-label="Histórico da conversa" aria-live="polite" aria-busy={busy}>
      {!messages.length&&<div className="lia-welcome"><MessageCircle size={30}/><h2>Em que eu te ajudo hoje, Sofia?</h2><p>Posso explicar conteúdos, pesquisar informações atuais e cuidar dos registros que você me pedir. Se faltar um detalhe, a gente resolve juntas.</p><div className="lia-starters">{prompts.map(prompt=><button className="secondary-button" key={prompt} disabled={busy||!configured} onClick={()=>{setText(prompt);input.current?.focus();}}>{prompt}</button>)}</div></div>}
      {messages.map(message=><Message key={message.id} message={message}/>)}
      {busy&&<><article className="lia-message user"><div className="lia-message-label">Você</div><div className="lia-message-content">{text}</div></article><div className="lia-thinking" role="status"><RefreshCw size={16} className="spin"/>A Lia está pensando e conferindo o que você pediu…</div></>}
      <div ref={bottom}/>
    </div>
    <form className="lia-composer" onSubmit={e=>{e.preventDefault();void send();}}><div className="lia-permissions"><label><input type="checkbox" checked={web} disabled={busy} onChange={e=>setWeb(e.target.checked)}/><Globe2 size={15}/>Pesquisar na internet</label><label><input type="checkbox" checked={actions} disabled={busy} onChange={e=>setActions(e.target.checked)}/><CheckCheck size={15}/>Fazer registros no app</label></div><div className="lia-input-row"><textarea ref={input} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} aria-label="Mensagem para a Lia" placeholder="Lia, hoje estudei 40 minutos de Português…" rows={3} maxLength={3000} disabled={busy||!configured} required/><button className="primary-button" type="submit" disabled={busy||!configured||!text.trim()} aria-label="Enviar mensagem para a Lia">{busy?<RefreshCw size={20} className="spin"/>:<ArrowUp size={22}/>}</button></div>{error&&<p className="error-text" role="alert">{error}</p>}<small>Seu histórico fica na sua conta. A Lia usa o contexto dos estudos e o Gemini para responder. Pedidos de registro são salvos no app; confira as fontes ao estudar informações atuais.</small></form>
  </section>;
}
