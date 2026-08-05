import { z } from "zod";

/** Day of week: 0 = Sunday … 6 = Saturday (JS Date.getDay). */
export const dayOfWeekSchema = z.number().int().min(0).max(6);

export const parsedSubjectSchema = z.object({
  name: z.string().min(1),
  shortCode: z.string().min(1).max(16),
  color: z.string().optional(),
  /** Portal / faculty name when visible on the timetable. */
  faculty: z.string().optional(),
  /** Model self-reported confidence 0–1 (optional; preview may estimate). */
  confidence: z.number().min(0).max(1).optional(),
});

export const parsedSlotSchema = z.object({
  subjectShortCode: z.string().min(1),
  dayOfWeek: dayOfWeekSchema,
  start: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm"),
  /** Room / venue from grid or portal screenshot. */
  location: z.string().optional(),
  /** Faculty / instructor when shown on the cell or portal. */
  faculty: z.string().optional(),
  /** Model self-reported confidence 0–1 (optional; preview may estimate). */
  confidence: z.number().min(0).max(1).optional(),
});

export const parseTimetableResultSchema = z.object({
  subjects: z.array(parsedSubjectSchema).min(1),
  slots: z.array(parsedSlotSchema),
  notes: z.string().optional(),
});

export type ParsedSubject = z.infer<typeof parsedSubjectSchema>;
export type ParsedSlot = z.infer<typeof parsedSlotSchema>;
export type ParseTimetableResult = z.infer<typeof parseTimetableResultSchema>;

/** Client-computed attendance stats — coach must treat these as ground truth. */
export const coachStatsSchema = z.record(z.string(), z.unknown());

export const coachModeSchema = z.enum(["chat", "digest", "plan"]);

export const coachPlanItemSchema = z.object({
  shortCode: z.string().min(1),
  reason: z.string().min(1),
});

/** Structured week plan — only cite figures that appear in stats. */
export const coachPlanSchema = z.object({
  weekFocus: z.string().optional(),
  protect: z.array(coachPlanItemSchema).default([]),
  canRelax: z.array(coachPlanItemSchema).optional(),
  actions: z.array(z.string()).optional(),
});

export const coachRequestSchema = z.object({
  stats: coachStatsSchema,
  message: z.string().min(1).max(4000),
  /** chat (default) | weekly digest | structured JSON plan */
  mode: coachModeSchema.optional().default("chat"),
  /** Short spoken-style answers (default on). */
  voiceStyle: z.boolean().optional().default(true),
  /**
   * Optional policy / college-rule research via groq/compound.
   * OFF by default — never used for % math.
   */
  policyResearch: z.boolean().optional().default(false),
  /** Which app screen the user is on — soft focus only; stats still win. */
  pageContext: z.string().max(2000).optional(),
  /**
   * When true (Agent Control), model may return structured Dexie actions.
   * Client executes — never invent attendance %.
   */
  allowActions: z.boolean().optional().default(false),
});

export const coachResponseSchema = z.object({
  reply: z.string().min(1),
  mode: coachModeSchema.optional(),
  plan: coachPlanSchema.optional(),
  /** True when groq/compound was used for policy research only. */
  usedPolicyResearch: z.boolean().optional(),
  /** Optional structured actions for client-side Dexie execution. */
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
  message: z.string().optional(),
  chips: z.array(z.string()).optional(),
});

export type CoachMode = z.infer<typeof coachModeSchema>;
export type CoachPlan = z.infer<typeof coachPlanSchema>;
export type CoachRequest = z.infer<typeof coachRequestSchema>;
export type CoachResponse = z.infer<typeof coachResponseSchema>;

export const aiStatusSchema = z.object({
  groqConfigured: z.boolean(),
  geminiConfigured: z.boolean(),
  /** True when at least one AI path can run. */
  anyAiConfigured: z.boolean(),
  setupHint: z.string().optional(),
});

export type AiStatus = z.infer<typeof aiStatusSchema>;

/** Import apply mode after preview confirm. */
export const importApplyModeSchema = z.enum(["diff", "replace"]);
export type ImportApplyMode = z.infer<typeof importApplyModeSchema>;
