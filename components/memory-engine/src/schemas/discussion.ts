import { z } from "zod";

export const DiscussionAppendInput = z.object({
  scope: z.string(),
  topic: z.string(),
  content: z.string(),
  speaker: z.string().default("ceo"),
  discussion_mode: z.enum(["open", "structured", "decision"]).default("open"),
});
export type DiscussionAppendInput = z.infer<typeof DiscussionAppendInput>;

export const DiscussionListInput = z.object({
  scope: z.string(),
  status: z.enum(["open", "closed", "superseded"]).optional(),
});
export type DiscussionListInput = z.infer<typeof DiscussionListInput>;

export const DiscussionGetInput = z.object({
  scope: z.string(),
  topic: z.string(),
  page_size: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type DiscussionGetInput = z.infer<typeof DiscussionGetInput>;

export const DiscussionCloseInput = z.object({
  scope: z.string(),
  topic: z.string(),
  reason: z.string().optional(),
  superseded_by: z.string().optional(),
});
export type DiscussionCloseInput = z.infer<typeof DiscussionCloseInput>;
