import { createHash } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export interface JsonIngressMeta {
  had_utf8_bom: boolean;
  raw_sha256: string;
  normalized_sha256: string;
}

export function normalizeJsonText(raw: string): { text: string; meta: JsonIngressMeta } {
  const hadUtf8Bom = raw.charCodeAt(0) === 0xfeff;
  const text = hadUtf8Bom ? raw.slice(1) : raw;
  return {
    text,
    meta: {
      had_utf8_bom: hadUtf8Bom,
      raw_sha256: sha256(raw),
      normalized_sha256: sha256(text),
    },
  };
}

export function stripUtf8Bom(raw: string): string {
  return normalizeJsonText(raw).text;
}

export async function appendIngressAuditEvent(path: string, event: Record<string, unknown>): Promise<void> {
  await mkdir(dirnameOf(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf-8");
}

export async function writeBootstrapIngressIncident(params: {
  toolRunRoot: string;
  requestPath: string;
  stage: string;
  meta: JsonIngressMeta;
  message: string;
}): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}-${basename(params.requestPath)}.json`;
  const incidentPath = join(params.toolRunRoot, "_bootstrap", fileName);
  await mkdir(dirnameOf(incidentPath), { recursive: true });
  await writeFile(incidentPath, JSON.stringify({
    stage: params.stage,
    source_path: params.requestPath.replace(/\\/g, "/"),
    normalization: {
      transform: params.meta.had_utf8_bom ? "strip_utf8_bom" : "none",
      ...params.meta,
    },
    outcome: "blocked",
    message: params.message,
    recorded_at: new Date().toISOString(),
  }, null, 2), "utf-8");
  return incidentPath.replace(/\\/g, "/");
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function dirnameOf(pathValue: string): string {
  return pathValue.replace(/[\\/][^\\/]+$/, "");
}
