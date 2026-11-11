"use client";

import { useCallback, useEffect, useRef, useState, useMemo, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, Bell, BookOpen, Bookmark, CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight, Clock3, Coffee, ExternalLink, Flame, GraduationCap, LayoutDashboard, ListChecks, Menu, MessageCircle, NotebookPen, Play, Plus, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Target, Trash2, Trophy, Timer, TrendingUp, X, Zap } from "lucide-react";
import SofiaCharacter from "./sofia-character";
import Mascot from "./Mascot";
import CyclesPanel, { PlannerOverview } from "./cycles-panel";
import LiaPanel from "./lia-panel";
import PomodoroPanel, { type FocusRegistration, type FocusRequest } from "./pomodoro-panel";
import ReviewsPanel from "./reviews-panel";
import AchievementsPanel from "./achievements-panel";
import QuestionsPanel from "./questions-panel";
import SyllabusPanel from "./syllabus-panel";
import { levelTitle } from "@/lib/achievements";
import type { PlannerRef } from "@/lib/planner-schema";
import { addDays, calculateStats, completeStudy, createInitialState, reconcileStudyState, studyStateSchema, todayKey, type StudyState, type StudyTask, type Subject, type StudyNote, type StudyError } from "@/lib/study";

type Page = "lia" | "focus" | "cycles" | "home" | "planning" | "syllabus" | "questions" | "reviews" | "errors" | "notes" | "news" | "achievements" | "stats" | "settings";
type User = { name: string; email: string };
type NewsItem = { tribunal: string; date: string; category: string; title: string; summary: string; url: string };
type NewsData = { items: NewsItem[]; mode: "live" | "curated"; checkedAt: string; verifiedAt: string; message?: string };
type Modal = "study" | "task" | "subject" | "note" | "error" | "goal" | "notifications" | null;
const pages: { id: Page; label: string; icon: typeof BookOpen; section?: string }[] = [
  { id: "lia", label: "Conversar com a Lia", icon: MessageCircle },
  { id: "home", label: "Meu início", icon: LayoutDashboard },
  { id: "focus", label: "Timer Pomodoro", icon: Timer },
  { id: "cycles", label: "Meu ciclo", icon: RefreshCw },
  { id: "planning", label: "Planejamento", icon: CalendarDays },
  { id: "syllabus", label: "Meu edital", icon: ListChecks },
  { id: "questions", label: "Caderno de questões", icon: NotebookPen },
  { id: "reviews", label: "Revisões", icon: RefreshCw },
  { id: "errors", label: "Caderno de erros", icon: NotebookPen, section: "APRENDER E EVOLUIR" },
  { id: "notes", label: "Anotações", icon: Bookmark },
  { id: "stats", label: "Meu desempenho", icon: TrendingUp },
  { id: "news", label: "Radar de concursos", icon: GraduationCap, section: "ALÉM DOS ESTUDOS" },
  { id: "achievements", label: "Conquistas", icon: Trophy },
];
const uid = () => crypto.randomUUID();
const formatMinutes = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}min` : ""}`.trim() : `${m}min`;
const dateLabel = (d: string, short = false) => new Date(`${d}T12:00:00-03:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: short ? "2-digit" : "short" });
const recordDate = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value).toLocaleDateString("pt-BR", { timeZone: "America/Recife" });
const safeUrl = (s?: string) => s && /^https?:\/\//i.test(s) ? s : undefined;

export default function StudyApp({ initialUser }: { initialUser: User | null }) {
  const [page, setPage] = useState<Page>("home");
  const [state, setState] = useState<StudyState>(() => reconcileStudyState(createInitialState(!initialUser)));
  const [loading, setLoading] = useState(!!initialUser);
  const [loadError, setLoadError] = useState("");
  const [sync, setSync] = useState("saved");
  const [dirty, setDirty] = useState(0);
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const revision = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const conflict = useRef(false);
  const assistantLock = useRef(false);
  const savedRevision = useRef(0);
  const [modal, setModal] = useState<Modal>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [news, setNews] = useState<NewsData | null>(null);
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [selectedPlannerRef, setSelectedPlannerRef] = useState<PlannerRef | undefined>();
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);
  const [editingNote, setEditingNote] = useState<StudyNote | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [focusRegistration, setFocusRegistration] = useState<FocusRegistration | null>(null);
  const [timerReceipt, setTimerReceipt] = useState("");
  const [celebration, setCelebration] = useState("");
  const previousProgress = useRef<{level:number;ids:Set<string>} | null>(null);
  const [formError, setFormError] = useState("");
  const [assistantConfigured, setAssistantConfigured] = useState(false);
  const [liaPrompt, setLiaPrompt] = useState<{id:string;text:string}|null>(null);
  const [asking, setAsking] = useState(false);
  const [notificationState, setNotificationState] = useState("default");
  const [planningDate, setPlanningDate] = useState(todayKey());
  const [loadedLocal, setLoadedLocal] = useState(false);
  const [recoverableDraft, setRecoverableDraft] = useState<StudyState | null>(null);
  const [today, setToday] = useState(todayKey);
  const stats = useMemo(() => calculateStats(state, today), [state, today]);
  const achievementDefs = stats.achievements;
  const due = state.reviews.filter(r => !r.completed && r.dueDate <= today);
  const todaysTasks = state.tasks.filter(t => t.date === today);
  const doneTasks = todaysTasks.filter(t => t.done).length;
  const todayMinutes = state.sessions.filter(s => s.date === today).reduce((n, s) => n + s.minutes, 0);
  const dailyPct = Math.min(100, Math.round(todayMinutes / state.profile.dailyMinutes * 100));
  const weeklyPct = Math.min(100, Math.round(stats.weekMinutes / state.profile.weeklyMinutes * 100));
  const examDays = state.profile.examDate ? Math.round((Date.parse(`${state.profile.examDate}T12:00:00-03:00`) - Date.parse(`${today}T12:00:00-03:00`)) / 86400000) : null;
  const firstName = (state.profile.name || initialUser?.name || "Soso").split(" ")[0];
  const subject = (id: string) => state.subjects.find(s => s.id === id) ?? state.subjects[0];
  const notify = useCallback((message: string) => setToast(message), []);
  const mutate = useCallback((fn: (s: StudyState) => StudyState) => { if(assistantLock.current){notify("A Lia está concluindo seu pedido. Aguarde um instante para editar os estudos.");return;} revision.current += 1; setState(s => reconcileStudyState(fn(reconcileStudyState(s)))); setDirty(revision.current); }, [notify]);

  useEffect(() => {
    const tick = setInterval(() => setToday(todayKey()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const onHash = () => { const hash = location.hash.slice(1) as Page; if (pages.some(p => p.id === hash) || hash === "settings") setPage(hash); };
    onHash(); window.addEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate the external browser permission after mounting.
    if ("Notification" in window) setNotificationState(Notification.permission);
    if (!initialUser) {
      try { const saved = localStorage.getItem("sosoestuda-demo-v1"); if (saved) { const parsed = studyStateSchema.safeParse(JSON.parse(saved)); if (parsed.success) setState(reconcileStudyState(parsed.data)); } } catch { /* Keep the recoverable demo when storage is unavailable. */ }
      setLoadedLocal(true);
    } else {
      fetch("/api/state", { cache: "no-store" }).then(async r => { if (!r.ok) throw new Error("Não foi possível abrir seus estudos. Tente recarregar a página."); return r.json() as Promise<{state: StudyState; version:number; migrationNeeded?:boolean}>; }).then(data => {
        version.current = data.version;
        const remote = reconcileStudyState({ ...data.state, profile: { ...data.state.profile, name: data.state.profile.name || initialUser.name } });
        setState(remote);
        if (data.migrationNeeded) { revision.current += 1; setDirty(revision.current); }
        try {
          const draft = localStorage.getItem(`sosoestuda-draft:${initialUser.email}`);
          if (draft) { const parsed = studyStateSchema.safeParse(JSON.parse(draft)); if (parsed.success && JSON.stringify(reconcileStudyState(parsed.data)) !== JSON.stringify(remote)) setRecoverableDraft(parsed.data); }
        } catch { /* The remote state is still available. */ }
        setLoading(false);
      }).catch(e => { setLoadError(e.message); setLoading(false); });
    }
    fetch("/api/assistant").then(r => r.json() as Promise<{configured:boolean}>).then(d => setAssistantConfigured(!!d.configured)).catch(() => {});
    return () => window.removeEventListener("hashchange", onHash);
  }, [initialUser]);

  useEffect(() => {
    if (!dirty || loading || loadError || asking) return;
    if (!initialUser) {
      if (loadedLocal) try { localStorage.setItem("sosoestuda-demo-v1", JSON.stringify(state)); } catch {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Surface a failed external browser storage operation.
        setSync("error");
      }
      return;
    }
    const snapshot = state;
    const snapshotRevision = dirty;
    try { localStorage.setItem(`sosoestuda-draft:${initialUser.email}`, JSON.stringify(snapshot)); } catch { /* Cloud sync remains available. */ }
    if (conflict.current) return;
    setSync("saving");
    const timeout = setTimeout(() => {
      queue.current = queue.current.catch(() => {}).then(async () => {
        if (conflict.current || assistantLock.current) return;
        try {
          const r = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: snapshot, version: version.current }) });
          if (r.status === 409) { conflict.current = true; setSync("conflict"); return; }
          if (!r.ok) throw new Error();
          const data = await r.json() as {version:number}; version.current = data.version; savedRevision.current = snapshotRevision;
          if (revision.current === snapshotRevision) {
            setSync("saved");
            try { localStorage.removeItem(`sosoestuda-draft:${initialUser.email}`); } catch { /* Cloud save succeeded even if browser storage is blocked. */ }
          }
        } catch { setSync("error"); }
      });
    }, 700);
    return () => clearTimeout(timeout);
  }, [state, dirty, retry, initialUser, loading, loadError, loadedLocal, asking]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 4200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (loading) { previousProgress.current = null; return; }
    const current = {level:stats.level,ids:new Set(stats.achievements.filter(a=>a.unlocked).map(a=>a.id))};
    const previous = previousProgress.current;
    if (previous) {
      const earned = stats.achievements.filter(a=>a.unlocked&&!previous.ids.has(a.id));
      if (earned.length || current.level > previous.level) setCelebration(`${earned.length ? `${earned.map(a=>a.icon+" "+a.title).join(" · ")} · +${earned.reduce((n,a)=>n+a.xp,0)} XP` : ""}${current.level > previous.level ? ` ✨ Novo nível: ${current.level} · ${levelTitle(current.level)}!` : ""}`);
    }
    previousProgress.current = current;
  }, [stats.achievements, loading, stats.level]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const nodes = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, [role="dialog"] a[href]')].filter(n => !n.hasAttribute("disabled"));
        if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
      }
    };
    document.addEventListener("keydown", key); const timer = setTimeout(() => document.querySelector<HTMLElement>('[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] button')?.focus(), 50);
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { clearTimeout(timer); document.removeEventListener("keydown", key); document.body.style.overflow = overflow; previous?.focus(); };
  }, [modal]);

  const loadNews = useCallback(async () => {
    setNewsBusy(true); setNewsError("");
    try { const r = await fetch("/api/news", { cache: "no-store" }); if (!r.ok) throw new Error(); setNews(await r.json()); } catch { setNewsError("Não foi possível consultar as fontes agora. Tente novamente."); } finally { setNewsBusy(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch and reflect the external news feed for the current page.
  useEffect(() => { if (page === "home" || page === "news") void loadNews(); }, [page, loadNews]);

  function navigate(p: Page) { setPage(p); setQuery("");setFilter("all");setMobileOpen(false);window.history.pushState(null,"",`#${p}`); }
  function openModal(m: Modal) { setFormError(""); setModal(m); }
  function openTask(task?:StudyTask) { setEditingTask(task||null); if(task)setPlanningDate(task.date);openModal("task"); }
  function openStudy(task?: StudyTask) { setFocusRegistration(null); setSelectedSubject(task?.subjectId || state.subjects[0]?.id || ""); setSelectedTopic(task?.title || ""); setSelectedTask(task?.id || ""); setSelectedPlannerRef(task?.plannerRef); openModal("study"); }
  function startFocus(task?: StudyTask) {
    if (!state.subjects.length) { openModal("subject"); return; }
    if(task) setFocusRequest({id:uid(),subjectId:task.subjectId,topic:task.title,taskId:task.id,...(task.plannerRef?{plannerRef:task.plannerRef}:{})});
    navigate("focus");
  }
  function registerFocus(value:FocusRegistration) { setFocusRegistration(value);setSelectedSubject(value.subjectId);setSelectedTopic(value.topic);setSelectedTask(value.taskId||"");setSelectedPlannerRef(value.plannerRef);openModal("study"); }
  function submitStudy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const minutes = Number(f.get("minutes")), questions = Number(f.get("questions")), correct = Number(f.get("correct"));
    if (correct > questions) { setFormError("O número de acertos não pode ser maior que o de questões."); return; }
    const topic = String(f.get("topic")).trim(); const subjectId = String(f.get("subjectId"));
    if (!topic) { setFormError("Informe o conteúdo que você estudou."); return; }
    mutate(s => { const next = completeStudy(s, { subjectId, topic, minutes, questions, correct, ...(focusRegistration ? {pomodoros:focusRegistration.pomodoros} : {}), ...(selectedPlannerRef && subjectId===selectedSubject ? {plannerRef:selectedPlannerRef} : {}) }); return { ...next, tasks: next.tasks.map(t => t.id === selectedTask ? { ...t, recordedMinutes:(t.recordedMinutes||(t.done?t.minutes:0))+minutes, done:(t.recordedMinutes||(t.done?t.minutes:0))+minutes>=t.minutes } : t) }; });
    if (focusRegistration) { setTimerReceipt(focusRegistration.token); setFocusRegistration(null); }
    setModal(null); notify("Estudo registrado! Revisões organizadas no seu calendário. +XP ✨");
  }
  function submitTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    if (!String(f.get("title")).trim()) { setFormError("Dê um nome para esta missão."); return; }
    const subjectId=String(f.get("subjectId"));
    const task:StudyTask={id:editingTask?.id||uid(),subjectId,title:String(f.get("title")).trim(),minutes:Number(f.get("minutes")),date:String(f.get("date")),recordedMinutes:editingTask?.recordedMinutes||(editingTask?.done?editingTask.minutes:0),done:(editingTask?.recordedMinutes||(editingTask?.done?editingTask.minutes:0)||0)>=Number(f.get("minutes")),...(editingTask?.plannerRef&&subjectId===editingTask.subjectId?{plannerRef:editingTask.plannerRef}:{})};
    mutate(s => ({...s,tasks:editingTask?s.tasks.map(t=>t.id===task.id?task:t):[...s.tasks,task]}));
    setModal(null); setEditingTask(null); notify("Missão salva no seu planejamento.");
  }
  function submitSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim(); const topics = String(f.get("topics")).split(/\r?\n/).map(t => t.trim().replace(/^[-•]\s*/, "")).filter(Boolean);
    const source = String(f.get("source") || "").trim();
    if (!name || !topics.length) { setFormError("Informe a disciplina e pelo menos um tópico, um por linha."); return; }
    if (source && !safeUrl(source)) { setFormError("Use um link que comece com https:// ou http://."); return; }
    if (topics.length > 300 || topics.some(t => t.length > 500)) { setFormError("Use até 300 tópicos por disciplina, com no máximo 500 caracteres por linha."); return; }
    mutate(s => ({ ...s, subjects: [...s.subjects, { id: uid(), name, short: name.split(" ").map(n => n[0]).join("").slice(0, 3).toUpperCase(), color: "#8b73ca", topics, ...(source ? { source } : {}) }] }));
    setModal(null); notify("Disciplina adicionada. Seu edital está ganhando forma!");
  }
  function submitNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    if (!String(f.get("title")).trim() || !String(f.get("content")).trim()) { setFormError("Escreva um título e uma anotação."); return; }
    const note: StudyNote = { id: editingNote?.id || uid(), subjectId: String(f.get("subjectId")), title: String(f.get("title")).trim(), content: String(f.get("content")).trim(), updatedAt: new Date().toISOString() };
    mutate(s => ({ ...s, notes: editingNote ? s.notes.map(n => n.id === note.id ? note : n) : [note, ...s.notes] }));
    setModal(null); setEditingNote(null); notify("Anotação guardada no seu caderno.");
  }
  function submitError(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const id = uid();
    if (!["question", "answer", "reason"].every(k => String(f.get(k)).trim())) { setFormError("Preencha a questão, a resposta e o que precisa lembrar."); return; }
    const error: StudyError = { id, subjectId: String(f.get("subjectId")), question: String(f.get("question")).trim(), answer: String(f.get("answer")).trim(), reason: String(f.get("reason")).trim(), createdAt: new Date().toISOString(), resolved: false };
    mutate(s => ({ ...s, errors: [error, ...s.errors], reviews: [...s.reviews, { id: uid(), subjectId: error.subjectId, title: `Caderno de erros: ${error.question.slice(0, 110)}`, dueDate: addDays(today, 1), interval: 1 }] }));
    setModal(null); notify("Erro registrado e revisão agendada. Errar também é aprender.");
  }
  function downloadData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `sosoestuda-${today}.json`; a.click(); URL.revokeObjectURL(url); notify("Seus estudos foram exportados.");
  }
  function openLia(prompt?:string) { if(prompt||page!=="lia")setLiaPrompt({id:uid(),text:(prompt||"").slice(0,3000)});navigate("lia"); }
  async function askAssistant(input:{message:string;requestId:string;web:boolean;actions:boolean}) {
    if (!initialUser) throw new Error("Entre na sua conta para conversar com a Lia.");
    if (assistantLock.current) throw new Error("A Lia já está cuidando de uma mensagem.");
    if (conflict.current || loadError || recoverableDraft) throw new Error("Resolva as alterações pendentes indicadas no topo antes de conversar com a Lia.");
    assistantLock.current = true; setAsking(true);
    try {
      await queue.current;
      if (conflict.current) throw new Error("Recarregue o app para obter a versão mais recente dos estudos.");
      if (savedRevision.current !== revision.current) {
        const response = await fetch("/api/state", {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({state,version:version.current})});
        if(response.status===409){conflict.current=true;setSync("conflict");throw new Error("Os estudos foram alterados em outra janela. Recarregue antes de conversar.");}
        if(!response.ok){setSync("error");throw new Error("Não consegui salvar suas últimas alterações. Tente salvar os estudos antes de conversar.");}
        const saved=await response.json() as {version:number};version.current=saved.version;savedRevision.current=revision.current;
      }
      setDirty(0);setSync("saved");
      try{localStorage.removeItem(`sosoestuda-draft:${initialUser.email}`);}catch{/* The cloud state is saved. */}
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,version:version.current})});
      const data=await response.json() as {error?:string;state:StudyState;version:number};
      if(!response.ok){if(response.status===409){conflict.current=true;setSync("conflict");}throw new Error(data.error||"Não consegui conversar agora. Tente novamente em instantes.");}
      const parsed=studyStateSchema.parse(data.state);
      version.current=data.version;revision.current+=1;savedRevision.current=revision.current;setState(parsed);setDirty(0);setSync("saved");
    } finally { assistantLock.current=false;setAsking(false); }
  }
  const subjectSelect = (defaultValue?: string) => <select className="form-select" name="subjectId" defaultValue={defaultValue || state.subjects[0]?.id} required>{state.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>;
  const progress = (value: number, color?: string) => <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, value)}%`, ...(color ? { background: color } : {}) }} /></div>;
  const subjectIcon = (s?: Subject) => <span className="subject-icon" style={{ background: `${s?.color || "#8b73ca"}18`, color: s?.color || "#8b73ca" }}><BookOpen size={20} /></span>;
  const heading = (eyebrow: string, title: ReactNode, subtitle: string, action?: ReactNode) => <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action && <div className="heading-actions">{action}</div>}</div>;
  const search = (placeholder: string) => <div className="search-field"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></div>;
  const empty = (title: string, detail: string, action?: ReactNode) => <div className="empty-state"><SofiaCharacter pose="think" className="empty-character"/><h3>{title}</h3><p>{detail}</p>{action}</div>;

  function TaskRow({ task }: { task: StudyTask }) {
    const s = subject(task.subjectId);
    return <div className={`study-row ${task.done ? "is-done" : ""}`}>{task.done ? <span className="subject-icon completed-icon"><CheckCheck size={20} /></span> : subjectIcon(s)}<div className="study-info"><span className="study-meta">{s?.name}</span><h3 className="study-title">{task.title}</h3></div><div className="study-actions"><span className="time-pill"><Clock3 size={13} /> {Math.max(0,task.minutes-(task.recordedMinutes||0))} min{task.recordedMinutes&&!task.done?" restantes":""}</span>{task.done ? <span className="badge success">Concluído</span> : <button className="play-button" aria-label={`Iniciar ${task.title}`} onClick={() => startFocus(task)}><Play size={15} fill="currentColor" /></button>}<button className="icon-button small" aria-label={`Pedir ajuda à Lia: ${task.title}`} onClick={()=>openLia(`Lia, me ajude a estudar ${task.title}, de ${s?.name}. Explique o conteúdo e proponha exercícios.`)}><Sparkles size={14}/></button><button className="icon-button small" aria-label={`Editar missão ${task.title}`} onClick={()=>openTask(task)}><NotebookPen size={14}/></button><button className="icon-button small" aria-label={`Excluir missão ${task.title}`} onClick={() => { if (window.confirm("Excluir esta missão do planejamento?")) mutate(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== task.id) })); }}><Trash2 size={14} /></button></div></div>;
  }

  return <div className="app-shell">
    {mobileOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    <aside inert={asking} className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
      <a className="brand" href="#home" onClick={() => navigate("home")}><span className="brand-icon"><BookOpen size={25} /><Sparkles size={13} className="brand-spark" /></span><span className="brand-name">soso<span>estuda</span><small className="brand-sub">seu próximo capítulo.</small></span></a>
      <button className="journey-card" onClick={() => openModal("goal")}><span className="journey-icon"><GraduationCap size={22} /></span><span><small className="journey-label">MINHA JORNADA</small><strong>{state.profile.goal || "Área judiciária"}</strong></span><ChevronDown size={15} /></button>
      <nav aria-label="Navegação principal"><div className="nav-section"><p className="nav-label">SEU ESPAÇO DE ESTUDOS</p>{pages.map(p => <div key={p.id}>{p.section && <p className="nav-label section-gap">{p.section}</p>}<a href={`#${p.id}`} className={`nav-item ${page === p.id ? "active" : ""}`} aria-current={page === p.id ? "page" : undefined} onClick={() => p.id==="lia"?openLia():navigate(p.id)}><p.icon size={19} className="nav-icon" /><span>{p.label}</span>{p.id === "reviews" && due.length > 0 && <span className="nav-badge">{due.length}</span>}{p.id === "news" && <span className="notification-dot" />}</a></div>)}</div></nav>
      <div className="sidebar-bottom"><div className="sidebar-motivation"><Sparkles size={18} /><p>Grandes conquistas<br />começam com pequenos passos.</p></div><button className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings2 size={18} />Preferências</button><div className="sidebar-user"><span className="avatar">{firstName.slice(0, 1).toUpperCase()}</span><span><strong>{firstName}</strong><small>{levelTitle(stats.level)} · nível {stats.level}</small></span><span className="level-badge">{stats.level}</span></div></div>
    </aside>
    <div className="main-area">
      <header inert={asking} className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu size={22} /></button><BookOpen size={15} /><span>Minha jornada</span><ChevronRight size={14} /><strong>{pages.find(p => p.id === page)?.label || "Preferências"}</strong></div><div className="topbar-actions">{examDays !== null && examDays >= 0 && <button className="exam-countdown" onClick={() => openModal("goal")}><Target size={14} />{examDays === 0 ? "Sua prova é hoje!" : `${examDays} dias para a prova`}</button>}<span className="topbar-streak"><Flame size={17} />{stats.streak} {stats.streak === 1 ? "dia" : "dias"}</span><button className="icon-button" aria-label="Central de lembretes" onClick={() => openModal("notifications")}><Bell size={19} />{due.length > 0 && <span className="notification-dot" />}</button><span className="topbar-divider" />{initialUser ? <button className="user-button" onClick={() => navigate("settings")}><span className="avatar small-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span>{firstName}</span><ChevronDown size={14} /></button> : <a className="secondary-button small-button" href="/login" target="_top">Entrar <ArrowRight size={14} /></a>}</div></header>
      <main className="content" id="main-content" inert={asking && page!=="lia"}>
        {!initialUser && <div className="demo-banner"><Sparkles size={15} /><span>Conheça sua próxima rotina de estudos. <strong>Você está no modo de demonstração.</strong></span><a href="/login" target="_top">Criar minha jornada <ArrowRight size={14} /></a></div>}
        {recoverableDraft && <div className="inline-alert"><span>Encontramos alterações deste navegador que ainda não estão na sua conta. Você pode recuperá-las antes de continuar.</span><button className="secondary-button" onClick={() => { mutate(() => recoverableDraft); setRecoverableDraft(null); notify("Rascunho recuperado. Salvando na sua conta…"); }}>Recuperar alterações</button><button className="ghost-button" onClick={() => { setRecoverableDraft(null); if (initialUser) try { localStorage.removeItem(`sosoestuda-draft:${initialUser.email}`); } catch { /* Storage may be unavailable. */ } }}>Usar versão da conta</button></div>}
        {loadError && <div className="inline-alert">{loadError}<button className="secondary-button" onClick={() => location.reload()}>Tentar novamente</button></div>}
        {(sync === "error" || sync === "conflict") && <div className="inline-alert">{sync === "conflict" ? "Seus estudos foram alterados em outra aba. Exporte suas alterações antes de recarregar." : "Não conseguimos salvar agora. Mantenha esta página aberta e tente novamente."}<button className="ghost-button" onClick={downloadData}>Exportar cópia</button>{sync === "error" && <button className="secondary-button" onClick={() => setRetry(r => r + 1)}>Tentar salvar</button>}</div>}
        {loading ? <div className="loading-state"><RefreshCw size={28} /><p>Abrindo seu espaço de estudos…</p></div> : loadError ? null : <>
        {page === "focus" && heading("FOCO COM RITMO E LEVEZA", "Seu próximo bloco começa aqui.", "Escolha seu ritmo, cuide das pausas e transforme dedicação em experiência.")}
        <div inert={asking}><PomodoroPanel subjects={state.subjects} storageKey={`sosoestuda-pomodoro-v1:${initialUser?.email||"demo"}`} expanded={page==="focus"} request={focusRequest} receipt={timerReceipt} onOpen={()=>navigate("focus")} onRegister={registerFocus} notify={notify}/></div>
        {celebration&&<div className="level-celebration" role="status"><SofiaCharacter pose="celebrate" className="celebration-character"/><strong>{celebration}</strong><button className="icon-button" aria-label="Fechar conquista" onClick={()=>setCelebration("")}><X size={17}/></button></div>}
        {page === "lia" && <LiaPanel key={liaPrompt?.id||"lia"} messages={state.assistantMessages||[]} configured={assistantConfigured} busy={asking} initialPrompt={liaPrompt} onSend={askAssistant}/> }
        {page === "home" && <>
          {heading(new Date(`${today}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }), <>Um passo mais perto, <span className="title-name">{firstName}.</span> <span className="heading-spark">✦</span></>, "Seu futuro está sendo construído. Vamos cuidar do próximo passo?", <button className="secondary-button" onClick={() => openStudy()}><Plus size={17} />Registrar estudo</button>)}
          <PlannerOverview state={state} onOpen={() => navigate("cycles")} />
          <div className="summary-grid">
            {[{ icon: Clock3, label: "Tempo de estudo", value: formatMinutes(stats.totalMinutes), foot: `${formatMinutes(todayMinutes)} de dedicação hoje`, color: "purple" }, { icon: Target, label: "Seu aproveitamento", value: `${stats.accuracy}%`, foot: `${stats.totalQuestions} questões resolvidas`, color: "green" }, { icon: BookOpen, label: "Progresso no edital", value: `${stats.totalTopics ? Math.round(stats.completedTopics / stats.totalTopics * 100) : 0}%`, foot: `${stats.completedTopics} de ${stats.totalTopics} tópicos concluídos`, color: "blue" }, { icon: Zap, label: "Experiência acumulada", value: `${stats.xp.toLocaleString("pt-BR")} XP`, foot: `Nível ${stats.level} · continue evoluindo`, color: "orange" }].map(s => <div className="stat-card" key={s.label}><div><span className="stat-label">{s.label}</span><strong className="stat-value">{s.value}</strong><span className="stat-foot">{s.foot}</span></div><span className={`stat-icon ${s.color}`}><s.icon size={21} /></span></div>)}
          </div>
          <div className="dashboard-grid">
            <section className="hero-card"><div className="hero-copy"><span className="hero-eyebrow"><Sparkles size={13} /> UM POUQUINHO TODO DIA</span><h2 className="hero-title">A sua aprovação<br />começa com o<br /><span>próximo passo.</span></h2><p className="hero-text">Não precisa ser perfeito. Só precisa começar.<br />Sua versão do futuro vai agradecer.</p><button className="hero-button" onClick={() => startFocus(todaysTasks.find(t => !t.done))}><Play size={14} fill="currentColor" />Vamos estudar <ArrowRight size={16} /></button></div><div className="hero-illustration"><Mascot pose="wave"/><span className="hero-note">você consegue ♡</span></div><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" /></section>
            <section className="daily-card"><div className="card-heading"><h2 className="section-title">Um dia de cada vez</h2><span className="flame-sticker"><Flame size={21} /></span></div><div className="streak-head"><strong className="streak-value">{stats.streak}<small>{stats.streak === 1 ? "dia de constância" : "dias de constância"}</small></strong><span className="streak-leaf">🌱</span></div><p className="section-subtitle">Cada dia que você aparece faz a diferença.</p><div className="week-streak">{Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); const done = state.sessions.some(s => s.date === d); return <div key={d}><span>{new Date(`${d}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 1).toUpperCase()}</span><span className={`day-dot ${done ? "done" : ""} ${d === today ? "today" : ""}`}>{done ? <Check size={15} /> : d === today ? <span /> : "·"}</span></div>; })}</div><div className="daily-goal"><div className="goal-label"><span>Meta de hoje</span><strong>{formatMinutes(todayMinutes)} <span>/ {formatMinutes(state.profile.dailyMinutes)}</span></strong></div>{progress(dailyPct)}<small>{dailyPct >= 100 ? "Meta alcançada. Pode se orgulhar! ✨" : "Um bloco de foco já é um ótimo começo."}</small></div></section>
            <section className="section-panel today-panel"><div className="card-heading"><div><span className="eyebrow">SEU PRÓXIMO PASSO</span><h2 className="section-title">Missões de hoje <span className="count-label">{doneTasks}/{todaysTasks.length}</span></h2></div><button className="section-link" onClick={() => navigate("planning")}>Ver planejamento <ArrowRight size={14} /></button></div><div className="plan-list">{todaysTasks.length ? todaysTasks.slice(0, 4).map(t => <TaskRow key={t.id} task={t} />) : empty("Sua próxima missão começa aqui", "Organize um bloco de estudo para hoje.", <button className="secondary-button" onClick={() => { setPlanningDate(today); openTask(); }}><Plus size={15} />Planejar estudo</button>)}</div><button className="add-plan-button" onClick={() => { setPlanningDate(today); openTask(); }}><Plus size={16} />Adicionar missão</button></section>
            <section className="section-panel weekly-panel"><div className="card-heading"><h2 className="section-title">Uma semana de evolução</h2><button className="icon-button small" aria-label="Editar metas" onClick={() => openModal("goal")}><Settings2 size={16} /></button></div><div className="weekly-total"><strong>{formatMinutes(stats.weekMinutes)}</strong><span>de {formatMinutes(state.profile.weeklyMinutes)} planejadas</span><span className="badge success">{weeklyPct}%</span></div>{progress(weeklyPct, "#8cac92")}<div className="weekly-chart">{Array.from({ length: 7 }, (_, i) => { const weekDay = new Date(`${today}T12:00:00-03:00`).getDay(); const d = addDays(today, i - ((weekDay + 6) % 7)); const m = state.sessions.filter(s => s.date === d).reduce((v, s) => v + s.minutes, 0); return <div className="chart-column" key={d} title={`${dateLabel(d)}: ${formatMinutes(m)}`}><div className="chart-bar-track"><div className={`chart-bar ${d === today ? "current" : ""}`} style={{ height: `${Math.max(4, Math.min(100, m / state.profile.dailyMinutes * 100))}%` }} /></div><span className={`chart-label ${d === today ? "current" : ""}`}>{["S", "T", "Q", "Q", "S", "S", "D"][i]}</span></div>; })}</div><p className="weekly-caption"><span className="subject-dot" /> Seu esforço, um dia de cada vez.</p></section>
            <section className="section-panel radar-panel"><div className="card-heading"><div><span className="eyebrow">DE OLHO NO SEU FUTURO</span><h2 className="section-title">Radar de concursos <span className="live-label"><span />Fontes oficiais</span></h2></div><button className="section-link" onClick={() => navigate("news")}>Ver todas <ArrowRight size={14} /></button></div><div className="news-list">{news?.items.slice(0, 3).map((n, i) => <a className="news-item" key={n.url} href={n.url} target="_blank" rel="noreferrer"><span className={`news-source-icon source-${i}`}><GraduationCap size={21} /></span><div><div className="news-meta"><span className="news-tag">{n.tribunal}</span><span className="news-date">{dateLabel(n.date)}</span></div><h3 className="news-title">{n.title}</h3></div><ExternalLink size={15} /></a>) || <p className="section-subtitle">{newsBusy ? "Consultando fontes oficiais…" : newsError || "As movimentações aparecerão aqui."}</p>}</div><p className="news-footer"><ShieldCheck size={13} />{news?.mode === "live" ? "Notícias consultadas nas fontes oficiais." : "Seleção verificada em 07/11/2026. Consulte os prazos na fonte."}</p></section>
            <section className="achievement-mini"><span className="eyebrow">TODO PROGRESSO MERECE SER CELEBRADO</span><SofiaCharacter pose={achievementDefs.some(a=>a.unlocked)?"celebrate":"guide"} className="home-achievement-character"/><h2>{achievementDefs.find(a => a.unlocked)?.title || "Seu primeiro passo"}</h2><p>{achievementDefs.find(a => a.unlocked) ? "Continue sua jornada: novos desafios e bônus de XP esperam por você." : "Sua primeira conquista espera por você."}</p><button className="section-link" onClick={() => navigate("achievements")}>Meu mural de conquistas <ArrowRight size={14} /></button></section>
          </div>
          <div className="home-footer"><span>Feito para quem acredita no próprio próximo capítulo.</span><span>Um estudo de cada vez. <span>♡</span></span></div>
        </>}

        {page === "cycles" && <CyclesPanel state={state} onChange={mutate} onStudy={openStudy} onFocus={startFocus} notify={notify} />}

        {page === "planning" && <>
          {heading("UM PLANO QUE CABE NA SUA VIDA", "Planeje. Comece. Continue.", "Transforme o conteúdo em pequenas missões de estudo.", <button className="primary-button" onClick={() => openTask()}><Plus size={17} />Nova missão</button>)}
          <div className="filter-bar"><div className="tabs"><button className={`tab ${planningDate === today ? "active" : ""}`} onClick={() => setPlanningDate(today)}>Hoje</button><button className={`tab ${planningDate === addDays(today, 1) ? "active" : ""}`} onClick={() => setPlanningDate(addDays(today, 1))}>Amanhã</button></div><input className="form-input date-input" type="date" aria-label="Dia do planejamento" value={planningDate} onChange={e => setPlanningDate(e.target.value)} /></div>
          <section className="section-panel"><div className="card-heading"><h2 className="section-title">{dateLabel(planningDate)} <span className="count-label">{state.tasks.filter(t => t.date === planningDate).length} missões</span></h2><span className="time-pill"><Clock3 size={15} />{formatMinutes(state.tasks.filter(t => t.date === planningDate).reduce((n, t) => n + t.minutes, 0))} planejados</span></div>{state.tasks.filter(t => t.date === planningDate).map(t => <TaskRow key={t.id} task={t} />)}{!state.tasks.some(t => t.date === planningDate) && empty("Um dia cheio de possibilidades", "Escolha um conteúdo e reserve um tempo para você.", <button className="secondary-button" onClick={() => openTask()}><Plus size={15} />Adicionar missão</button>)}</section>
          <div className="tip-card"><Coffee size={23} /><div><strong>Espaço para respirar também faz parte do plano.</strong><p>Experimente blocos de 25 minutos e uma pausa curta. Ajuste o ritmo à sua rotina.</p></div></div>
        </>}

        {page === "syllabus" && <>
          {heading("O MAPA DA SUA APROVAÇÃO", "Edital verticalizado TJSP", "Seu estudo, suas revisões e seus resultados em um só lugar.", <button className="primary-button" onClick={() => openModal("subject")}><Plus size={17} />Adicionar disciplina</button>)}
          <SyllabusPanel state={state} onChange={mutate}/>
        </>}
        {page === "questions" && <QuestionsPanel state={state} onChange={mutate} notify={notify}/>}

        {page === "reviews" && <ReviewsPanel state={state} onChange={mutate} notify={notify}/>}

        {page === "notes" && <>
          {heading("IDEIAS QUE FICAM", "Seu caderno, do seu jeito.", "Guarde resumos, conexões e aqueles detalhes que fazem a diferença.", <button className="primary-button" onClick={() => { setEditingNote(null); openModal("note"); }}><Plus size={17} />Nova anotação</button>)}
          <div className="filter-bar">{search("Buscar nas suas anotações…")}</div><div className="page-grid notes-grid">{state.notes.filter(n => `${n.title} ${n.content}`.toLowerCase().includes(query.toLowerCase())).map(n => <article className="note-card" key={n.id}><div className="note-toolbar"><span className="badge" style={{ color: subject(n.subjectId)?.color }}>{subject(n.subjectId)?.name}</span><button className="icon-button small" aria-label={`Conversar com a Lia sobre ${n.title}`} onClick={()=>openLia(`Lia, consulte minha anotação de ID ${n.id}, chamada ${n.title}, e me ajude a revisar o conteúdo com perguntas.`)}><Sparkles size={15}/></button><button className="icon-button small" aria-label={`Excluir anotação ${n.title}`} onClick={() => { if (window.confirm("Excluir esta anotação?")) mutate(s => ({ ...s, notes: s.notes.filter(item => item.id !== n.id) })); }}><Trash2 size={15} /></button></div><button className="note-edit-button" onClick={() => { setEditingNote(n); openModal("note"); }}><h2>{n.title}</h2><p className="note-content">{n.content}</p></button><span className="note-date">Atualizada em {recordDate(n.updatedAt)}</span></article>)}</div>{!state.notes.length && empty("Toda boa ideia merece um lugar", "Comece seu primeiro resumo ou registre algo que acabou de aprender.")}
        </>}

        {page === "errors" && <>
          {heading("ERROS TAMBÉM ENSINAM", "Aqui, errar vira aprendizado.", "Entenda o raciocínio, registre a resposta e volte com mais segurança.", <button className="primary-button" onClick={() => openModal("error")}><Plus size={17} />Registrar erro</button>)}
          <div className="filter-bar">{search("Buscar questão ou explicação…")}<div className="tabs"><button className={`tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>Para aprender</button><button className={`tab ${filter === "resolved" ? "active" : ""}`} onClick={() => setFilter("resolved")}>Aprendidos</button></div></div>
          <div className="error-list">{state.errors.filter(n => n.resolved === (filter === "resolved") && `${n.question} ${n.answer} ${n.reason}`.toLowerCase().includes(query.toLowerCase())).map(n => <article className="error-card" key={n.id}><div className="card-heading"><span className="badge" style={{ color: subject(n.subjectId)?.color }}>{subject(n.subjectId)?.name}</span><button className="icon-button small" aria-label="Pedir à Lia para explicar este erro" onClick={()=>openLia(`Lia, consulte o registro ${n.id} no caderno de erros. Me explique o raciocínio e faça uma pergunta para eu praticar, sem marcar como aprendido ainda.`)}><Sparkles size={15}/></button><button className="icon-button small" aria-label="Excluir registro de erro" onClick={() => { if (window.confirm("Excluir este registro do caderno?")) mutate(s => ({ ...s, errors: s.errors.filter(item => item.id !== n.id) })); }}><Trash2 size={15} /></button></div><h2>{n.question}</h2><div className="answer-box"><span>RESPOSTA / RACIOCÍNIO CORRETO</span><p>{n.answer}</p></div><p className="error-reason"><strong>O que preciso lembrar:</strong> {n.reason}</p><div className="error-footer"><span>{recordDate(n.createdAt)}</span><button className="secondary-button small-button" onClick={() => { mutate(s => ({ ...s, errors: s.errors.map(e => e.id === n.id ? { ...e, resolved: !e.resolved } : e) })); notify(n.resolved ? "Conteúdo voltou para a lista de aprendizado." : "Mais um aprendizado conquistado! ✨"); }}>{n.resolved ? <RefreshCw size={14} /> : <Check size={14} />}{n.resolved ? "Quero revisar de novo" : "Aprendi esse conteúdo"}</button></div></article>)}</div>
          {!state.errors.some(n => n.resolved === (filter === "resolved")) && empty("Um erro de hoje, um acerto de amanhã", "Registre as questões que merecem uma segunda olhada.")}
        </>}

        {page === "news" && <>
          {heading("DE OLHO NA SUA OPORTUNIDADE", "Seu radar de concursos.", "Editais e movimentações da área judiciária, com acesso direto às fontes oficiais.", <button className="secondary-button" disabled={newsBusy} onClick={() => void loadNews()}><RefreshCw size={16} className={newsBusy ? "spin" : ""} />{newsBusy ? "Consultando…" : "Atualizar fontes"}</button>)}
          <div className="inline-info"><ShieldCheck size={20} /><p>{news?.mode === "live" ? "Consulta automática a notícias oficiais. Confira o edital e suas retificações antes de se inscrever." : "Seleção de fontes verificada em 07/11/2026. Quando houver notícias recentes no feed oficial, o radar as exibirá automaticamente. Confira prazos diretamente na fonte."}</p></div>
          {newsError && <div className="inline-alert">{newsError}</div>}<div className="filter-bar">{search("Buscar tribunal ou notícia…")}{news && <small className="section-subtitle">Última consulta: {new Date(news.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>}</div>
          <div className="news-grid">{news?.items.filter(n => `${n.tribunal} ${n.title} ${n.category}`.toLowerCase().includes(query.toLowerCase())).map(n => <article className="news-full" key={n.url}><div className="news-cover"><GraduationCap size={36} /><strong>{n.tribunal}</strong><span>RADAR JUDICIÁRIO</span></div><div className="news-full-body"><div className="news-meta"><span className="badge">{n.category}</span><time className="news-date" dateTime={n.date}>{dateLabel(n.date)}</time></div><h2>{n.title}</h2><p>{n.summary}</p><a className="section-link" href={n.url} target="_blank" rel="noreferrer">Ler na fonte oficial <ExternalLink size={14} /></a></div></article>)}</div>
        </>}

        {page === "achievements" && <AchievementsPanel stats={stats}/>}

        {page === "stats" && <>
          {heading("SEU ESFORÇO TEM HISTÓRIA", "Progresso que dá para ver.", "Acompanhe o tempo dedicado e os conteúdos que estão ficando mais claros.", <button className="secondary-button" onClick={downloadData}><ArrowDownToLine size={16} />Exportar meus dados</button>)}
          <div className="summary-grid">{[["Tempo total", formatMinutes(stats.totalMinutes)], ["Questões resolvidas", stats.totalQuestions], ["Aproveitamento", `${stats.accuracy}%`], ["Constância atual", `${stats.streak} dias`]].map(([label, value]) => <div className="stat-card" key={label}><div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></div></div>)}</div>
          <section className="section-panel"><div className="card-heading"><h2 className="section-title">Dedicação por disciplina</h2><span className="chip">Todo o período</span></div><div className="subject-stats">{state.subjects.map(s => { const sessions = state.sessions.filter(item => item.subjectId === s.id); const minutes = sessions.reduce((n, item) => n + item.minutes, 0); return <div key={s.id}><div className="goal-label"><strong>{s.name}</strong><span>{formatMinutes(minutes)}</span></div>{progress(stats.totalMinutes ? minutes / stats.totalMinutes * 100 : 0, s.color)}</div>; })}</div></section>
          <section className="section-panel session-history"><div className="card-heading"><h2 className="section-title">Seu histórico de estudos</h2><span className="count-label">{state.sessions.length} registros</span></div>{state.sessions.slice().sort((a, b) => b.date.localeCompare(a.date)).map(s => <div className="study-row" key={s.id}>{subjectIcon(subject(s.subjectId))}<div className="study-info"><span className="study-meta">{subject(s.subjectId)?.name} · {dateLabel(s.date)}</span><h3 className="study-title">{s.topic}</h3></div><span className="time-pill">{formatMinutes(s.minutes)}</span><span className="badge">{s.correct}/{s.questions} acertos</span></div>)}{!state.sessions.length && empty("Sua história começa no primeiro estudo", "Registre uma sessão para acompanhar sua evolução por aqui.")}</section>
        </>}

        {page === "settings" && <>
          {heading("ESSE ESPAÇO É SEU", "No seu ritmo, do seu jeito.", "Ajuste sua jornada e cuide dos seus dados.")}
          <section className="settings-panel section-panel"><div className="card-heading"><h2 className="section-title">Sua jornada</h2><button className="secondary-button small-button" onClick={() => openModal("goal")}>Editar metas</button></div><div className="settings-summary"><span>Objetivo<strong>{state.profile.goal}</strong></span><span>Meta diária<strong>{formatMinutes(state.profile.dailyMinutes)}</strong></span><span>Meta semanal<strong>{formatMinutes(state.profile.weeklyMinutes)}</strong></span><span>Data da prova<strong>{state.profile.examDate ? dateLabel(state.profile.examDate) : "Ainda não definida"}</strong></span></div></section>
          <section className="settings-panel section-panel"><div className="card-heading"><h2 className="section-title">Conta e dados</h2><ShieldCheck size={21} /></div><p>{initialUser ? `Conectado como ${initialUser.email}. Seus registros ficam vinculados à sua conta.` : "Você está explorando uma demonstração. Os testes ficam salvos neste navegador. Entre para começar sua jornada com dados vinculados à sua conta."}</p><div className="settings-actions"><button className="secondary-button" onClick={downloadData}><ArrowDownToLine size={16} />Exportar dados</button>{initialUser ? <button className="ghost-button" onClick={async () => { const r = await fetch("/api/logout", {method:"POST"}); if(r.ok) location.assign("/login"); else notify("Não foi possível sair agora. Tente novamente."); }}>Sair da conta</button> : <a className="primary-button" target="_top" href="/login">Entrar na minha conta <ArrowRight size={16} /></a>}</div>{initialUser && <small className="sync-status">{sync === "saving" ? "Salvando alterações…" : sync === "saved" ? "Alterações salvas na sua conta." : "Há alterações aguardando sincronização."}</small>}</section>
          <section className="settings-panel section-panel"><div className="card-heading"><h2 className="section-title">Lia · sua parceira de aprovação</h2><Sparkles size={20} /></div><p>{assistantConfigured ? "A Lia pode explicar conteúdos, pesquisar na internet e criar ou atualizar os registros que você pedir no app." : "A conexão da Lia com o Gemini ainda precisa ser configurada pelo responsável pelo app."}</p><button className="secondary-button" onClick={() => openLia()}><MessageCircle size={16} />Conversar com a Lia</button></section>
          <section className="settings-panel section-panel"><h2 className="section-title">Lembretes</h2><p>Veja as revisões pendentes na central de lembretes. Com permissão, o cronômetro também avisa quando seu foco termina.</p><button className="secondary-button" onClick={() => openModal("notifications")}><Bell size={16} />Preferências de lembretes</button><p className="field-hint">As notificações de foco funcionam enquanto o app está aberto. Lembretes em segundo plano serão uma próxima evolução.</p></section>
        </>}
        </>}
      </main>
      <button className="assistant-launcher" aria-label="Conversar com a Lia" onClick={() => openLia()}><Sparkles size={20} /><span>Converse com a Lia</span></button>
    </div>
    {toast && <div className="toast" role="status"><span className="toast-icon"><Check size={16} /></span>{toast}<button className="icon-button small" aria-label="Fechar aviso" onClick={() => setToast("")}><X size={15} /></button></div>}

    {modal && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="eyebrow">SUA JORNADA, UM PASSO DE CADA VEZ</span><h2 id="modal-title">{{ study: "Mais um estudo para a conta.", task: "Qual é a sua próxima missão?", subject: "Seu edital, bem organizado.", note: editingNote ? "Dê mais um toque à sua anotação." : "Guarde uma boa ideia.", error: "Transforme esse erro em aprendizado.", goal: "Para onde você quer ir?", notifications: "Um lembrete com carinho." }[modal]}</h2></div><button className="icon-button" aria-label="Fechar janela" onClick={() => setModal(null)}><X size={20} /></button></div>
      {formError && modal !== "study" && modal !== "subject" && <p className="error-text modal-validation" role="alert">{formError}</p>}
      {modal === "study" && <form onSubmit={submitStudy}><div className="modal-body"><label className="form-field">Disciplina{subjectSelect(selectedSubject)}</label><label className="form-field">O que você estudou?<input className="form-input" name="topic" defaultValue={selectedTopic} placeholder="Ex.: Direitos e garantias fundamentais" required maxLength={200} /></label><div className="form-grid"><label className="form-field">Tempo de estudo (min)<input className="form-input" type="number" name="minutes" defaultValue={focusRegistration?.minutes || 30} readOnly={!!focusRegistration} min={1} max={720} required /></label><label className="form-field">Questões resolvidas<input className="form-input" type="number" name="questions" defaultValue={0} min={0} max={1000} required /></label><label className="form-field">Acertos<input className="form-input" type="number" name="correct" defaultValue={0} min={0} max={1000} required /></label></div><div className="inline-info"><RefreshCw size={17} /><p>A revisão seguirá a próxima semana cumulativa, agrupada ou final que inclui este conteúdo no seu ciclo.</p></div>{formError && <p className="error-text" role="alert">{formError}</p>}</div><div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setModal(null)}>Voltar</button><button className="primary-button" type="submit">Registrar e evoluir <Sparkles size={16} /></button></div></form>}
      {modal === "task" && <form onSubmit={submitTask}><div className="modal-body"><label className="form-field">Disciplina{subjectSelect(editingTask?.subjectId)}</label><label className="form-field">Sua missão<input className="form-input" name="title" defaultValue={editingTask?.title} placeholder="Ex.: Revisar atos administrativos" maxLength={200} required /></label><div className="form-grid two-columns"><label className="form-field">Quando?<input className="form-input" type="date" name="date" defaultValue={planningDate} required /></label><label className="form-field">Tempo reservado (min)<input className="form-input" type="number" name="minutes" min={5} max={480} step={5} defaultValue={editingTask?.minutes||30} required /></label></div></div><div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setModal(null)}>Voltar</button><button className="primary-button" type="submit">Salvar missão <Check size={16} /></button></div></form>}
      {modal === "subject" && <form onSubmit={submitSubject}><div className="modal-body"><label className="form-field">Nome da disciplina<input className="form-input" name="name" placeholder="Ex.: Direito Eleitoral" required maxLength={120} /></label><label className="form-field">Tópicos do edital<textarea className="form-textarea" name="topics" rows={7} maxLength={15000} required placeholder={"Cole o conteúdo programático, com um tópico por linha.\nEx.:\nDireitos políticos\nAlistamento eleitoral\nPartidos políticos"} /></label><label className="form-field">Link do edital oficial (opcional)<input className="form-input" type="url" name="source" placeholder="https://www.tribunal.jus.br/…" maxLength={1500} /></label><p className="field-hint">Cada linha vira um tópico que você pode marcar ao concluir. Você também pode colar o texto de um PDF.</p>{formError && <p className="error-text" role="alert">{formError}</p>}</div><div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setModal(null)}>Voltar</button><button className="primary-button" type="submit">Adicionar ao meu edital <Check size={16} /></button></div></form>}
      {modal === "note" && <form onSubmit={submitNote}><div className="modal-body"><label className="form-field">Disciplina{subjectSelect(editingNote?.subjectId)}</label><label className="form-field">Título<input className="form-input" name="title" defaultValue={editingNote?.title} placeholder="Uma ideia para lembrar" required maxLength={200} /></label><label className="form-field">Sua anotação<textarea className="form-textarea" name="content" defaultValue={editingNote?.content} rows={8} placeholder="Escreva com suas palavras. O aprendizado é seu." required maxLength={15000} /></label></div><div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setModal(null)}>Voltar</button><button className="primary-button" type="submit">Guardar anotação <Bookmark size={16} /></button></div></form>}
      {modal === "error" && <form onSubmit={submitError}><div className="modal-body"><label className="form-field">Disciplina{subjectSelect()}</label><label className="form-field">Qual foi a questão ou a dúvida?<textarea className="form-textarea" name="question" rows={3} required maxLength={3000} placeholder="Cole o enunciado ou descreva o conteúdo." /></label><label className="form-field">Resposta ou raciocínio correto<textarea className="form-textarea" name="answer" rows={3} required maxLength={6000} placeholder="Registre a explicação e a fonte que você conferiu." /></label><label className="form-field">O que fez você errar?<input className="form-input" name="reason" required maxLength={1000} placeholder="Ex.: Confundi os requisitos. Preciso lembrar de…" /></label><p className="field-hint">A revisão entrará na próxima etapa do calendário que inclui esta disciplina.</p></div><div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setModal(null)}>Voltar</button><button className="primary-button" type="submit">Guardar aprendizado <Check size={16} /></button></div></form>}
      {modal === "goal" && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); if (!String(f.get("name")).trim() || !String(f.get("goal")).trim()) { setFormError("Informe seu nome e objetivo."); return; } mutate(s => ({ ...s, profile: { name: String(f.get("name")).trim(), goal: String(f.get("goal")).trim(), dailyMinutes: Number(f.get("dailyMinutes")), weeklyMinutes: Number(f.get("weeklyMinutes")), examDate: String(f.get("examDate")) } })); setModal(null); notify("Sua jornada foi atualizada."); }}><div className="modal-body"><label className="form-field">Como você quer ser chamado(a)?<input className="form-input" name="name" defaultValue={state.profile.name} required maxLength={80} /></label><label className="form-field">Seu objetivo<input className="form-input" name="goal" defaultValue={state.profile.goal} required maxLength={120} placeholder="Ex.: Técnico Judiciário · TRT6" /></label><div className="form-grid two-columns"><label className="form-field">Meta diária (min)<input className="form-input" type="number" name="dailyMinutes" defaultValue={state.profile.dailyMinutes} min={10} max={720} required /></label><label className="form-field">Meta semanal (min)<input className="form-input" type="number" name="weeklyMinutes" defaultValue={state.profile.weeklyMinutes} min={10} max={5040} required /></label></div><label className="form-field">Data da prova (opcional)<input className="form-input" type="date" name="examDate" readOnly={!!state.planner} defaultValue={state.profile.examDate} /></label><p className="field-hint">{state.planner?"A data da prova é ajustada em Meu ciclo → Ajustar calendário. ":""}Escolha metas possíveis para a sua rotina. Você pode ajustá-las quando precisar.</p></div><div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setModal(null)}>Voltar</button><button className="primary-button" type="submit">Salvar minha jornada <Check size={16} /></button></div></form>}
      {modal === "notifications" && <div className="modal-body"><div className="reminder-summary"><span className="stat-icon purple"><Bell size={24} /></span><div><h3>{due.length ? `${due.length} ${due.length === 1 ? "conteúdo espera" : "conteúdos esperam"} uma nova olhada.` : "Tudo em dia. Respira!"}</h3><p>{due.length ? "Reserve alguns minutos para fortalecer o que você aprendeu." : "Seus próximos conteúdos aparecerão aqui na data certa."}</p></div></div>{due.slice(0, 4).map(r => <div className="reminder-item" key={r.id}><RefreshCw size={16} /><span>{r.title}</span><small>{dateLabel(r.dueDate)}</small></div>)}<button className="primary-button" onClick={() => { setModal(null); navigate("reviews"); }}>Ver minhas revisões <ArrowRight size={16} /></button><hr /><h3>Um aviso quando o foco terminar</h3><p className="section-subtitle">Permita notificações para receber o aviso do cronômetro enquanto o app estiver aberto.</p><button className="secondary-button" disabled={notificationState === "granted"} onClick={async () => { if (!("Notification" in window)) { notify("Este navegador não oferece notificações. O aviso continuará aparecendo no app."); return; } const result = await Notification.requestPermission(); setNotificationState(result); notify(result === "granted" ? "Tudo pronto. Seu cronômetro pode enviar avisos." : "Você continua recebendo os avisos dentro do app."); }}><Bell size={15} />{notificationState === "granted" ? "Notificações permitidas" : "Permitir avisos de foco"}</button>{notificationState === "denied" && <p className="field-hint">As notificações estão bloqueadas. Você pode alterar a permissão nas configurações do navegador.</p>}</div>}
    </section></div>}
  </div>;
}
