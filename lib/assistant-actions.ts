import { z } from "zod";
import { civilDate, plannerEventSchema } from "./planner-schema.ts";
import { addDays, calculateStats, completeStudy, reconcileStudyState, studyStateSchema, todayKey, topicKey, type StudyState } from "./study.ts";
import { buildWeeks, calendarWarnings, generateWeekTasks, monday, standardCalendarStart } from "./planner.ts";
import { completeReview } from "./reviews.ts";
import type { AssistantActionReceipt } from "./assistant-schema.ts";

const id=z.string().min(1).max(100), title=z.string().trim().min(1).max(200), optionalId=id.optional();
export const assistantActionSchema=z.discriminatedUnion("type",[
  z.object({type:z.literal("study"),id:optionalId,subjectId:id,topic:title,minutes:z.number().int().min(1).max(720),questions:z.number().int().min(0).max(1000),correct:z.number().int().min(0).max(1000),taskId:optionalId,date:civilDate.optional()}).strict(),
  z.object({type:z.literal("task"),id:optionalId,subjectId:id,title,minutes:z.number().int().min(5).max(480).multipleOf(5),date:civilDate}).strict(),
  z.object({type:z.literal("note"),id:optionalId,subjectId:id,title,content:z.string().trim().min(1).max(15000)}).strict(),
  z.object({type:z.literal("error"),id:optionalId,subjectId:id,question:z.string().trim().min(1).max(3000),answer:z.string().trim().min(1).max(6000),reason:z.string().trim().min(1).max(1000),resolved:z.boolean().default(false)}).strict(),
  z.object({type:z.literal("topic"),subjectId:id,index:z.number().int().min(0).max(999),completed:z.boolean()}).strict(),
  z.object({type:z.literal("profile"),goal:z.string().trim().min(1).max(120).optional(),dailyMinutes:z.number().int().min(10).max(720).optional(),weeklyMinutes:z.number().int().min(10).max(5040).optional()}).strict(),
  z.object({type:z.literal("subject"),id:optionalId,name:z.string().trim().min(1).max(120),topics:z.array(z.string().trim().min(1).max(500)).min(1).max(300),source:z.string().url().max(1500).refine(v=>/^https?:\/\//i.test(v)).optional()}).strict(),
  z.object({type:z.literal("review"),id,rating:z.enum(["again","good","easy"])}).strict(),
  z.object({type:z.literal("event"),id:optionalId,title,date:civilDate,time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),kind:z.enum(["mentoring","mock","essay","review","personal"]),plannedMinutes:z.number().int().min(5).max(480).multipleOf(5).optional(),completed:z.boolean().default(false),notes:z.string().max(3000).default(""),result:plannerEventSchema.shape.result}).strict(),
  z.object({type:z.literal("calendar"),variant:z.enum(["standard","flex","speed","hard","emergency","super-emergency"]).optional(),mode:z.enum(["standard","essential"]).optional(),cycleStart:civilDate.optional(),examDate:civilDate.optional()}).strict(),
  z.object({type:z.literal("move_week"),weekId:id,start:civilDate,notes:z.string().max(1000).default("")}).strict(),
  z.object({type:z.literal("generate_week"),weekId:id}).strict(),
]);
export type AssistantAction=z.infer<typeof assistantActionSchema>;

export function applyAssistantAction(state:StudyState,raw:unknown):{state:StudyState;receipt:AssistantActionReceipt;warnings?:string[]} {
  const action=assistantActionSchema.parse(raw),next=structuredClone(state),now=new Date().toISOString();
  let recordId="",recordTitle="",warnings:string[]|undefined;
  const subject=(subjectId:string)=>{const s=next.subjects.find(s=>s.id===subjectId);if(!s)throw new Error("Disciplina não encontrada. Consulte os identificadores atuais.");return s;};
  const requireRecord=<T extends {id:string}>(items:T[],key:string)=>{const item=items.find(x=>x.id===key);if(!item)throw new Error("Registro não encontrado. Consulte o app antes de atualizar.");return item;};
  const save=<T extends {id:string}>(items:T[],item:T,existingId?:string)=>{if(existingId){requireRecord(items,existingId);return items.map(x=>x.id===existingId?item:x);}return [...items,item];};
  switch(action.type){
    case "study": {
      subject(action.subjectId);if(action.correct>action.questions)throw new Error("Acertos não podem superar questões.");
      if(action.date&&action.date>todayKey())throw new Error("Um estudo realizado não pode ter data futura. Crie uma missão para o planejamento.");
      const task=action.taskId?requireRecord(next.tasks,action.taskId):undefined;
      if(task&&task.subjectId!==action.subjectId)throw new Error("A missão pertence a outra disciplina.");
      if(action.id){
        const old=requireRecord(next.sessions,action.id);recordId=old.id;
        if(next.tasks.some(t=>t.id===action.taskId))throw new Error("Para corrigir uma sessão existente, não vincule novamente uma missão.");
        next.sessions=next.sessions.map(s=>s.id===old.id?{...s,subjectId:action.subjectId,topic:action.topic,minutes:action.minutes,questions:action.questions,correct:action.correct,date:action.date||old.date,...(old.subjectId!==action.subjectId?{plannerRef:undefined}:{}),pomodoros:Math.min(old.pomodoros||0,action.minutes)}:s);
        const related=next.tasks.filter(t=>t.subjectId===old.subjectId&&t.title===old.topic&&(!old.plannerRef||t.plannerRef?.weekId===old.plannerRef.weekId));
        if(related.length===1){const t=related[0];t.recordedMinutes=Math.max(0,(t.recordedMinutes||(t.done?t.minutes:0))-old.minutes+(old.subjectId===action.subjectId?action.minutes:0));t.done=t.recordedMinutes>=t.minutes;}
        if(old.topic!==action.topic||old.subjectId!==action.subjectId){
          const others=next.sessions.some(s=>s.id!==old.id&&s.subjectId===old.subjectId&&s.topic===old.topic);
          const current=next.reviews.find(r=>r.subjectId===action.subjectId&&r.title===action.topic);
          const previous=next.reviews.find(r=>r.subjectId===old.subjectId&&r.title===old.topic);
          if(!current&&previous&&!others){previous.subjectId=action.subjectId;previous.title=action.topic;if(previous.calendar)previous.calendar={...previous.calendar,cycleIds:[]};}
          else if(!current)next.reviews.push({id:crypto.randomUUID(),subjectId:action.subjectId,title:action.topic,dueDate:todayKey(),interval:1});
        }
      }else{
        const recorded=completeStudy(next,{subjectId:action.subjectId,topic:action.topic,minutes:action.minutes,questions:action.questions,correct:action.correct,...(task?.plannerRef?{plannerRef:task.plannerRef}:{})});
        Object.assign(next,recorded);recordId=next.sessions.at(-1)!.id;
        if(action.date){next.sessions.at(-1)!.date=action.date;const r=next.reviews.find(r=>r.subjectId===action.subjectId&&r.title===action.topic);if(r?.calendar&&r.calendar.sourceDate>action.date)r.calendar.sourceDate=action.date;else if(r&&!r.calendar)r.dueDate=addDays(action.date,1);}
        if(task){task.recordedMinutes=(task.recordedMinutes||(task.done?task.minutes:0))+action.minutes;task.done=task.recordedMinutes>=task.minutes;}
      }
      recordTitle=`Estudo: ${action.topic}`;break;
    }
    case "task": {
      subject(action.subjectId);recordId=action.id||crypto.randomUUID();const old=action.id?requireRecord(next.tasks,action.id):undefined;
      const recordedMinutes=old?.recordedMinutes||(old?.done?old.minutes:0)||0;
      next.tasks=save(next.tasks,{id:recordId,subjectId:action.subjectId,title:action.title,minutes:action.minutes,date:action.date,recordedMinutes,done:recordedMinutes>=action.minutes,...(old?.plannerRef&&old.subjectId===action.subjectId?{plannerRef:old.plannerRef}:{})},action.id);recordTitle=`Missão: ${action.title}`;break;
    }
    case "note":subject(action.subjectId);recordId=action.id||crypto.randomUUID();next.notes=save(next.notes,{id:recordId,subjectId:action.subjectId,title:action.title,content:action.content,updatedAt:now},action.id);recordTitle=`Anotação: ${action.title}`;break;
    case "error":{
      subject(action.subjectId);recordId=action.id||crypto.randomUUID();const old=action.id?requireRecord(next.errors,action.id):undefined;
      next.errors=save(next.errors,{id:recordId,subjectId:action.subjectId,question:action.question,answer:action.answer,reason:action.reason,resolved:action.resolved,createdAt:old?.createdAt||now},action.id);
      if(!old)next.reviews.push({id:crypto.randomUUID(),subjectId:action.subjectId,title:`Caderno de erros: ${action.question.slice(0,110)}`,dueDate:todayKey(),interval:1});
      recordTitle=`Caderno de erros: ${action.question.slice(0,100)}`;break;
    }
    case "topic":{
      const s=subject(action.subjectId);if(action.index>=s.topics.length)throw new Error("Tópico não encontrado.");recordId=topicKey(s.id,action.index);
      next.completedTopics=next.completedTopics.filter(k=>k!==recordId);if(action.completed)next.completedTopics.push(recordId);recordTitle=`Tópico: ${s.topics[action.index]}`;break;
    }
    case "profile":{next.profile={...next.profile,...(action.goal?{goal:action.goal}:{}),...(action.dailyMinutes?{dailyMinutes:action.dailyMinutes}:{}),...(action.weeklyMinutes?{weeklyMinutes:action.weeklyMinutes}:{})};recordId="profile";recordTitle="Metas de estudo atualizadas";break;}
    case "subject":{
      recordId=action.id||crypto.randomUUID();const old=action.id?subject(action.id):undefined;
      // Append new syllabus items without reindexing existing checkmarks or imported blocks.
      const topics=old?[...old.topics,...action.topics.filter(t=>!old.topics.includes(t))]:action.topics;
      next.subjects=save(next.subjects,{id:recordId,name:action.name,short:old?.short||action.name.slice(0,2).toUpperCase(),color:old?.color||"#8b73ca",topics,...(action.source||old?.source?{source:action.source||old?.source}:{})},action.id);recordTitle=`Disciplina: ${action.name}`;break;
    }
    case "review":{const r=requireRecord(next.reviews,action.id);if(r.completed||r.dueDate>todayKey())throw new Error("Esta revisão não está disponível hoje.");Object.assign(next,completeReview(next,r.id,action.rating));recordId=r.id;recordTitle=`Revisão: ${r.title}`;break;}
    case "event":{
      if(!next.planner)throw new Error("Importe seu ciclo antes de adicionar compromissos.");recordId=action.id||crypto.randomUUID();
      next.planner.events=save(next.planner.events,plannerEventSchema.parse({id:recordId,title:action.title,date:action.date,time:action.time,kind:action.kind,plannedMinutes:action.plannedMinutes,completed:action.completed,notes:action.notes,result:action.result}),action.id);recordTitle=`Agenda: ${action.title}`;break;
    }
    case "calendar":{
      if(!next.planner)throw new Error("Nenhum calendário importado.");
      const enteringStandard=action.variant==="standard"&&next.planner.variant!=="standard";
      next.planner={...next.planner,...(action.variant?{variant:action.variant}:{}),...(action.mode?{mode:action.mode}:{}),...(action.cycleStart?{cycleStart:action.cycleStart}:{}),...(action.examDate?{examDate:action.examDate,examDateConfirmed:false}:{})};
      if(enteringStandard&&!action.cycleStart)next.planner.cycleStart=standardCalendarStart(next.planner);
      if(action.examDate)next.profile.examDate=action.examDate;warnings=calendarWarnings(next.planner);recordId="calendar";recordTitle="Calendário do ciclo atualizado";break;
    }
    case "move_week":{
      if(!next.planner||!buildWeeks(next.planner).some(w=>w.id===action.weekId))throw new Error("Semana não encontrada no calendário.");recordId=action.weekId;
      next.planner.overrides=[...next.planner.overrides.filter(w=>w.weekId!==action.weekId),{weekId:action.weekId,start:monday(action.start),notes:action.notes}];warnings=calendarWarnings(next.planner);recordTitle="Semana reagendada";break;
    }
    case "generate_week":{
      const week=next.planner&&buildWeeks(next.planner).find(w=>w.id===action.weekId);if(!week)throw new Error("Semana não encontrada.");const generated=generateWeekTasks(next,week);Object.assign(next,generated.state);warnings=generated.warnings;recordId=week.id;recordTitle=`${generated.added} missões geradas: ${week.title}`;break;
    }
  }
  const validated=studyStateSchema.parse(reconcileStudyState(next));
  return {state:validated,receipt:{type:action.type,id:recordId,title:recordTitle.slice(0,200)},...(warnings?.length?{warnings}:{})};
}

export function assistantContext(state:StudyState){
  const stats=calculateStats(state),day=todayKey();
  let topicBudget=16000;
  const subjects=state.subjects.map(s=>({id:s.id,name:s.name,topics:s.topics.slice(0,40).flatMap((text,index)=>{const title=text.slice(0,200);if(topicBudget<title.length+40)return [];topicBudget-=title.length+40;return [{index,title}];})}));
  return {today:day,timezone:"America/Recife",profile:state.profile,stats:{level:stats.level,xp:stats.xp,streak:stats.streak,weekMinutes:stats.weekMinutes,totalQuestions:stats.totalQuestions},
    subjects,
    tasks:state.tasks.filter(t=>!t.done&&t.date>=addDays(day,-7)).slice(0,40),
    recentStudies:state.sessions.slice(-8),reviews:state.reviews.filter(r=>!r.completed).slice(0,20),
    notes:state.notes.slice(0,12).map(n=>({id:n.id,title:n.title,subjectId:n.subjectId})),
    planner:state.planner?{variant:state.planner.variant,mode:state.planner.mode,cycleStart:state.planner.cycleStart,examDate:state.planner.examDate,examDateConfirmed:state.planner.examDateConfirmed,weeks:buildWeeks(state.planner).map(w=>({id:w.id,start:w.start,end:w.end,title:w.title})),events:state.planner.events.slice(0,20).map(e=>({id:e.id,title:e.title,date:e.date,time:e.time,kind:e.kind,completed:e.completed}))}:null};
}

export function queryAssistantRecords(state:StudyState,kind:"sessions"|"tasks"|"notes"|"errors"|"reviews"|"subjects"|"planner",query="",recordId?:string){
  if(kind==="planner")return state.planner||null;
  const items=state[kind],term=query.toLocaleLowerCase("pt-BR");
  return items.filter(item=>(!recordId||item.id===recordId)&&(!term||JSON.stringify(item).toLocaleLowerCase("pt-BR").includes(term))).slice(-15);
}
