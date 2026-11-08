import assert from 'node:assert/strict';
import test from 'node:test';
import {createInitialState,studyStateSchema,completeStudy} from '../lib/study.ts';
import {plannerSchema} from '../lib/planner-schema.ts';
import {buildWeeks,calendarWarnings,generateWeekTasks,importPlanner,weekBlocks,blockMinutes,stepKey,stages} from '../lib/planner.ts';
function fixture(variant='standard',cycleStart='2026-11-02'){
 return plannerSchema.parse({title:'Plano de teste',source:'Material particular de teste',sourceVersion:'1',sourceUpdatedAt:'2026-10-19',checkedAt:'2026-11-08',examDate:'2027-03-14',examDateConfirmed:false,variant,mode:'standard',cycleStart,cycles:Array.from({length:10},(_,i)=>({id:`c${i+1}`,number:i+1,title:`Ciclo ${i+1}`,blocks:[{id:`b${i+1}`,subjectId:'portugues',subjectName:'Língua Portuguesa',title:`Bloco de teste ${i+1}`,topics:[`Tópico de teste ${i+1}`],minutes:120,family:'language'},{id:`math${i+1}`,subjectId:'matematica',subjectName:'Matemática',title:'Exercícios',topics:['Operações de teste'],minutes:60,family:'math'}]})),events:[],completedSteps:[],completedWeeks:[],overrides:[]});
}
test('calendar preserves cycle, cumulative, grouped and final weeks across the year',()=>{
 const weeks=buildWeeks(fixture());
 const cycle=n=>weeks.find(w=>w.title===`Ciclo ${n}`);
 assert.equal(cycle(1).start,'2026-11-02');assert.equal(cycle(6).start,'2026-12-14');assert.equal(cycle(10).start,'2027-01-11');
 assert.deepEqual(weeks.filter(w=>w.kind==='cumulative').map(w=>w.start),['2026-12-07','2027-01-18']);
 assert.deepEqual(weeks.filter(w=>w.kind==='final').map(w=>[w.start,w.end]),[['2027-03-01','2027-03-07'],['2027-03-08','2027-03-13']]);
 assert.equal(weeks.find(w=>w.title==='Ciclos 1 + 2').start,'2027-01-25');
 assert.equal(weeks[0].kind,'orientation');assert.equal(weeks[0].start,'2026-10-19');
});
test('speed, intensive and restart calendars keep their distinct sequences',()=>{
 const speed=buildWeeks(fixture('speed','2026-12-14'));assert.equal(speed.find(w=>w.title==='Ciclo 6').start,'2027-01-25');
 const hard=buildWeeks(fixture('hard','2026-10-26'));assert.equal(hard.filter(w=>w.title==='Ciclos 1 + 2 + 3').length,2);assert.equal(hard.find(w=>w.title==='Ciclo 10').start,'2027-01-04');
 const emergency=buildWeeks(fixture('emergency','2026-12-21'));assert.equal(emergency.filter(w=>w.kind==='cumulative').length,0);assert.equal(emergency.find(w=>w.title==='Ciclo 10').start,'2027-02-22');
 const superPlan=buildWeeks(fixture('super-emergency','2027-02-01'));assert.equal(superPlan.find(w=>w.title==='Ciclos 9 + 10').start,'2027-03-01');assert.equal(superPlan.filter(w=>w.kind==='final').length,1);assert.equal(superPlan.at(-1).end,'2027-03-13');
});
test('flex fills available weeks; late calendars warn instead of silently claiming to fit',()=>{
 const p=fixture('flex','2026-11-16'),weeks=buildWeeks(p);assert.ok(weeks.some(w=>w.kind==='extra'));assert.ok(!calendarWarnings(p).some(w=>w.includes('sobrepostas')));
 const late=fixture('flex','2027-02-22');assert.ok(calendarWarnings(late).some(w=>w.includes('depois da prova')));assert.ok(calendarWarnings(late).some(w=>w.includes('sobrepostas')));
 p.examDate='2027-03-15';assert.ok(buildWeeks(p).every(w=>w.kind!=='final'||w.end>=w.start));assert.ok(buildWeeks(p).filter(w=>w.kind==='final').every(w=>w.end<p.examDate));
});
test('essential load omits math, preserves legal replacement blocks and per-cycle actual load',()=>{
 const p=fixture();p.mode='essential';p.cycles[9].blocks=[{...p.cycles[9].blocks[0],family:'law',minutes:420,title:'Regimento de teste'}];
 const w=buildWeeks(p).find(w=>w.title==='Ciclo 1');assert.equal(weekBlocks(p,w).length,1);
 const last=buildWeeks(p).find(w=>w.title==='Ciclo 10');assert.equal(weekBlocks(p,last)[0].block.minutes,420);
});
test('weekly generation is idempotent, restores deleted work safely and respects actual study minutes',()=>{
 let state=importPlanner(createInitialState(false),fixture());const week=buildWeeks(state.planner).find(w=>w.title==='Ciclo 1');
 const first=generateWeekTasks(state,week);assert.ok(first.added>0);assert.ok(studyStateSchema.safeParse(first.state).success);assert.equal(generateWeekTasks(first.state,week).added,0);
 const removed=first.state.tasks.find(t=>t.plannerRef?.blockId==='b1');const reduced={...first.state,tasks:first.state.tasks.filter(t=>t.id!==removed.id)};const restored=generateWeekTasks(reduced,week);assert.ok(restored.added>0);assert.equal(new Set(restored.state.tasks.map(t=>t.id)).size,restored.state.tasks.length);
 state=completeStudy(state,{subjectId:'portugues',topic:'Bloco de teste 1',minutes:27,questions:20,correct:15,plannerRef:{weekId:week.id,cycleId:'c1',blockId:'b1'}});
 const partial=generateWeekTasks(state,week);assert.equal(blockMinutes(partial.state,week.id,'b1'),27);assert.ok(partial.state.tasks.every(t=>t.minutes%5===0));assert.ok(studyStateSchema.safeParse(partial.state).success);
});
test('same block on another pass gets independent progress and sessions',()=>{
 const p=fixture();const w=buildWeeks(p),first=w.find(w=>w.title==='Ciclo 1'),second=w.find(w=>w.title==='Ciclos 1 + 2');
 assert.notEqual(stepKey(first.id,'b1','practice'),stepKey(second.id,'b1','practice'));
 let state=importPlanner(createInitialState(false),p);state=completeStudy(state,{subjectId:'portugues',topic:'Teste',minutes:25,questions:0,correct:0,plannerRef:{weekId:first.id,cycleId:'c1',blockId:'b1'}});
 assert.equal(blockMinutes(state,second.id,'b1'),0);assert.equal(stages(p.cycles[0].blocks[1])[0].id,'theory');assert.equal(stages(p.cycles[0].blocks[0])[0].id,'reverse');
});
test('source update merges new topics without invalidating checklist indexes or erasing study history',()=>{
 let state=importPlanner(createInitialState(true),fixture());state.planner.completedSteps=['standard-w1/b1/theory'];state.planner.completedWeeks=['standard-w1'];state.planner.mode='essential';
 const indexes=[...state.subjects.find(s=>s.id==='portugues').topics],sessions=state.sessions;
 const incoming=fixture();incoming.sourceVersion='2';incoming.cycles[0].blocks[0].topics=['Novo tópico de teste'];
 const updated=importPlanner(state,incoming);assert.deepEqual(updated.subjects.find(s=>s.id==='portugues').topics.slice(0,indexes.length),indexes);assert.deepEqual(updated.sessions,sessions);assert.equal(updated.planner.mode,'essential');assert.deepEqual(updated.planner.completedWeeks,['standard-w1']);assert.equal(updated.planner.sourceVersion,'2');
 assert.ok(studyStateSchema.safeParse(updated).success);
});
test('validation blocks impossible dates, duplicate cycle IDs and impossible simulated scores',()=>{
 const p=fixture();p.events=[{id:'m1',title:'Teste',date:'2027-02-30',kind:'mock',completed:false,notes:''}];assert.equal(plannerSchema.safeParse(p).success,false);
 p.events[0].date='2027-02-28';p.events[0].result={questions:10,correct:11,minutes:60};assert.equal(plannerSchema.safeParse(p).success,false);
 p.events=[];p.cycles[1].id='c1';assert.equal(plannerSchema.safeParse(p).success,false);
});
test('last revision week never generates work on or after exam day',()=>{
 const state=importPlanner(createInitialState(false),fixture());const last=buildWeeks(state.planner).at(-1);const result=generateWeekTasks(state,last);
 assert.ok(result.state.tasks.every(t=>t.date<state.planner.examDate));
});
test('a scheduled Sunday mock replaces essay instead of double-booking the weekend',()=>{
 let p=fixture();p.events=[{id:'mock1',title:'Simulado de teste',date:'2026-11-08',kind:'mock',completed:false,notes:''}];
 let state=importPlanner(createInitialState(false),p);const week=buildWeeks(p).find(w=>w.title==='Ciclo 1');let result=generateWeekTasks(state,week);
 assert.ok(!result.state.tasks.some(t=>t.subjectId==='redacao'));assert.ok(result.warnings.some(w=>w.includes('duração do simulado')));
 p.events[0].plannedMinutes=180;state=importPlanner(createInitialState(false),p);result=generateWeekTasks(state,week);assert.equal(result.state.tasks.find(t=>t.subjectId==='simulados').minutes,180);assert.ok(result.state.tasks.some(t=>t.subjectId==='revisao-geral'));
});
