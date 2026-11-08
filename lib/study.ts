import { z } from "zod";
import { plannerSchema, plannerRefSchema, type StudyPlanner, type PlannerRef } from "./planner-schema.ts";
import { reconcileReviews } from "./reviews.ts";
import { achievementsFor } from "./achievements.ts";
import { assistantMessageSchema, type AssistantMessage } from "./assistant-schema.ts";

export type Subject = { id: string; name: string; color: string; short: string; topics: string[]; source?: string };
export type StudyTask = { id: string; subjectId: string; title: string; minutes: number; date: string; done: boolean; recordedMinutes?: number; plannerRef?: PlannerRef };
export type StudyNote = { id: string; subjectId: string; title: string; content: string; updatedAt: string };
export type StudyError = { id: string; subjectId: string; question: string; answer: string; reason: string; createdAt: string; resolved: boolean };
export type Review = { id: string; subjectId: string; title: string; dueDate: string; interval: number; completed?: boolean; calendar?: { cycleIds: string[]; sourceDate: string; afterDate?: string; weekId?: string; endDate?: string; label?: string } };
export type StudySession = { id: string; subjectId: string; topic: string; minutes: number; questions: number; correct: number; date: string; plannerRef?: PlannerRef; pomodoros?: number };
export type StudyState = {
  profile: { name: string; goal: string; dailyMinutes: number; weeklyMinutes: number; examDate: string };
  subjects: Subject[]; tasks: StudyTask[]; notes: StudyNote[]; errors: StudyError[];
  reviews: Review[]; sessions: StudySession[]; completedTopics: string[]; planner?: StudyPlanner;
  reviewCompletions?: { id: string; reviewId: string; date: string; weekId?: string }[];
  achievements?: { id: string; date: string }[];
  assistantMessages?: AssistantMessage[];
};

export const STUDY_TIMEZONE = "America/Recife";
const DAY_MS = 86_400_000;

/** Civil dates use the student's timezone, independently of the Worker clock. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  if (!isCivilDate(date) || !Number.isInteger(days)) throw new Error("Data ou intervalo inválido.");
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function topicKey(subjectId: string, index: number): string { return `${subjectId}:${index}`; }

const id = z.string().min(1).max(100);
const date = z.string().refine(isCivilDate, "Informe uma data válida no formato AAAA-MM-DD.");
const timestamp = z.string().min(10).max(40).refine((v) => isCivilDate(v) || (!Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v)), "Data inválida.");
const title = z.string().trim().min(1).max(200);
const subjectSchema = z.object({
  id, name: z.string().trim().min(1).max(120), color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/), short: z.string().min(1).max(12),
  topics: z.array(z.string().trim().min(1).max(500)).min(1).max(1000).refine((topics) => topics.join("\n").length <= 15000, "O conteúdo da disciplina deve ter até 15.000 caracteres."),
  source: z.string().url().max(1500).refine((v) => /^https?:\/\//i.test(v), "Use um link HTTP ou HTTPS.").optional(),
}).strict();

export const studyStateSchema = z.object({
  profile: z.object({ name: z.string().trim().min(1).max(80), goal: z.string().trim().min(1).max(120), dailyMinutes: z.number().int().min(10).max(720), weeklyMinutes: z.number().int().min(10).max(5040), examDate: z.union([date, z.literal("")]) }).strict(),
  planner: plannerSchema.optional(),
  subjects: z.array(subjectSchema).min(1).max(60),
  tasks: z.array(z.object({ id, subjectId: id, title, minutes: z.number().int().min(5).max(480).multipleOf(5), date, done: z.boolean(), recordedMinutes: z.number().int().min(0).max(100000).optional(), plannerRef: plannerRefSchema.optional() }).strict()).max(1000),
  notes: z.array(z.object({ id, subjectId: id, title, content: z.string().trim().min(1).max(15000), updatedAt: timestamp }).strict()).max(500),
  errors: z.array(z.object({ id, subjectId: id, question: z.string().trim().min(1).max(3000), answer: z.string().trim().min(1).max(6000), reason: z.string().trim().min(1).max(1000), createdAt: timestamp, resolved: z.boolean() }).strict()).max(1000),
  reviews: z.array(z.object({ id, subjectId: id, title, dueDate: date, interval: z.number().int().min(1).max(365), completed: z.boolean().optional(), calendar: z.object({ cycleIds: z.array(id).max(30), sourceDate: date, afterDate: date.optional(), weekId: id.optional(), endDate: date.optional(), label: title.optional() }).strict().optional() }).strict()).max(1000),
  sessions: z.array(z.object({ id, subjectId: id, topic: title, minutes: z.number().int().min(1).max(720), questions: z.number().int().min(0).max(1000), correct: z.number().int().min(0).max(1000), date, plannerRef: plannerRefSchema.optional(), pomodoros: z.number().int().min(0).max(144).optional() }).strict().refine((s) => s.correct <= s.questions && (s.pomodoros || 0) <= s.minutes, "Confira os acertos e o tempo dos Pomodoros.")).max(5000),
  completedTopics: z.array(z.string().min(1).max(110)).max(60000),
  reviewCompletions: z.array(z.object({ id: z.string().min(1).max(220), reviewId: id, date, weekId: id.optional() }).strict()).max(5000).optional(),
  achievements: z.array(z.object({ id, date }).strict()).max(100).optional(),
  assistantMessages: z.array(assistantMessageSchema).max(40).optional(),
}).strict().superRefine((state, ctx) => {
  const subjects = new Map(state.subjects.map((s) => [s.id, s]));
  if (subjects.size !== state.subjects.length) ctx.addIssue({ code: "custom", path: ["subjects"], message: "Matérias com identificador repetido." });
  for (const collection of ["tasks", "notes", "errors", "reviews", "sessions"] as const) {
    const ids = new Set<string>();
    state[collection].forEach((item, i) => {
      if (!subjects.has(item.subjectId)) ctx.addIssue({ code: "custom", path: [collection, i, "subjectId"], message: "Matéria inexistente." });
      if (ids.has(item.id)) ctx.addIssue({ code: "custom", path: [collection, i, "id"], message: "Identificador repetido." });
      ids.add(item.id);
    });
  }
  for (const collection of ["reviewCompletions", "achievements"] as const) {
    const ids = (state[collection] || []).map(item => item.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: [collection], message: "Identificadores repetidos." });
  }
  for (const cycle of state.planner?.cycles || []) for (const block of cycle.blocks) {
    if (!subjects.has(block.subjectId)) ctx.addIssue({code:"custom",path:["planner","cycles"],message:"O bloco aponta para uma disciplina inexistente."});
  }
  const topicKeys = new Set(state.subjects.flatMap((s) => s.topics.map((_, i) => topicKey(s.id, i))));
  if (new Set(state.completedTopics).size !== state.completedTopics.length || state.completedTopics.some((key) => !topicKeys.has(key))) {
    ctx.addIssue({ code: "custom", path: ["completedTopics"], message: "Tópicos inválidos ou repetidos." });
  }
});

const coreSubjects: Subject[] = [
  { id: "portugues", name: "Língua Portuguesa", color: "#8b5cf6", short: "LP", topics: ["Interpretação de textos", "Classes de palavras", "Sintaxe e concordância", "Regência e crase", "Pontuação", "Redação oficial"] },
  { id: "constitucional", name: "Direito Constitucional", color: "#5778dd", short: "DC", topics: ["Princípios fundamentais", "Direitos e garantias fundamentais", "Organização do Estado", "Administração pública", "Poder Judiciário", "Controle de constitucionalidade"] },
  { id: "administrativo", name: "Direito Administrativo", color: "#edaa43", short: "DA", topics: ["Princípios administrativos", "Atos administrativos", "Poderes da Administração", "Agentes públicos", "Licitações e contratos", "Responsabilidade civil do Estado", "Improbidade administrativa"] },
  { id: "civil", name: "Direito Civil", color: "#dc79a4", short: "CV", topics: ["Pessoas naturais e jurídicas", "Fatos e negócios jurídicos", "Prescrição e decadência", "Obrigações", "Contratos", "Responsabilidade civil"] },
  { id: "processual-civil", name: "Direito Processual Civil", color: "#46aaa4", short: "PC", topics: ["Princípios e normas processuais", "Jurisdição e competência", "Sujeitos do processo", "Atos e prazos processuais", "Procedimento comum", "Recursos", "Cumprimento de sentença e execução"] },
  { id: "penal", name: "Direito Penal", color: "#db7a67", short: "DP", topics: ["Aplicação da lei penal", "Teoria do crime", "Concurso de pessoas", "Penas", "Crimes contra a Administração Pública"] },
  { id: "processual-penal", name: "Direito Processual Penal", color: "#8d7ac3", short: "PP", topics: ["Inquérito policial", "Ação penal", "Competência", "Provas", "Prisões e medidas cautelares", "Procedimentos e recursos"] },
  { id: "informatica", name: "Informática", color: "#64a9d4", short: "IN", topics: ["Sistemas operacionais", "Editores de texto e planilhas", "Internet e redes", "Segurança da informação", "Computação em nuvem"] },
  { id: "raciocinio", name: "Raciocínio Lógico", color: "#79a95a", short: "RL", topics: ["Lógica proposicional", "Argumentação lógica", "Conjuntos", "Análise combinatória e probabilidade", "Porcentagem e proporcionalidade"] },
  { id: "legislacao", name: "Legislação Especial", color: "#b69362", short: "LE", topics: ["Lei nº 8.112/1990", "Lei nº 11.416/2006", "Lei Brasileira de Inclusão", "Ética no serviço público", "Regimento interno do tribunal"] },
  { id: "trabalho", name: "Direito do Trabalho", color: "#bc88b1", short: "DT", topics: ["Relação de trabalho e de emprego", "Contrato de trabalho", "Jornada e descanso", "Remuneração", "Extinção do contrato"] },
  { id: "processual-trabalho", name: "Direito Processual do Trabalho", color: "#628ca8", short: "PT", topics: ["Organização da Justiça do Trabalho", "Competência", "Atos e prazos", "Dissídios individuais", "Recursos e execução trabalhista"] },
];

/** The shared syllabus is a starting trail, never represented as a specific notice. */
export function createInitialState(demo = true): StudyState {
  const today = todayKey();
  const subjects = coreSubjects.map((s) => ({ ...s, topics: [...s.topics] }));
  const state: StudyState = {
    profile: { name: "Sofia", goal: "Minha aprovação no Judiciário", dailyMinutes: 120, weeklyMinutes: 600, examDate: "" },
    subjects, tasks: [], notes: [], errors: [], reviews: [], sessions: [], completedTopics: [],
  };
  if (!demo) return state;
  state.tasks = [
    { id: "task-1", subjectId: "constitucional", title: "Direitos e garantias fundamentais", minutes: 40, date: today, done: false },
    { id: "task-2", subjectId: "portugues", title: "Interpretação de textos", minutes: 30, date: today, done: false },
    { id: "task-3", subjectId: "administrativo", title: "Atos administrativos", minutes: 35, date: today, done: false },
    { id: "task-4", subjectId: "processual-civil", title: "Atos e prazos processuais", minutes: 30, date: addDays(today, 1), done: false },
  ];
  state.notes = [
    { id: "note-1", subjectId: "constitucional", title: "Meu mapa de direitos fundamentais", content: "Revisar as diferenças entre direitos individuais e coletivos. Criar exemplos e conferir o texto do edital antes de aprofundar cada assunto.", updatedAt: today },
    { id: "note-2", subjectId: "portugues", title: "Estratégia para interpretação", content: "Ler o enunciado com atenção, identificar a ideia central e justificar cada alternativa com um trecho do texto.", updatedAt: addDays(today, -1) },
  ];
  state.errors = [
    { id: "error-1", subjectId: "administrativo", question: "Como diferenciar anulação e revogação de um ato administrativo?", answer: "Conferir a distinção na legislação e no material de referência antes de responder novamente.", reason: "Confundi os fundamentos. Preciso de um quadro comparativo.", createdAt: addDays(today, -1), resolved: false },
  ];
  state.reviews = [
    { id: "review-1", subjectId: "constitucional", title: "Princípios fundamentais", dueDate: today, interval: 1 },
    { id: "review-2", subjectId: "administrativo", title: "Princípios administrativos", dueDate: today, interval: 3 },
    { id: "review-3", subjectId: "portugues", title: "Sintaxe e concordância", dueDate: addDays(today, 1), interval: 7 },
  ];
  state.sessions = Array.from({ length: 7 }, (_, i) => ({
    id: `session-${i}`, subjectId: ["constitucional", "portugues", "administrativo", "processual-civil"][i % 4],
    topic: ["Princípios fundamentais", "Interpretação de textos", "Atos administrativos", "Atos e prazos processuais"][i % 4],
    minutes: [35, 50, 45, 60, 40, 30, 25][i], questions: 20, correct: [17, 16, 18, 15, 16, 19, 17][i], date: addDays(today, -i),
  }));
  state.completedTopics = [topicKey("constitucional", 0), topicKey("portugues", 0), topicKey("administrativo", 0), topicKey("administrativo", 1), topicKey("processual-civil", 0)];
  return state;
}

export function calculateStats(state: StudyState, referenceDay = todayKey()) {
  const validSessions = state.sessions.filter((s) => s.date <= referenceDay && isCivilDate(s.date) && Number.isInteger(s.minutes) && s.minutes >= 1 && s.minutes <= 720 && Number.isInteger(s.questions) && s.questions >= 0 && s.questions <= 1000 && Number.isInteger(s.correct) && s.correct >= 0 && s.correct <= s.questions);
  const totalMinutes = validSessions.reduce((sum, s) => sum + s.minutes, 0);
  const totalQuestions = validSessions.reduce((sum, s) => sum + s.questions, 0);
  const correct = validSessions.reduce((sum, s) => sum + s.correct, 0);
  const weekday = new Date(`${referenceDay}T12:00:00.000Z`).getUTCDay();
  const monday = addDays(referenceDay, -((weekday + 6) % 7));
  const weekMinutes = validSessions.filter((s) => s.date >= monday).reduce((sum, s) => sum + s.minutes, 0);
  const knownTopics = new Set(state.subjects.flatMap((s) => s.topics.map((_, i) => topicKey(s.id, i))));
  const completedTopics = new Set(state.completedTopics.filter((key) => knownTopics.has(key))).size;
  const baseXp = totalMinutes * 2 + correct * 3 + completedTopics * 25;
  const activeDays = new Set(validSessions.filter((s) => s.minutes > 0).map((s) => s.date));
  let day = activeDays.has(referenceDay) ? referenceDay : addDays(referenceDay, -1);
  let streak = 0;
  while (activeDays.has(day)) { streak += 1; day = addDays(day, -1); }
  let bestStreak = 0, run = 0, previous = "";
  for (const date of [...activeDays].sort()) { run = previous && addDays(previous, 1) === date ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); previous = date; }
  const metrics = { totalMinutes, totalQuestions, correct, completedTopics, bestStreak, validSessions };
  const achievements = achievementsFor(state, metrics, referenceDay);
  const achievementXp = achievements.filter(a => a.unlocked).reduce((n,a) => n + a.xp, 0);
  const xp = baseXp + achievementXp;
  return { totalMinutes, accuracy: totalQuestions ? Math.round(correct / totalQuestions * 100) : 0, totalQuestions, xp, baseXp, achievementXp, achievements, level: Math.floor(xp / 500) + 1, streak, bestStreak, weekMinutes, completedTopics, totalTopics: knownTopics.size };
}

/** Keep earned medals even if a checklist is edited or a streak ends. */
export function reconcileStudyState(state: StudyState, referenceDay = todayKey()): StudyState {
  const next = reconcileReviews(state, referenceDay);
  const earned = new Map((next.achievements || []).map(a => [a.id, a]));
  for (const a of calculateStats(next, referenceDay).achievements) if (a.unlocked && !earned.has(a.id)) earned.set(a.id, { id: a.id, date: referenceDay });
  return { ...next, achievements: [...earned.values()] };
}

/** Each outcome schedules from today so an overdue card cannot stay overdue. */
export function scheduleReview(review: Review, rating: "again" | "good" | "easy", referenceDay = todayKey()): Review {
  const interval = rating === "again" ? 1 : rating === "easy" ? Math.min(365, Math.max(7, review.interval * 3)) : Math.min(365, Math.max(3, review.interval * 2));
  return { ...review, interval, dueDate: addDays(referenceDay, interval) };
}

export function completeStudy(state: StudyState, input: { subjectId: string; topic: string; minutes: number; questions: number; correct: number; plannerRef?: PlannerRef; pomodoros?: number }): StudyState {
  const subject = state.subjects.find((s) => s.id === input.subjectId);
  if (!subject || !input.topic.trim() || input.topic.length > 200 || !Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 720 || !Number.isInteger(input.questions) || input.questions < 0 || input.questions > 1000 || !Number.isInteger(input.correct) || input.correct < 0 || input.correct > input.questions || (input.pomodoros !== undefined && (!Number.isInteger(input.pomodoros) || input.pomodoros < 0 || input.pomodoros > Math.min(144,input.minutes)))) {
    throw new Error("Confira a matéria, o tempo e a quantidade de questões e acertos.");
  }
  const today = todayKey();
  const session: StudySession = { ...input, topic: input.topic.trim(), id: crypto.randomUUID(), date: today };
  const existingReview = state.reviews.find((r) => r.subjectId === input.subjectId && r.title === session.topic);
  const reviews = existingReview
    ? state.reviews.map((review) => review.id === existingReview.id ? state.planner ? review : { ...review, dueDate: addDays(today, 1), interval: 1 } : review)
    : [...state.reviews, { id: crypto.randomUUID(), subjectId: input.subjectId, title: session.topic, dueDate: addDays(today, 1), interval: 1, ...(state.planner ? {calendar:{cycleIds:input.plannerRef ? [input.plannerRef.cycleId] : [],sourceDate:today}} : {}) }];
  return reconcileStudyState({ ...state, sessions: [...state.sessions, session], reviews });
}
