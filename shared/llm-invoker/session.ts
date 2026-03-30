import { randomUUID } from "node:crypto";
import type { InvocationSessionHandle, InvocationSessionResult } from "./types.js";

export function extractCodexThreadIdFromJsonOutput(raw: string): string | null {
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as { type?: string; thread_id?: string };
      if (parsed.type === "thread.started" && typeof parsed.thread_id === "string" && parsed.thread_id.length > 0) {
        return parsed.thread_id;
      }
    } catch {
      // Ignore non-JSON lines and continue scanning.
    }
  }
  return null;
}

export function parseClaudePrintJson(raw: string): {
  response: string;
  sessionId: string | null;
} {
  const parsed = JSON.parse(raw) as { result?: unknown; session_id?: unknown };
  return {
    response: typeof parsed.result === "string" ? parsed.result.trim() : "",
    sessionId: typeof parsed.session_id === "string" && parsed.session_id.length > 0 ? parsed.session_id : null,
  };
}

export function createClaudeFreshSessionHandle(model: string): InvocationSessionHandle {
  return {
    provider: "claude",
    model,
    session_id: randomUUID(),
    source: "caller_assigned",
  };
}

export function shouldRetryWithFreshSession(provider: "codex" | "claude" | "gemini", error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (provider === "codex") {
    return /thread\/resume failed: no rollout found for thread id/i.test(message);
  }
  if (provider === "claude") {
    return /No conversation found with session ID/i.test(message);
  }
  return false;
}

export function buildInvocationSessionResult(
  handle: InvocationSessionHandle,
  status: InvocationSessionResult["status"]
): InvocationSessionResult {
  return {
    handle,
    status,
  };
}
