import { z } from "zod";

export const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Data inválida.");
const key = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(200);
export const plannerRefSchema = z.object({ weekId: key, cycleId: key, blockId: key }).strict();
export type PlannerRef = z.infer<typeof plannerRefSchema>;
export const plannerBlockSchema = z.object({
  id: key, subjectId: key, subjectName: text, title: text,
  topics: z.array(z.string().min(1).max(500)).min(1).max(40),
  minutes: z.number().int().min(15).max(600).multipleOf(5),
  family: z.enum(["language", "it", "law", "math", "reasoning"]),
}).strict();
export const plannerEventSchema = z.object({
  id: key, title: text, date: civilDate, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  kind: z.enum(["mentoring", "mock", "essay", "review", "personal"]),
  plannedMinutes: z.number().int().min(5).max(480).multipleOf(5).optional(),
  completed: z.boolean().default(false), notes: z.string().max(3000).default(""),
  result: z.object({ questions: z.number().int().min(0).max(1000), correct: z.number().int().min(0).max(1000), minutes: z.number().int().min(0).max(720), score: z.number().min(0).max(100).optional() }).strict().refine(r => r.correct <= r.questions).optional(),
}).strict();
export const plannerSchema = z.object({
  title: text, source: text, sourceVersion: z.string().max(80), sourceUpdatedAt: civilDate,
  checkedAt: civilDate, examDate: civilDate, examDateConfirmed: z.boolean().default(false),
  variant: z.enum(["standard", "flex", "speed", "hard", "emergency", "super-emergency"]),
  mode: z.enum(["standard", "essential"]), cycleStart: civilDate,
  cycles: z.array(z.object({ id: key, number: z.number().int().min(1).max(30), title: text, essayReference: z.string().max(200).optional(), blocks: z.array(plannerBlockSchema).min(1).max(30) }).strict()).min(1).max(30),
  events: z.array(plannerEventSchema).max(300),
  completedSteps: z.array(z.string().min(1).max(300)).max(12000).default([]),
  completedWeeks: z.array(key).max(150).default([]),
  overrides: z.array(z.object({ weekId: key, start: civilDate, notes: z.string().max(1000) }).strict()).max(150).default([]),
}).strict().superRefine((p, ctx) => {
  const unique = (ids: string[], path: string) => { if (new Set(ids).size !== ids.length) ctx.addIssue({code:"custom",path:[path],message:"Identificadores repetidos."}); };
  unique(p.cycles.map(c=>c.id), "cycles"); unique(p.cycles.map(c=>String(c.number)), "cycles");
  unique(p.cycles.flatMap(c=>c.blocks.map(b=>b.id)), "cycles"); unique(p.events.map(e=>e.id), "events");
  unique(p.overrides.map(o=>o.weekId), "overrides"); unique(p.completedSteps, "completedSteps"); unique(p.completedWeeks, "completedWeeks");
});
export type StudyPlanner = z.infer<typeof plannerSchema>;
export type PlannerBlock = z.infer<typeof plannerBlockSchema>;
export type PlannerEvent = z.infer<typeof plannerEventSchema>;
