import { createHash } from "node:crypto";

export interface JsonNormalizationMeta {
  had_utf8_bom: boolean;
  raw_sha256: string;
  normalized_sha256: string;
}

export function parseJsonTextWithBomSupport<T>(raw: string, label: string): { value: T; meta: JsonNormalizationMeta } {
  const normalized = normalizeJsonText(raw);
  try {
    return {
      value: JSON.parse(normalized.text) as T,
      meta: normalized.meta,
    };
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeJsonText(raw: string): { text: string; meta: JsonNormalizationMeta } {
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

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}