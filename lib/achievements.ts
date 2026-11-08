import type { StudySession, StudyState } from "./study.ts";

type Metrics = { totalMinutes:number; totalQuestions:number; correct:number; completedTopics:number; bestStreak:number; validSessions:StudySession[] };
export type Achievement = { id:string; icon:string; title:string; description:string; xp:number; value:number; target:number; unlocked:boolean; category:string };
export function levelTitle(level:number) {
  return level >= 30 ? "Lenda dos estudos" : level >= 20 ? "Mestra da constância" : level >= 10 ? "Estrategista" : level >= 5 ? "Exploradora" : "Aprendiz";
}
export function achievementsFor(state:StudyState, m:Metrics, day:string):Achievement[] {
  const earned = new Set((state.achievements || []).filter(a => a.date <= day).map(a => a.id));
  const reviews = new Set((state.reviewCompletions || []).filter(r => r.date <= day).map(r => r.id)).size;
  const pomodoros = m.validSessions.reduce((n,s) => n + (s.pomodoros || 0),0);
  const subjects = new Set(m.validSessions.map(s => s.subjectId)).size;
  const mockCount = state.planner?.events.filter(e => e.kind === "mock" && e.completed && e.date <= day).length || 0;
  const weeks = new Set(state.planner?.completedWeeks || []).size;
  const definitions: Omit<Achievement,"unlocked">[] = [];
  const add = (id:string,icon:string,title:string,description:string,xp:number,value:number,target:number,category:string) => definitions.push({id,icon,title,description,xp,value,target,category});
  add("first-study","🌱","O primeiro passo","Registre seu primeiro estudo.",50,m.validSessions.length,1,"Foco");
  for (const [target,xp,icon,title] of [[3,100,"🔥","Pegando o ritmo"],[7,250,"🏆","Uma semana de orgulho"],[14,500,"🌟","Duas semanas firmes"],[30,1000,"👑","Constância de ouro"]] as const) add(`streak-${target}`,icon,title,`Alcance ${target} dias seguidos de estudo.`,xp,m.bestStreak,target,"Constância");
  for (const [target,xp] of [[1,75],[10,150],[25,300],[50,500],[100,1000]] as const) add(`hours-${target}`,"⏳",`${target} ${target===1?"hora conquistada":"horas de dedicação"}`,`Acumule ${target} ${target===1?"hora":"horas"} de estudo.`,xp,m.totalMinutes,target*60,"Foco");
  for (const [target,xp] of [[50,75],[100,150],[500,400],[1000,800]] as const) add(`questions-${target}`,"🎯",`${target} questões no caminho`,`Resolva ${target} questões.`,xp,m.totalQuestions,target,"Questões");
  add("accuracy-80","🏹","Mira afiada","Atinja 80% de acertos após resolver pelo menos 50 questões.",200,m.totalQuestions>=50 && m.correct/m.totalQuestions>=.8?1:0,1,"Questões");
  for (const [target,xp] of [[1,75],[10,200],[50,600]] as const) add(`reviews-${target}`,"🔁",target===1?"Reencontro com o saber":`${target} revisões concluídas`,`Conclua ${target} ${target===1?"revisão":"revisões"} do calendário.`,xp,reviews,target,"Revisões");
  for (const [target,xp] of [[1,50],[10,150],[50,500]] as const) add(`pomodoro-${target}`,"🍅",target===1?"Primeiro Pomodoro":`${target} Pomodoros de foco`,`Complete e registre ${target} ${target===1?"bloco":"blocos"} de foco no timer.`,xp,pomodoros,target,"Foco");
  for (const [target,xp] of [[10,150],[30,350],[60,750]] as const) add(`topics-${target}`,"📚",`${target} páginas da sua jornada`,`Conclua ${target} tópicos do edital.`,xp,m.completedTopics,target,"Organização");
  add("notes-5","📝","Ideias bem guardadas","Crie 5 anotações no seu caderno.",100,state.notes.length,5,"Organização");
  add("errors-5","💡","Virando o jogo","Marque 5 erros como aprendidos.",150,state.errors.filter(e=>e.resolved).length,5,"Revisões");
  add("subjects-5","🧭","Conhecimento sem fronteiras","Estude 5 disciplinas diferentes.",150,subjects,5,"Organização");
  for (const [target,xp] of [[1,150],[5,500],[10,1000]] as const) add(`weeks-${target}`,"🗓️",`${target} ${target===1?"semana vencida":"semanas vencidas"}`,`Conclua ${target} ${target===1?"semana":"semanas"} no ciclo.`,xp,weeks,target,"Ciclos");
  add("mock-1","⚔️","Treino para a grande missão","Conclua um simulado do seu calendário.",200,mockCount,1,"Ciclos");
  return definitions.map(a=>({...a,unlocked:earned.has(a.id)||a.value>=a.target}));
}
