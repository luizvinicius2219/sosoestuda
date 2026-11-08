import { z } from "zod";

const key=z.string().min(1).max(100);
export const assistantSourceSchema=z.object({title:z.string().max(300),url:z.string().url().max(2000).refine(v=>/^https?:\/\//i.test(v))}).strict();
export const assistantActionReceiptSchema=z.object({type:z.string().max(50),id:key,title:z.string().max(200)}).strict();
export const assistantMessageSchema=z.object({
  id:key,requestId:z.string().uuid(),role:z.enum(["user","assistant"]),content:z.string().min(1).max(8000),
  createdAt:z.string().datetime(),sources:z.array(assistantSourceSchema).max(12).optional(),
  searchHtml:z.string().max(40000).optional(),actions:z.array(assistantActionReceiptSchema).max(20).optional(),
}).strict();
export type AssistantMessage=z.infer<typeof assistantMessageSchema>;
export type AssistantSource=z.infer<typeof assistantSourceSchema>;
export type AssistantActionReceipt=z.infer<typeof assistantActionReceiptSchema>;
export const assistantRequestSchema=z.object({requestId:z.string().uuid(),message:z.string().trim().min(1).max(3000),version:z.number().int().min(0),web:z.boolean().default(true),actions:z.boolean().default(true)}).strict();
