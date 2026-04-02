import { z } from "zod";

export const WorkflowName = z.enum([
  "direct_coo_response",
  "clarification",
  "pushback",
  "memory_operation",
  "requirements_gathering_onion",
]);

export type WorkflowName = z.infer<typeof WorkflowName>;
