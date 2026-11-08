"use client";
import { useState } from "react";
import { GraduationCap, Trophy } from "lucide-react";
import { levelTitle } from "@/lib/achievements";
import type { calculateStats } from "@/lib/study";

export default function AchievementsPanel({stats}:{stats:ReturnType<typeof calculateStats>}) {
  const [category,setCategory]=useState("Todas");
  const [earnedOnly,setEarnedOnly]=useState(false);
  const unlocked=stats.achievements.filter(a=>a.unlocked);
  const next=stats.achievements.filter(a=>!a.unlocked).sort((a,b)=>b.value/b.target-a.value/a.target)[0];
  return <>
    <div className="page-heading"><div><p className="eyebrow">A SUA JORNADA TEM RECOMPENSAS</p><h1 className="page-title">Cada vitória faz você evoluir.</h1><p className="page-subtitle">Complete desafios, ganhe bônus de experiência e alcance novos níveis.</p></div></div>
    <section className="level-panel"><span className="level-emblem"><GraduationCap size={34}/></span><div><span className="eyebrow">{unlocked.length} DE {stats.achievements.length} CONQUISTAS</span><h2>{levelTitle(stats.level)} · nível {stats.level}</h2><p>{stats.xp.toLocaleString("pt-BR")} XP · {stats.achievementXp.toLocaleString("pt-BR")} de conquistas</p><progress className="achievement-progress" max={500} value={stats.xp%500} aria-label="Experiência para o próximo nível"/><small>Faltam {500-stats.xp%500} XP para o nível {stats.level+1}</small></div><Trophy size={52}/></section>
    {next&&<div className="tip-card"><span className="achievement-icon">{next.icon}</span><div><strong>Próxima missão: {next.title}</strong><p>{next.description} · Recompensa: +{next.xp} XP</p></div></div>}
    <div className="filter-bar"><label className="form-field">Categoria<select className="form-select" value={category} onChange={e=>setCategory(e.target.value)}>{["Todas",...new Set(stats.achievements.map(a=>a.category))].map(c=><option key={c}>{c}</option>)}</select></label><label className="achievement-toggle"><input type="checkbox" checked={earnedOnly} onChange={e=>setEarnedOnly(e.target.checked)}/>Só conquistadas</label></div>
    <div className="achievements-grid">{stats.achievements.filter(a=>(category==="Todas"||a.category===category)&&(!earnedOnly||a.unlocked)).map(a=><article key={a.id} className={`achievement-card ${a.unlocked?"earned":"locked"}`}><div className="card-heading"><span className="achievement-icon">{a.icon}</span><span className="achievement-reward">+{a.xp} XP</span></div><span className={`badge ${a.unlocked?"success":""}`}>{a.unlocked?"Conquistado":"Em progresso"}</span><h2>{a.title}</h2><p>{a.description}</p><progress className="achievement-progress" max={a.target} value={a.unlocked?a.target:Math.min(a.target,a.value)} aria-label={`Progresso: ${a.title}`}/><small>{a.unlocked?"Recompensa recebida":`${Math.min(a.target,a.value).toLocaleString("pt-BR")} / ${a.target.toLocaleString("pt-BR")}`}</small></article>)}</div>
    {earnedOnly&&!unlocked.length&&<p className="empty-state">Seu primeiro estudo abre esta jornada.</p>}
    <p className="field-hint">XP de estudo: 2 por minuto + 3 por acerto + 25 por tópico concluído. Cada conquista acrescenta o bônus indicado uma única vez. Um novo nível a cada 500 XP; medalhas conquistadas ficam guardadas.</p>
  </>;
}
