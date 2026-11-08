import assert from 'node:assert/strict';
import test from 'node:test';
import {MockLanguageModelV4} from 'ai/test';
import {APICallError} from 'ai';
import {applyAssistantAction,queryAssistantRecords} from '../lib/assistant-actions.ts';
import {assistantRequestSchema,assistantMessageSchema} from '../lib/assistant-schema.ts';
import {runLia,groundedResearch,liaError} from '../lib/lia.ts';
import {createInitialState,calculateStats,studyStateSchema,todayKey,addDays} from '../lib/study.ts';
import {importPlanner} from '../lib/planner.ts';
import {plannerSchema} from '../lib/planner-schema.ts';

const usage={inputTokens:{total:10,noCache:10,cacheRead:undefined,cacheWrite:undefined},outputTokens:{total:20,text:20,reasoning:undefined}};
const call=(name,input,id='c1')=>({content:[{type:'tool-call',toolCallId:id,toolName:name,input:JSON.stringify(input)}],finishReason:{unified:'tool-calls',raw:undefined},usage,warnings:[]});
const done={content:[{type:'text',text:'Prontinho, vamos juntas!'}],finishReason:{unified:'stop',raw:undefined},usage,warnings:[]};
const input={type:'study',subjectId:'portugues',topic:'Interpretação',minutes:25,questions:10,correct:8};
function plannerState(){const state=createInitialState(false);state.planner=plannerSchema.parse({title:'Plano de teste',source:'Teste',sourceVersion:'1',sourceUpdatedAt:'2026-11-01',checkedAt:'2026-11-08',examDate:'2027-03-14',variant:'standard',mode:'standard',cycleStart:'2026-11-02',cycles:Array.from({length:10},(_,i)=>({id:`c${i+1}`,number:i+1,title:`Ciclo ${i+1}`,blocks:[{id:`b${i+1}`,subjectId:'portugues',subjectName:'Língua Portuguesa',title:`Tema ${i+1}`,topics:[`Tema ${i+1}`],minutes:60,family:'language'}]})),events:[]});return importPlanner(state,state.planner);}

test('Lia creates real sessions with calendar reviews, while planning never awards study XP',()=>{
 const state=plannerState();const result=applyAssistantAction(state,input);
 assert.equal(result.state.sessions.length,1);assert.ok(result.state.reviews[0].calendar);assert.equal(result.receipt.type,'study');assert.equal(state.sessions.length,0);
 const task=applyAssistantAction(state,{type:'task',subjectId:'portugues',title:'Revisar texto',minutes:30,date:todayKey()});
 assert.equal(task.state.sessions.length,0);assert.equal(calculateStats(task.state).xp,0);assert.equal(studyStateSchema.safeParse(task.state).success,true);
});
test('invalid scores, unknown IDs, extra privileged fields and missing records cannot mutate state',()=>{
 const state=createInitialState(false),before=structuredClone(state);
 for(const action of [{...input,correct:11},{...input,subjectId:'missing'},{...input,pomodoros:10},{...input,id:'missing'},{type:'profile',apiKey:'secret'},{type:'delete',id:'profile'}])assert.throws(()=>applyAssistantAction(state,action));
 assert.deepEqual(state,before);
});
test('partial task studies preserve mission progress and an edit does not fabricate a completed mission',()=>{
 let state=applyAssistantAction(createInitialState(false),{type:'task',subjectId:'portugues',title:'Texto',minutes:60,date:todayKey()}).state;
 const taskId=state.tasks[0].id;state=applyAssistantAction(state,{...input,topic:'Texto',taskId}).state;
 assert.equal(state.tasks[0].recordedMinutes,25);assert.equal(state.tasks[0].done,false);
 state=applyAssistantAction(state,{type:'task',id:taskId,subjectId:'portugues',title:'Texto atualizado',minutes:90,date:todayKey()}).state;
 assert.equal(state.tasks[0].recordedMinutes,25);assert.equal(state.tasks[0].done,false);
});
test('subject updates append content without changing completed-topic indexes',()=>{
 const state=createInitialState(false);state.completedTopics=['portugues:0'];const topics=[...state.subjects[0].topics];
 const next=applyAssistantAction(state,{type:'subject',id:'portugues',name:'Português',topics:['Novo tópico',topics[0]]}).state;
 assert.deepEqual(next.subjects[0].topics.slice(0,topics.length),topics);assert.equal(next.subjects[0].topics.at(-1),'Novo tópico');assert.deepEqual(next.completedTopics,['portugues:0']);
});
test('notes, errors, goals and event results save with validation and can be queried for later updates',()=>{
 let state=plannerState();state=applyAssistantAction(state,{type:'note',subjectId:'portugues',title:'Resumo',content:'Minha anotação'}).state;
 assert.equal(queryAssistantRecords(state,'notes','Resumo')[0].content,'Minha anotação');
 state=applyAssistantAction(state,{type:'error',subjectId:'portugues',question:'Dúvida',answer:'Explicação',reason:'Confusão'}).state;
 assert.ok(state.reviews[0].calendar);state=applyAssistantAction(state,{type:'profile',dailyMinutes:150,weeklyMinutes:750}).state;assert.equal(state.profile.dailyMinutes,150);
 state=applyAssistantAction(state,{type:'event',title:'Simulado',date:'2027-01-10',kind:'mock',completed:true,result:{questions:10,correct:8,minutes:60}}).state;
 assert.equal(state.planner.events.length,1);assert.equal(studyStateSchema.safeParse(state).success,true);
 assert.throws(()=>applyAssistantAction(state,{type:'event',title:'Inválido',date:'2027-01-10',kind:'mock',result:{questions:1,correct:2,minutes:10}}));
});
test('calendar actions and week generation use existing planner rules and are idempotent',()=>{
 let state=plannerState();const first=applyAssistantAction(state,{type:'generate_week',weekId:'standard-w1'});state=first.state;
 const count=state.tasks.length;assert.ok(count>0);assert.equal(applyAssistantAction(state,{type:'generate_week',weekId:'standard-w1'}).state.tasks.length,count);
 state=applyAssistantAction(state,{type:'move_week',weekId:'standard-w6',start:'2026-12-16'}).state;assert.equal(state.planner.overrides[0].start,'2026-12-14');
 state=applyAssistantAction(state,{type:'calendar',examDate:'2027-03-21'}).state;assert.equal(state.profile.examDate,'2027-03-21');assert.equal(state.planner.examDateConfirmed,false);
});
test('the SDK tool loop executes a valid action once, returns a receipt and leaves its input unchanged',async()=>{
 const state=createInitialState(false);const model=new MockLanguageModelV4({doGenerate:[call('registrar_estudo',Object.fromEntries(Object.entries(input).filter(([key])=>key!=='type'))),call('registrar_estudo',Object.fromEntries(Object.entries(input).filter(([key])=>key!=='type')),'c2'),done]});
 const result=await runLia({state,message:'Registre meu estudo.',actions:true,web:false,modelOverride:model,signal:AbortSignal.timeout(5000)});
 assert.equal(result.state.sessions.length,1);assert.equal(result.receipts.length,1);assert.equal(state.sessions.length,0);assert.equal(result.answer,done.content[0].text);
});
test('disabling actions and internet is enforced by tools even if a model attempts calls',async()=>{
 const state=createInitialState(false);let researched=false;
 const model=new MockLanguageModelV4({doGenerate:[call('registrar_estudo',Object.fromEntries(Object.entries(input).filter(([key])=>key!=='type'))),call('pesquisar_internet',{query:'Teste'},'c2'),done]});
 const result=await runLia({state,message:'Só converse.',actions:false,web:false,modelOverride:model,researchOverride:async()=>{researched=true;return {text:'x',sources:[]};},signal:AbortSignal.timeout(5000)});
 assert.equal(result.receipts.length,0);assert.equal(result.state.sessions.length,0);assert.equal(researched,false);
});
test('research keeps real source URLs and untrusted search HTML out of the model instructions',async()=>{
 const source={title:'Fonte oficial',url:'https://www.tjsp.jus.br/'};
 const model=new MockLanguageModelV4({doGenerate:[call('pesquisar_internet',{query:'Site oficial TJSP'}),done]});
 const result=await runLia({state:createInitialState(false),message:'Pesquise.',actions:false,web:true,modelOverride:model,researchOverride:async()=>({text:'Tribunal de Justiça.',sources:[source],searchHtml:'<div>Busca</div>'}),signal:AbortSignal.timeout(5000)});
 assert.deepEqual(result.sources,[source]);assert.equal(result.searchHtml,'<div>Busca</div>');
 const safe=groundedResearch({text:'Resposta',sources:[{sourceType:'url',title:'Unsafe',url:'javascript:alert(1)'},{sourceType:'url',title:'Oficial',url:source.url},{sourceType:'url',url:source.url}]});
 assert.equal(safe.sources.length,1);assert.ok(!groundedResearch({text:'Sem fontes',sources:[]}).text.includes('Sem fontes'));
});
test('request/history validation blocks oversized messages and unsafe source URLs; errors do not expose provider internals',()=>{
 assert.equal(assistantRequestSchema.safeParse({requestId:crypto.randomUUID(),message:'x'.repeat(3001),version:1}).success,false);
 const message={id:'m',requestId:crypto.randomUUID(),role:'assistant',content:'Oi',createdAt:new Date().toISOString(),sources:[{title:'Fonte',url:'javascript:alert(1)'}]};
 assert.equal(assistantMessageSchema.safeParse(message).success,false);
 const error=new APICallError({message:'secret-api-key',url:'https://example.com',requestBodyValues:{key:'secret'},statusCode:429,responseBody:'private'});
 const safe=liaError(error);assert.equal(safe.status,429);assert.ok(!safe.message.includes('secret'));
});
test('historical study registration uses the actual date, updates progress on correction and rejects future sessions',()=>{
 let state=applyAssistantAction(createInitialState(false),{type:'task',subjectId:'portugues',title:'Interpretação',minutes:60,date:todayKey()}).state;
 const date=addDays(todayKey(),-1),taskId=state.tasks[0].id;
 state=applyAssistantAction(state,{...input,date,taskId}).state;assert.equal(state.sessions[0].date,date);assert.equal(state.tasks[0].recordedMinutes,25);
 state=applyAssistantAction(state,{...input,id:state.sessions[0].id,minutes:40}).state;assert.equal(state.tasks[0].recordedMinutes,40);assert.equal(state.sessions[0].date,date);
 assert.throws(()=>applyAssistantAction(state,{...input,date:addDays(todayKey(),1)}));
});
test('a failed provider call after staged actions cannot mutate the original persisted snapshot',async()=>{
 const state=createInitialState(false),original=structuredClone(state);
 const model=new MockLanguageModelV4({doGenerate:[call('registrar_estudo',Object.fromEntries(Object.entries(input).filter(([key])=>key!=='type'))),()=>{throw new Error('Provider unavailable');}]});
 await assert.rejects(runLia({state,message:'Registre.',actions:true,web:false,modelOverride:model,signal:AbortSignal.timeout(5000)}));assert.deepEqual(state,original);
});
test('separate mission and agenda tools write to the intended screens',async()=>{
 const state=plannerState();
 const mission=new MockLanguageModelV4({doGenerate:[call('salvar_missao',{subjectId:'portugues',title:'Estudar texto',minutes:5,date:todayKey()}),done]});
 const planned=await runLia({state,message:'Crie uma missão de estudo.',actions:true,web:false,modelOverride:mission,signal:AbortSignal.timeout(5000)});
 assert.equal(planned.state.tasks.length,1);assert.equal(planned.state.planner.events.length,0);assert.equal(planned.receipts[0].type,'task');
 const agenda=new MockLanguageModelV4({doGenerate:[call('salvar_compromisso',{title:'Mentoria',date:todayKey(),kind:'mentoring'}),done]});
 const event=await runLia({state,message:'Agende uma mentoria.',actions:true,web:false,modelOverride:agenda,signal:AbortSignal.timeout(5000)});
 assert.equal(event.state.tasks.length,0);assert.equal(event.state.planner.events.length,1);assert.equal(event.receipts[0].type,'event');
});
