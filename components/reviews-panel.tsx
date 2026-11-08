"use client";
import { useMemo, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { completeReview, reviewWindows } from "@/lib/reviews";
import { todayKey, type StudyState } from "@/lib/study";
import { variantLabels } from "@/lib/planner";

const label=(d:string)=>new Date(`${d}T12:00:00-03:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"});
export default function ReviewsPanel({state,onChange,notify}:{state:StudyState;onChange:(fn:(s:StudyState)=>StudyState)=>void;notify:(message:string)=>void}) {
  const [filter,setFilter]=useState("due");
  const today=todayKey();
  const windows=useMemo(()=>state.planner?reviewWindows(state.planner):[],[state.planner]);
  const active=state.reviews.filter(r=>!r.completed);
  const due=active.filter(r=>r.dueDate<=today);
  const visible=state.reviews.filter(r=>filter==="completed"?r.completed:!r.completed&&(filter==="due"?r.dueDate<=today:r.dueDate>today)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const history=state.reviewCompletions||[];
  return <>
    <div className="page-heading"><div><p className="eyebrow">REENCONTROS NO SEU CALENDÁRIO</p><h1 className="page-title">Revisar faz parte do ciclo.</h1><p className="page-subtitle">{state.planner?"Revisões cumulativas, ciclos agrupados e revisão final, conforme a organização da página 6 do seu material.":"Suas revisões e o histórico de aprendizado."}</p></div></div>
    {state.planner&&<section className="section-panel review-calendar"><div className="card-heading"><h2 className="section-title">Calendário de revisões · {variantLabels[state.planner.variant]}</h2><span className="chip">{history.length} concluídas</span></div><p className="field-hint">Cada conteúdo entra na próxima etapa que inclui seu ciclo. O prazo vale para toda a semana. Alterações no calendário do ciclo atualizam estas datas.{state.planner.variant==="flex"?" No Flex, as semanas acompanham o início escolhido; a página 6 não fixa datas intermediárias para esse ritmo.":""}</p><div className="review-windows">{windows.map(w=><article key={w.id} className={w.start<=today&&w.end>=today?"current":""}><span>{w.kind==="final"?"🏁":w.kind==="cumulative"?"🔁":"📚"}</span><div><strong>{w.title}</strong><small>{label(w.start)} a {label(w.end)}</small></div><span className="badge">{active.filter(r=>r.calendar?.weekId===w.id).length} conteúdos</span></article>)}</div>{!windows.length&&<p className="inline-alert">Não há uma janela de revisão antes da prova neste calendário. Confira o início dos ciclos.</p>}</section>}
    <div className="filter-bar"><div className="tabs">{[["due",`Para revisar (${due.length})`],["upcoming","Próximas"],["completed","Sem novas etapas"]].map(([id,title])=><button className={`tab ${filter===id?"active":""}`} key={id} onClick={()=>setFilter(id)}>{title}</button>)}</div><span className="chip"><RefreshCw size={14}/>{state.planner?"Revisão por ciclos":"Revisões"}</span></div>
    <div className="review-list">{visible.map(r=>{const subject=state.subjects.find(s=>s.id===r.subjectId);const overdue=(r.calendar?.endDate||r.dueDate)<today;return <section className="review-card" key={r.id}><div className="review-info"><span className="subject-icon" style={{color:subject?.color}}><RefreshCw size={21}/></span><div><p className="study-meta">{subject?.name}</p><h2>{r.title}</h2><span className={`due-badge ${overdue&&!r.completed?"overdue":""}`}>{r.completed?"Sem novas etapas de revisão neste calendário":r.calendar?`${r.calendar.label} · ${label(r.dueDate)} a ${label(r.calendar.endDate!)}`:`Revisão: ${label(r.dueDate)}`}</span>{overdue&&!r.completed&&<p className="field-hint">Janela encerrada · conteúdo continua pendente até você revisar.</p>}</div></div>{!r.completed&&<div className="review-actions"><small>{r.dueDate>today?"Disponível na semana agendada":"Depois de revisar, como foi?"}</small><div>{(["again","good","easy"] as const).map((rating,i)=><button key={rating} disabled={r.dueDate>today} className={`${i===2?"primary":"secondary"}-button small-button`} onClick={()=>{onChange(s=>completeReview(s,r.id,rating));notify(rating==="again"?"Conteúdo mantido nesta etapa para você retomar. A data segue o calendário.":"Revisão concluída! Próxima etapa atualizada conforme o ciclo.");}}>{["Preciso retomar","Lembrei bem","Foi fácil"][i]}{i===2&&<Check size={14}/>}</button>)}</div></div>}</section>;})}</div>
    {!visible.length&&<div className="empty-state"><RefreshCw size={30}/><h3>{filter==="due"?"Tudo em dia por aqui!":"Nenhum conteúdo nesta lista."}</h3><p>Os estudos e o caderno de erros alimentam suas revisões no calendário.</p></div>}
    {history.length>0&&<details className="section-panel review-history"><summary>Histórico · {history.length} revisões concluídas</summary>{history.slice().reverse().slice(0,50).map(entry=><p key={entry.id}><Check size={14}/> {label(entry.date)} · {state.reviews.find(r=>r.id===entry.reviewId)?.title||"Conteúdo revisado"}</p>)}</details>}
  </>;
}
