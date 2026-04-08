import { z } from "zod";

/**
 * Input schema for the devteam_setup tool.
 * This is the VPRND-owned setup / initialization route.
 */
export const SetupInput = z.object({
  repo_root: z
    .string()
    .min(1, "repo_root must be a non-empty path"),
  implementation_lanes_root: z
    .string()
    .min(1, "implementation_lanes_root must be a non-empty path"),
});
export type SetupInput = z.infer<typeof SetupInput>;

/**
 * Output schema for the devteam_setup tool.
 */
export const SetupOutput = z.object({
  success: z.boolean(),
  department: z.literal("dev_team"),
  governance_owner: z.literal("VPRND"),
  bootstrap_phase: z.string(),
  settings_installed: z.object({
    repo_root: z.string(),
    implementation_lanes_root: z.string(),
  }),
  teams_registered: z.number(),
  message: z.string(),
});
export type SetupOutput = z.infer<typeof SetupOutput>;
