"use client";
import { useState } from "react";
import type { StudyState } from "@/lib/study";
import type { TopicProgress } from "@/lib/notebook-schema";
import { metricsForTopic, performance, progressFor } from "@/lib/notebook";
import { NOTION_SOURCE, tjspSyllabus } from "@/lib/tjsp-syllabus";

type Props={state:StudyState;onChange:(fn:(s:StudyState)=>StudyState)=>void};
export default function SyllabusPanel({state,onChange}:Props){
  const [query,setQuery]=useState("");const [subjectId,setSubjectId]=useState("");const [scope,setScope]=useState("tjsp");
  const sections=scope==="tjsp"?tjspSyllabus:state.subjects;
  const update=(subject:string,topic:string,patch:Partial<TopicProgress>)=>onChange(s=>{
    const p={...progressFor(s,subject,topic),...patch};
    const key=`${subject}:${s.subjects.find(x=>x.id===subject)?.topics.indexOf(topic)}`;
    return {...s,topicProgress:[...(s.topicProgress||[]).filter(x=>!(x.subjectId===subject&&x.topic===topic)),p],
      completedTopics:patch.status ? patch.status==="Concluído"?[...new Set([...s.completedTopics,key])]:s.completedTopics.filter(x=>x!==key):s.completedTopics};
  });
  const total=sections.reduce((n,s)=>n+s.topics.length,0);
  const done=sections.reduce((n,s)=>n+s.topics.filter(t=>state.completedTopics.includes(`${s.id}:${state.subjects.find(x=>x.id===s.id)?.topics.indexOf(t)}`)).length,0);
  return <div className="notebook-panel">
    <div className="inline-info"><p><strong>Edital verticalizado · TJ São Paulo</strong><br/>Referência do Notion, consultada em 10/11/2026. Os percentuais são recalculados a partir dos registros vinculados a cada assunto. <a href={NOTION_SOURCE} target="_blank" rel="noreferrer">Abrir referência</a></p></div>
    <div className="notebook-filters">
      <label>Buscar conteúdo<input className="form-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: crase, prazos, Excel…"/></label>
      <label>Disciplina<select className="form-input" value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">Todas as disciplinas</option>{sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Visualização<select className="form-input" value={scope} onChange={e=>{setScope(e.target.value);setSubjectId("");}}><option value="tjsp">Edital TJSP (Notion)</option><option value="all">Todos os meus tópicos</option></select></label>
    </div>
    <div className="notebook-summary"><span><strong>{done} / {total}</strong> tópicos concluídos</span><span className="performance ruim">Ruim: abaixo de 60%</span><span className="performance regular">Regular: 60% a 85%</span><span className="performance bom">Bom: acima de 85%</span></div>
    <p className="field-hint">Questões (%) = acertos ÷ questões válidas. Sem questões, o desempenho fica em branco. Marque o andamento e as revisões conforme concluir cada etapa. Alterações futuras no Notion não são sincronizadas.</p>
    {sections.filter(s=>!subjectId||s.id===subjectId).map(s=>{
      const topics=s.topics.filter(t=>`${s.name} ${t}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
      if(!topics.length)return null;
      const legal=!["portugues","informatica","matematica","raciocinio"].includes(s.id);
      const steps: [keyof Pick<TopicProgress,"reverse"|"theory"|"law"|"lesson"|"review1"|"review2"|"review3">,string][]=[ ["reverse","Estudo reverso"],...(legal?[["law","Leitura da lei"],["lesson","Aula/PDF"]] as ["law"|"lesson",string][]:[["theory","Teoria"]] as ["theory",string][]),["review1","Revisão 1"],["review2","Revisão 2"],["review3","Revisão 3"]];
      return <section className="notebook-section" key={s.id}><h2>{s.name} <small>{topics.length} tópicos</small></h2><div className="notebook-table-scroll"><table className="notebook-table syllabus-table"><thead><tr><th scope="col">Conteúdo</th><th scope="col">Status</th><th scope="col">Questões (%)</th><th scope="col">Desempenho</th>{steps.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{topics.map(topic=>{
        const p=progressFor(state,s.id,topic);const m=metricsForTopic(state,s.id,topic);const label=performance(m.apparent);
        const completed=state.completedTopics.includes(`${s.id}:${state.subjects.find(x=>x.id===s.id)?.topics.indexOf(topic)}`);
        return <tr key={topic}><th scope="row">{topic}</th><td><select aria-label={`Status: ${topic}`} value={completed?"Concluído":p.status} onChange={e=>update(s.id,topic,{status:e.target.value as TopicProgress["status"]})}>{["Pendente","Em andamento","Concluído"].map(v=><option key={v}>{v}</option>)}</select></td><td><strong>{m.apparent===null?"—":`${m.apparent.toFixed(1)}%`}</strong><small>{m.questions?`${m.correct} / ${m.questions}`:"Sem registros"}</small></td><td><span className={`performance ${label.toLowerCase().replace(" ","-")}`}>{label}</span></td>{steps.map(([key,name])=><td className="check-cell" key={key}><input type="checkbox" aria-label={`${name}: ${topic}`} checked={p[key]} onChange={e=>update(s.id,topic,{[key]:e.target.checked})}/></td>)}</tr>;
      })}</tbody></table></div></section>;
    })}
  </div>;
}
