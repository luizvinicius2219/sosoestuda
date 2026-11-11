import { z } from "zod";

const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v;
}, "Data inválida.");
export const questionRecordSchema = z.object({
  id: z.string().min(1).max(100), subjectId: z.string().min(1).max(100),
  topic: z.string().trim().min(1).max(500), syllabusTopic: z.string().max(500).optional(),
  date: civilDate, kind: z.enum(["Prova", "Lista de Exercícios", "Questões avulsas", "Lote"]),
  name: z.string().max(200), number: z.string().max(40), platform: z.string().max(200),
  questions: z.number().int().min(1).max(10000), correct: z.number().int().min(0).max(10000),
  guesses: z.number().int().min(0).max(10000), cancelled: z.boolean(),
  confidence: z.enum(["Certeza", "Dúvida", "Chute", "Não informado"]),
  reason: z.string().max(1000), review: z.boolean(), explanation: z.string().max(6000),
  sourceKey: z.string().max(160).optional(),
}).strict().superRefine((q,ctx) => {
  if(q.correct>q.questions || q.guesses>q.questions) ctx.addIssue({code:"custom",message:"Acertos e chutes não podem superar as questões."});
  if(q.kind!=="Lote" && q.questions!==1) ctx.addIssue({code:"custom",message:"O registro individual deve ter uma questão."});
});
export type QuestionRecord = z.infer<typeof questionRecordSchema>;
export const topicProgressSchema = z.object({
  subjectId:z.string().min(1).max(100), topic:z.string().min(1).max(500),
  status:z.enum(["Pendente","Em andamento","Concluído"]),
  reverse:z.boolean(), theory:z.boolean(), law:z.boolean(), lesson:z.boolean(),
  review1:z.boolean(), review2:z.boolean(), review3:z.boolean(),
}).strict();
export type TopicProgress = z.infer<typeof topicProgressSchema>;
export const notebookImportSchema = z.object({
  format:z.literal("soso-questions-v1"), records:z.array(questionRecordSchema).max(5000),
}).strict();
