import "server-only";

import { randomBytes } from "node:crypto";
import { sanitizeDoc } from "./validate";
import type { BuilderDoc } from "./types";

/**
 * Builder live-preview sessions. The editor mints a short-lived 256-bit
 * token bound to the current DRAFT; the public renderer only honors it when
 * it exists in this server-side map (admin-only by construction). Customers
 * can never see an unpublished draft: an unknown/expired token renders the
 * published storefront. No cookies, no client state, no leakage.
 */

type Session = { doc: BuilderDoc; expires: number };

const sessions = new Map<string, Session>();
const TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 50;

export function mintBuilderPreviewToken(doc: unknown): string {
  if (sessions.size > MAX_SESSIONS) sessions.clear();
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { doc: sanitizeDoc(doc), expires: Date.now() + TTL_MS });
  return token;
}

export function getBuilderPreviewDoc(token: string | undefined): BuilderDoc | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s.doc;
}

export const BUILDER_PREVIEW_PARAM = "rd_bd";
