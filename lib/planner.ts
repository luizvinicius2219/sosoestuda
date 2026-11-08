import { addDays, todayKey, type StudyState, type StudyTask } from "./study.ts";
import { plannerSchema, type StudyPlanner, type PlannerBlock } from "./planner-schema.ts";

export const variantLabels = { standard: "Padrão", flex: "Flex", speed: "Speed", hard: "Intensivo", emergency: "Emergência", "super-emergency": "Super emergência" };
export type PlannerWeek = { id:string; start:string; end:string; kind:"orientation"|"cycle"|"cumulative"|"final"|"extra"; cycleIds:string[]; title:string; originalStart:string; notes:string };
export function monday(date: string) { const d = new Date(`${date}T12:00:00Z`).getUTCDay(); return addDays(date, -((d+6)%7)); }
export function nextMonday(date:string) { return addDays(monday(date),7); }
export function buildWeeks(plan:StudyPlanner):PlannerWeek[] {
  const rows: Omit<PlannerWeek,"id"|"start"|"end"|"originalStart"|"notes">[]=[];
  const cycles = plan.cycles.slice().sort((a,b)=>a.number-b.number);
  const group=(ids:string[])=>{const nums=ids.map(id=>cycles.find(c=>c.id===id)!.number);rows.push({kind:"cycle",cycleIds:ids,title:`${ids.length===1?"Ciclo":"Ciclos"} ${nums.join(" + ")}`});};
  const review=()=>rows.push({kind:"cumulative",cycleIds:[],title:"Revisão cumulativa"});
  if(plan.variant==="super-emergency") for(let i=0;i<cycles.length;i+=2) group(cycles.slice(i,i+2).map(c=>c.id));
  else {cycles.forEach((c,i)=>{group([c.id]);if(i===4 && !["emergency"].includes(plan.variant))review();});
    if(["standard","flex","hard"].includes(plan.variant))review();
    if(plan.variant==="standard")for(let i=0;i<cycles.length;i+=2)group(cycles.slice(i,i+2).map(c=>c.id));
    if(plan.variant==="hard")for(let pass=0;pass<2;pass++)for(const [a,b] of [[0,3],[3,6],[6,cycles.length]]){const ids=cycles.slice(a,b).map(c=>c.id);if(ids.length)group(ids);}
  }
  const finalWeeks=plan.variant==="super-emergency"?1:2;
  const finalStart=addDays(monday(addDays(plan.examDate,-1)),-7*(finalWeeks-1));
  if(plan.variant==="flex")while(addDays(monday(plan.cycleStart),rows.length*7)<finalStart && rows.length<100)rows.push({kind:"extra",cycleIds:[],title:"Reforço dos pontos de atenção"});
  const weeks=rows.map((r,i)=>{
    const originalStart=addDays(monday(plan.cycleStart),i*7); const id=`${plan.variant}-w${i+1}`;
    const override=plan.overrides.find(o=>o.weekId===id);const start=override?monday(override.start):originalStart;
    return {...r,id,start,end:addDays(start,6),originalStart,notes:override?.notes||""};
  });
  if(!["emergency","super-emergency"].includes(plan.variant)){const end=addDays(monday(plan.cycleStart),-1),start=addDays(monday(plan.cycleStart),plan.variant==="standard"?-14:-7);weeks.unshift({id:`${plan.variant}-orientation`,start,end,originalStart:start,kind:"orientation",cycleIds:[],title:"Ambientação e organização",notes:""});}
  for(let i=0;i<finalWeeks;i++){const originalStart=addDays(finalStart,i*7),id=`${plan.variant}-final${i+1}`,override=plan.overrides.find(o=>o.weekId===id);const start=override?monday(override.start):originalStart;weeks.push({id,start,end:addDays(start,6)<plan.examDate?addDays(start,6):addDays(plan.examDate,-1),originalStart,kind:"final",cycleIds:[],title:"Revisão final",notes:override?.notes||""});}
  return weeks.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
export function calendarWarnings(plan:StudyPlanner):string[] {
  const weeks=buildWeeks(plan),warnings:string[]=[];
  if(plan.cycleStart!==monday(plan.cycleStart))warnings.push("O calendário foi alinhado à segunda-feira da semana escolhida.");
  if(weeks.some(w=>w.kind!=="final" && w.end>=plan.examDate))warnings.push("Há ciclos planejados para depois da prova. Antecipe o início ou escolha outro ritmo.");
  if(weeks.some((w,i)=>i>0 && w.start<=weeks[i-1].end))warnings.push("Há semanas sobrepostas. Confira as datas antes de gerar as missões.");
  if(!plan.examDateConfirmed)warnings.push("A data da prova veio do material de apoio e ainda precisa ser conferida no edital oficial.");
  return warnings;
}
export function weekBlocks(plan:StudyPlanner,week:PlannerWeek) { return plan.cycles.filter(c=>week.cycleIds.includes(c.id)).flatMap(c=>c.blocks.filter(b=>plan.mode!=="essential"||b.family!=="math").map(block=>({cycle:c,block}))); }
export function stages(block:PlannerBlock) {
  const first=block.family==="math"||block.family==="reasoning"?[]:[{id:"reverse",label:"Questões de diagnóstico",hint:"Use de 5 a 10 questões para localizar suas dúvidas."}];
  return [...first,{id:"theory",label:block.family==="law"?"Leitura da legislação":"Teoria e exemplos",hint:block.family==="law"?"Confira os dispositivos no seu material atualizado.":"Revise o conteúdo necessário para resolver suas dúvidas."},{id:"practice",label:"Questões de fixação",hint:"Meta de referência: 20 questões, quando houver questões disponíveis."},{id:"errors",label:"Conferir e registrar erros",hint:"Leve as dúvidas para o caderno de erros."},{id:"review",label:"Revisão do conteúdo",hint:"Recupere os pontos principais sem consultar e depois confira."}];
}
export const stepKey=(weekId:string,blockId:string,stage:string)=>`${weekId}/${blockId}/${stage}`;
export function blockMinutes(state:StudyState,weekId:string,blockId:string){return state.sessions.filter(s=>s.plannerRef?.weekId===weekId&&s.plannerRef.blockId===blockId).reduce((n,s)=>n+s.minutes,0);}
export function recurringWeekendEvents(week:PlannerWeek,events:StudyPlanner["events"]=[]) {
  const mock=events.find(e=>e.kind==="mock"&&e.date===addDays(week.start,6));
  return [{id:`${week.id}-current`,title:"Atualidades e repertório",date:addDays(week.start,5),kind:"personal" as const,completed:false,notes:""}, mock||{id:`${week.id}-essay`,title:"Prática de redação",date:addDays(week.start,6),kind:"essay" as const,completed:false,notes:""},{id:`${week.id}-review`,title:"Revisão semanal e caderno de erros",date:addDays(week.start,6),kind:"review" as const,completed:false,notes:""}];
}
/** Cycles are private user data. Import merges subjects without reindexing existing topics or deleting history. */
export function importPlanner(state:StudyState,input:unknown):StudyState {
  let planner=plannerSchema.parse(input);
  const old=state.planner;
  if(old && old.source===planner.source){planner={...planner,variant:old.variant,mode:old.mode,cycleStart:old.cycleStart,examDateConfirmed:old.examDate===planner.examDate&&old.examDateConfirmed,completedSteps:old.completedSteps,completedWeeks:old.completedWeeks,overrides:old.overrides,events:[...planner.events.map(e=>{const prior=old.events.find(o=>o.id===e.id);return prior?{...e,completed:prior.completed,notes:prior.notes,result:prior.result,plannedMinutes:prior.plannedMinutes}:e;}),...old.events.filter(e=>!planner.events.some(n=>n.id===e.id))]};}
  const subjects=state.subjects.map(s=>({...s,topics:[...s.topics]}));
  for(const c of planner.cycles)for(const b of c.blocks){let s=subjects.find(s=>s.id===b.subjectId);if(!s){s={id:b.subjectId,name:b.subjectName,short:b.subjectName.split(" ").map(x=>x[0]).join("").slice(0,3),color:"#8b73ca",topics:[]};subjects.push(s);}for(const t of b.topics)if(!s.topics.includes(t))s.topics.push(t);}
  for(const [id,name] of [["redacao","Redação"],["atualidades","Atualidades"],["simulados","Simulados"],["revisao-geral","Revisão geral"]])if(!subjects.some(s=>s.id===id))subjects.push({id,name,short:name.slice(0,2),color:"#b69362",topics:["Prática e revisão"]});
  return {...state,subjects,planner,profile:{...state.profile,goal:planner.title.slice(0,120),examDate:planner.examDate}};
}
/** Deterministic IDs make repeated generation safe; completed records are never recreated or removed. */
export function generateWeekTasks(state:StudyState,week:PlannerWeek):{state:StudyState;added:number;warnings:string[]} {
  const plan=state.planner;if(!plan)return {state,added:0,warnings:["Importe seu plano primeiro."]};
  if(week.start>=plan.examDate)return {state,added:0,warnings:["Esta semana começa depois da prova."]};
  const tasks:StudyTask[]=[];const warnings:string[]=[];const loads=Array.from({length:5},(_,i)=>state.tasks.filter(t=>t.date===addDays(week.start,i)).reduce((n,t)=>n+t.minutes,0));
  for(const {cycle,block} of weekBlocks(plan,week)){
    const spent=blockMinutes(state,week.id,block.id); const planned=state.tasks.filter(t=>t.plannerRef?.weekId===week.id&&t.plannerRef.blockId===block.id).reduce((n,t)=>n+t.minutes,0);
    let remaining=Math.ceil(Math.max(0,block.minutes-Math.max(spent,planned))/5)*5;
    let offset=planned;while(remaining>0){const minutes=Math.min(60,remaining);const day=loads.indexOf(Math.min(...loads));loads[day]+=minutes;let id=`plan:${week.id}:${block.id}:${offset}`;while(state.tasks.some(t=>t.id===id)||tasks.some(t=>t.id===id)){offset++;id=`plan:${week.id}:${block.id}:${offset}`;}tasks.push({id,subjectId:block.subjectId,title:`${week.title} · ${block.title}`.slice(0,200),minutes,date:addDays(week.start,day),done:false,plannerRef:{weekId:week.id,cycleId:cycle.id,blockId:block.id}});remaining-=minutes;offset+=minutes;}
  }
  if(week.kind==="orientation")tasks.push({id:`plan:${week.id}:organize`,subjectId:state.subjects[0].id,title:"Organizar materiais, horários e prioridades",minutes:60,date:week.start,done:false});
  if(!["cycle","orientation"].includes(week.kind))for(let i=0;i<5;i++)tasks.push({id:`plan:${week.id}:review:${i}`,subjectId:"revisao-geral",title:`${week.title} · erros e pontos de atenção`,minutes:60,date:addDays(week.start,i),done:false});
  const sunday=addDays(week.start,6),mock=plan.events.find(e=>e.kind==="mock"&&e.date===sunday);
  tasks.push({id:`plan:${week.id}:current`,subjectId:"atualidades",title:"Atualidades e repertório",minutes:60,date:addDays(week.start,5),done:false},{id:`plan:${week.id}:week-review`,subjectId:"revisao-geral",title:"Revisão semanal e caderno de erros",minutes:60,date:sunday,done:false});
  if(!mock)tasks.push({id:`plan:${week.id}:essay`,subjectId:"redacao",title:"Prática de redação e repertório",minutes:240,date:sunday,done:false});
  else if(mock.plannedMinutes)tasks.push({id:`plan:event:${mock.id}`,subjectId:"simulados",title:mock.title,minutes:mock.plannedMinutes,date:sunday,done:false});
  else warnings.push("Há simulado no domingo: a redação foi substituída. Informe a duração do simulado na agenda para gerar sua missão.");
  const pending=tasks.filter(t=>t.date<plan.examDate&&!state.tasks.some(old=>old.id===t.id));
  const all=[...state.tasks,...pending];
  for(let i=0;i<7;i++){const date=addDays(week.start,i);if(all.filter(t=>t.date===date).reduce((n,t)=>n+t.minutes,0)>state.profile.dailyMinutes){warnings.push("A carga sugerida excede sua meta diária em alguns dias. Ajuste as missões à sua disponibilidade.");break;}}
  if(week.start<todayKey())warnings.push("As missões foram criadas nas datas originais. Os dias passados continuam visíveis no planejamento.");
  return {state:{...state,tasks:all},added:pending.length,warnings};
}
