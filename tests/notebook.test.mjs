import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, studyStateSchema, calculateStats, reconcileStudyState } from '../lib/study.ts';
import { questionMetrics, performance, importNotebook, metricsForTopic } from '../lib/notebook.ts';
import { questionRecordSchema } from '../lib/notebook-schema.ts';
import { ensureTjspSyllabus, tjspSyllabus } from '../lib/tjsp-syllabus.ts';
const record=(patch={})=>({id:'q1',subjectId:'portugues',topic:'Pontuação.',date:'2026-11-10',kind:'Lote',name:'Lista',number:'',platform:'',questions:10,correct:6,guesses:2,cancelled:false,confidence:'Não informado',reason:'',review:false,explanation:'',...patch});
test('Notion thresholds include both 60 and 85 in Regular, never round before classifying',()=>{
  assert.equal(performance(null),'Sem questões');assert.equal(performance(0),'Ruim');assert.equal(performance(59.99),'Ruim');assert.equal(performance(60),'Regular');assert.equal(performance(85),'Regular');assert.equal(performance(85.001),'Bom');
});
test('weighted metrics, guessed answers, cancelled questions and no-data',()=>{
  const m=questionMetrics([record(),record({id:'q2',questions:90,correct:81,guesses:3}),record({id:'q3',cancelled:true,questions:100,correct:100})]);
  assert.equal(m.questions,100);assert.equal(m.apparent,87);assert.equal(m.real,82);assert.equal(m.errors,13);
  assert.equal(questionMetrics([]).apparent,null);assert.equal(questionMetrics([record({correct:0})]).real,0);
});
test('reject invalid counts, dates and individual batches',()=>{
  for(const patch of [{correct:11},{guesses:11},{questions:0},{questions:1.5},{date:'2026-02-30'},{kind:'Prova'}])assert.equal(questionRecordSchema.safeParse(record(patch)).success,false);
});
test('TJSP migration is idempotent and keeps existing indices and history',()=>{
  const state=createInitialState(false);state.completedTopics=['portugues:0'];state.subjects[0].topics.push('Meu tópico pessoal');
  const next=ensureTjspSyllabus(state);assert.deepEqual(next.subjects[0].topics.slice(0,state.subjects[0].topics.length),state.subjects[0].topics);
  assert.deepEqual(next.completedTopics,state.completedTopics);assert.deepEqual(ensureTjspSyllabus(next),next);assert.equal(tjspSyllabus.reduce((n,s)=>n+s.topics.length,0),104);
  assert.equal(studyStateSchema.safeParse(next).success,true);
});
test('import deduplicates within file and repeat imports without overwriting edits',()=>{
  const state=ensureTjspSyllabus(createInitialState(false));const input={format:'soso-questions-v1',records:[record({sourceKey:'file:3'}),record({sourceKey:'file:3'})]};
  const imported=importNotebook(state,input);assert.equal(imported.questionRecords.length,1);
  imported.questionRecords[0].explanation='Minha edição';assert.deepEqual(importNotebook(imported,input),imported);
  assert.throws(()=>importNotebook(state,{...input,records:[record({subjectId:'missing'})]}));
});
test('topic metrics aggregate explicit links, exclude unrelated subjects and recompute after edit/delete',()=>{
  const state=ensureTjspSyllabus(createInitialState(false));state.questionRecords=[record({topic:'Virgula',syllabusTopic:'Pontuação.'}),record({id:'other',subjectId:'penal'})];
  state.sessions=[{id:'s1',subjectId:'portugues',topic:'Pontuação.',minutes:10,questions:10,correct:10,date:'2026-11-10'}];
  assert.equal(metricsForTopic(state,'portugues','Pontuação.').apparent,80);
  state.questionRecords[0].correct=10;assert.equal(metricsForTopic(state,'portugues','Pontuação.').apparent,100);
  state.questionRecords=[];assert.equal(metricsForTopic(state,'portugues','Pontuação.').questions,10);
});
test('schema rejects unknown links, duplicate records and duplicate progress',()=>{
 const s=ensureTjspSyllabus(createInitialState(false));s.questionRecords=[record({syllabusTopic:'missing'})];assert.equal(studyStateSchema.safeParse(s).success,false);
 s.questionRecords=[record(),record()];assert.equal(studyStateSchema.safeParse(s).success,false);
 s.questionRecords=[];const p={subjectId:'portugues',topic:'Pontuação.',status:'Pendente',reverse:false,theory:false,law:false,lesson:false,review1:false,review2:false,review3:false};s.topicProgress=[p,p];assert.equal(studyStateSchema.safeParse(s).success,false);
});
test('notebook counts enter dashboard without generating study time or sessions',()=>{
 const s=ensureTjspSyllabus(createInitialState(false));s.questionRecords=[record()];const next=reconcileStudyState(s,'2026-11-10');
 const m=calculateStats(next,'2026-11-10');assert.equal(m.totalQuestions,10);assert.equal(m.totalMinutes,0);assert.equal(m.accuracy,60);assert.deepEqual(next.sessions,[]);
});
