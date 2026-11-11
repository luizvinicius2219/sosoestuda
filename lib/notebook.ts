import type { StudyState } from "./study.ts";
import { notebookImportSchema, type QuestionRecord, type TopicProgress } from "./notebook-schema.ts";

export const normalizeTopic = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function performance(percent:number|null) { return percent===null ? "Sem questões" : percent<60 ? "Ruim" : percent<=85 ? "Regular" : "Bom"; }
export function questionMetrics(records:QuestionRecord[]) {
  const valid=records.filter(q=>!q.cancelled);
  const questions=valid.reduce((n,q)=>n+q.questions,0), correct=valid.reduce((n,q)=>n+q.correct,0), guesses=valid.reduce((n,q)=>n+q.guesses,0);
  return {questions,correct,guesses,errors:questions-correct,apparent:questions?correct/questions*100:null,real:questions?Math.max(0,correct-guesses)/questions*100:null};
}
export function metricsForTopic(state:StudyState,subjectId:string,topic:string) {
  const key=normalizeTopic(topic);
  const records=(state.questionRecords||[]).filter(q=>q.subjectId===subjectId && normalizeTopic(q.syllabusTopic || q.topic)===key);
  const m=questionMetrics(records);
  // Study sessions and notebook entries are separate activity sources; notebook import never creates sessions.
  const sessions=state.sessions.filter(s=>s.subjectId===subjectId && normalizeTopic(s.topic)===key);
  const questions=m.questions+sessions.reduce((n,s)=>n+s.questions,0), correct=m.correct+sessions.reduce((n,s)=>n+s.correct,0);
  return {...m,questions,correct,errors:questions-correct,apparent:questions?correct/questions*100:null,real:questions?Math.max(0,correct-m.guesses)/questions*100:null};
}
export function progressFor(state:StudyState,subjectId:string,topic:string):TopicProgress {
  return state.topicProgress?.find(p=>p.subjectId===subjectId && p.topic===topic) || {subjectId,topic,status:"Pendente",reverse:false,theory:false,law:false,lesson:false,review1:false,review2:false,review3:false};
}
export function importNotebook(state:StudyState,input:unknown):StudyState {
  const {records}=notebookImportSchema.parse(input);
  const ids=new Set((state.questionRecords||[]).map(q=>q.id));
  const sources=new Set((state.questionRecords||[]).flatMap(q=>q.sourceKey?[q.sourceKey]:[]));
  const incoming:QuestionRecord[]=[];
  for(const q of records){
    if(!state.subjects.some(s=>s.id===q.subjectId)) throw new Error("A importação contém uma disciplina ainda não cadastrada.");
    if(ids.has(q.id)||(q.sourceKey&&sources.has(q.sourceKey)))continue;
    incoming.push(q);ids.add(q.id);if(q.sourceKey)sources.add(q.sourceKey);
  }
  if((state.questionRecords?.length||0)+incoming.length>5000)throw new Error("O limite é de 5.000 registros.");
  return {...state,questionRecords:[...(state.questionRecords||[]),...incoming]};
}
