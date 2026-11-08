import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState, completeStudy, calculateStats, reconcileStudyState, studyStateSchema, addDays, todayKey } from '../lib/study.ts';
import { plannerSchema } from '../lib/planner-schema.ts';
import { completeReview, reconcileReviews, reviewWindows } from '../lib/reviews.ts';

function fixture(variant='standard',cycleStart='2026-11-02') {
 const state=createInitialState(false);
 state.planner=plannerSchema.parse({title:'Plano de teste',source:'Calendário de teste',sourceVersion:'1',sourceUpdatedAt:'2026-10-19',checkedAt:'2026-11-08',examDate:'2027-03-14',variant,mode:'standard',cycleStart,cycles:Array.from({length:10},(_,i)=>({id:`c${i+1}`,number:i+1,title:`Ciclo ${i+1}`,blocks:[{id:`b${i+1}`,subjectId:'portugues',subjectName:'Língua Portuguesa',title:`Conteúdo ${i+1}`,topics:[`Tema ${i+1}`],minutes:60,family:'language'}]})),events:[]});
 state.sessions=[{id:'s',subjectId:'portugues',topic:'Conteúdo 1',minutes:25,questions:10,correct:8,date:'2026-11-02',plannerRef:{weekId:'standard-w1',cycleId:'c1',blockId:'b1'}}];
 state.reviews=[{id:'r',subjectId:'portugues',title:'Conteúdo 1',dueDate:'2026-11-03',interval:1}];
 return state;
}
test('page 6 calendars schedule cumulative, grouped and final windows, never the following day',()=>{
 const state=reconcileReviews(fixture(),'2026-11-02');
 assert.equal(state.reviews[0].dueDate,'2026-12-07');assert.equal(state.reviews[0].calendar.endDate,'2026-12-13');
 const windows=reviewWindows(state.planner);
 assert.deepEqual(windows.filter(w=>w.kind==='cumulative').map(w=>w.start),['2026-12-07','2027-01-18']);
 assert.deepEqual(windows.filter(w=>w.kind==='cycle').map(w=>w.start),['2027-01-25','2027-02-01','2027-02-08','2027-02-15','2027-02-22']);
 assert.deepEqual(windows.filter(w=>w.kind==='final').map(w=>[w.start,w.end]),[['2027-03-01','2027-03-07'],['2027-03-08','2027-03-13']]);
 assert.deepEqual(state.sessions,fixture().sessions);assert.equal(studyStateSchema.safeParse(state).success,true);
});
test('cycle 6 does not enter cumulative revision of cycles 1 through 5',()=>{
 const state=fixture();state.sessions[0].topic='Conteúdo 6';state.sessions[0].plannerRef.cycleId='c6';state.reviews[0].title='Conteúdo 6';
 assert.equal(reconcileReviews(state,'2026-11-02').reviews[0].dueDate,'2027-01-18');
});
test('remembered reviews advance through the prescribed windows; difficult reviews stay assigned',()=>{
 const first=reconcileReviews(fixture(),'2026-12-07');
 assert.equal(completeReview(first,'r','again','2026-12-07').reviews[0].dueDate,'2026-12-07');
 assert.equal(completeReview(first,'r','good','2026-12-06').reviewCompletions,undefined);
 const next=completeReview(first,'r','good','2026-12-07');
 assert.equal(next.reviews[0].dueDate,'2027-01-18');assert.equal(next.reviewCompletions.length,1);
 assert.equal(completeReview(next,'r','easy','2026-12-07').reviewCompletions.length,1);
 assert.equal(completeReview(first,'r','easy','2026-12-07').reviews[0].dueDate,next.reviews[0].dueDate);
 let walk=next;for(const date of ['2027-01-18','2027-01-25','2027-03-01','2027-03-08'])walk=completeReview(walk,'r','good',date);
 assert.equal(walk.reviews[0].completed,true);assert.equal(walk.reviewCompletions.length,5);
 assert.equal(reconcileReviews(walk,'2027-03-12').reviews[0].completed,true);
 assert.equal(studyStateSchema.safeParse(walk).success,true);
});
test('legacy error cards migrate, overdue windows persist, and calendar edits reschedule without data loss',()=>{
 const state=fixture();state.reviews.push({id:'error-r',subjectId:'portugues',title:'Caderno de erros: teste',dueDate:'2026-11-03',interval:1});
 let next=reconcileReviews(state,'2026-11-02');assert.equal(next.reviews[1].dueDate,'2026-12-07');
 assert.equal(reconcileReviews(next,'2027-02-20').reviews[0].dueDate,'2026-12-07');
 next.planner.overrides=[{weekId:'standard-w6',start:'2026-12-14',notes:'Ajuste'}];
 next=reconcileReviews(next,'2026-11-02');assert.equal(next.reviews[0].dueDate,'2026-12-14');assert.equal(next.reviews[1].dueDate,'2026-12-14');
 assert.equal(next.sessions.length,1);
});
test('flex, speed and hard use their own page 6 sequence and final dates',()=>{
 const flex=reviewWindows(fixture('flex','2026-11-16').planner);assert.deepEqual(flex.filter(w=>w.kind==='cumulative').map(w=>w.start),['2026-12-21','2027-02-01']);
 const speed=reviewWindows(fixture('speed','2026-12-14').planner);assert.deepEqual(speed.filter(w=>w.kind==='cumulative').map(w=>w.start),['2027-01-18']);assert.equal(speed.filter(w=>w.kind==='cycle').length,0);
 const hard=reviewWindows(fixture('hard','2026-10-26').planner);assert.deepEqual(hard.filter(w=>w.kind==='cumulative').map(w=>w.start),['2026-11-30','2027-01-11']);assert.equal(hard.filter(w=>w.kind==='cycle').length,6);
 for(const list of [flex,speed,hard])assert.equal(list.at(-1).end,'2027-03-13');
});
test('earned medals and their bonus survive a broken streak and are awarded only once',()=>{
 let state=createInitialState(false);state.sessions=Array.from({length:7},(_,i)=>({id:`s${i}`,subjectId:'portugues',topic:'Teste',minutes:25,questions:10,correct:8,date:addDays('2026-11-01',i)}));
 state=reconcileStudyState(state,'2026-11-07');
 const stats=calculateStats(state,'2026-11-07');assert.ok(stats.achievements.length>=30);assert.ok(stats.achievementXp>0);assert.ok(stats.level>1);assert.equal(stats.bestStreak,7);
 const later=calculateStats(reconcileStudyState(state,'2026-11-20'),'2026-11-20');assert.equal(later.streak,0);assert.equal(later.achievementXp,stats.achievementXp);assert.equal(later.level,stats.level);
 assert.deepEqual(reconcileStudyState(state,'2026-11-07'),state);
});
test('removing a note or toggling an error cannot repeatedly farm achievement XP',()=>{
 let state=createInitialState(false);state.notes=Array.from({length:5},(_,i)=>({id:`n${i}`,subjectId:'portugues',title:'Teste',content:'Conteúdo',updatedAt:'2026-11-01'}));
 state=reconcileStudyState(state,'2026-11-08');const earned=calculateStats(state,'2026-11-08').achievementXp;
 const noNotes=reconcileStudyState({...state,notes:[]},'2026-11-08');assert.equal(calculateStats(noNotes,'2026-11-08').achievementXp,earned);
 assert.equal(calculateStats(reconcileStudyState({...noNotes,notes:state.notes},'2026-11-08'),'2026-11-08').achievementXp,earned);
 assert.equal(studyStateSchema.safeParse({...state,achievements:[...state.achievements,state.achievements[0]]}).success,false);
});
test('partial focus sessions do not award the completed Pomodoro achievement',()=>{
 const state=createInitialState(false);state.sessions=[{id:'s',subjectId:'portugues',topic:'Teste',minutes:10,questions:0,correct:0,date:'2026-11-08',pomodoros:0}];
 assert.equal(calculateStats(state,'2026-11-08').achievements.find(a=>a.id==='pomodoro-1').unlocked,false);
 state.sessions[0].pomodoros=1;assert.equal(calculateStats(state,'2026-11-08').achievements.find(a=>a.id==='pomodoro-1').unlocked,true);
});
test('a completed window cannot reappear after that calendar week is moved forward',()=>{
 let state=completeReview(fixture(),'r','good','2026-12-07');
 state.planner.overrides=[{weekId:'standard-w6',start:'2026-12-14',notes:'Calendário ajustado'}];
 state=reconcileReviews(state,'2026-12-08');assert.equal(state.reviews[0].dueDate,'2027-01-18');
 assert.equal(state.reviewCompletions.length,1);
});
test('new study uses the linked cycle review window and restudying does not reset it to tomorrow',()=>{
 const state=fixture();state.reviews=[];state.sessions=[];
 const input={subjectId:'portugues',topic:'Conteúdo 6',minutes:25,questions:0,correct:0,plannerRef:{weekId:'standard-w7',cycleId:'c6',blockId:'b6'}};
 const next=completeStudy(state,input);const window=reviewWindows(state.planner).find(w=>w.end>=todayKey()&&w.cycleIds.includes('c6'));
 assert.equal(next.reviews[0].calendar.weekId,window?.id);assert.equal(next.reviews[0].completed,!window);
 const again=completeStudy(next,input);assert.equal(again.reviews.length,1);assert.equal(again.reviews[0].dueDate,next.reviews[0].dueDate);
 assert.equal(studyStateSchema.safeParse(again).success,true);
});
