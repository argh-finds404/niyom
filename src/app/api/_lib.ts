// Shared helpers for the Route Handlers. Server-only: imports the pure engine, schemas and server ledger.
import type { ZodType } from "zod";
import type { RequirementChange } from "@/domain/types";
import { StoreUnavailableError, getNoticeFor } from "@/data/persistence/server-db";

export { compareNoticeVersions } from "@/domain/comparison/compare";
export { calculateNoticeReadiness } from "@/domain/readiness/calculate";

export const isConsequentialChange = (c: RequirementChange) => c.type !== "unchanged" && c.impact !== "informational";

/** A dossier, with the active version this device follows when a device is given. */
export function findNotice(id: string, deviceId?: string) {
  return getNoticeFor(id, deviceId);
}

export function problem(status: number, title: string, extra?: Record<string, unknown>, headers?: HeadersInit) {
  return Response.json({ error: title, status, ...extra }, { status, headers });
}

/* ───────────── Every handler ───────────── */

/**
 * Wraps a Route Handler so every answer is JSON and traceable:
 * - a ledger outage becomes 503 with Retry-After (clients keep the change and retry);
 * - any other failure becomes 500, logged with a request id that is also returned to the caller;
 * - responses are `no-store` unless the handler says otherwise (they depend on the device cookie).
 */
export function route<A extends unknown[]>(handler: (request: Request, ...rest: A) => Promise<Response>) {
  return async (request: Request, ...rest: A): Promise<Response> => {
    // Reading the request first keeps every API answer dynamic (never prerendered at build).
    void request.headers;
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      response = await handler(request, ...rest);
    } catch (error) {
      const where = `${request.method} ${new URL(request.url).pathname}`;
      if (error instanceof StoreUnavailableError) {
        console.error(`[niyom] ${where} (${requestId}): ledger unavailable`, error.cause);
        response = problem(
          503,
          "The ledger is temporarily unavailable. Changes are kept on your device and sent again shortly.",
          { requestId },
          { "Retry-After": "5" }
        );
      } else {
        console.error(`[niyom] ${where} (${requestId}): unexpected error`, error);
        response = problem(500, "Something went wrong on the server.", { requestId });
      }
    }
    if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Request-Id", requestId);
    return response;
  };
}

/* ───────────── Anonymous device identity ───────────── */

const DEVICE_COOKIE = "niyom_device";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Device {
  id: string;
  isNew: boolean;
  secure: boolean;
}

/**
 * Who is asking, without accounts: an id the server issues in an HttpOnly cookie on first contact.
 * It scopes private state (profile, checks) and makes corroboration one-per-device.
 */
export function readDevice(request: Request): Device {
  const cookie = request.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|;\\s*)${DEVICE_COOKIE}=([^;]+)`).exec(cookie);
  const secure = request.url.startsWith("https:") || request.headers.get("x-forwarded-proto") === "https";
  if (match && UUID.test(match[1])) return { id: match[1].toLowerCase(), isNew: false, secure };
  return { id: crypto.randomUUID(), isNew: true, secure };
}

/** Attaches the device cookie to a response when the device was just created. */
export function withDevice(response: Response, device: Device): Response {
  if (device.isNew) {
    response.headers.append(
      "Set-Cookie",
      `${DEVICE_COOKIE}=${device.id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${device.secure ? "; Secure" : ""}`
    );
  }
  return response;
}

/** The caller's IP as the host's proxy reports it (Vercel overwrites x-forwarded-for, so it cannot be spoofed there). */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/* ───────────── Request bodies ───────────── */

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Reads and validates a JSON body in one step: 413 when it is too large, 400 with field-level
 * issues when it is malformed or fails the schema.
 */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<{ data: T } | { response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { response: problem(413, `Request body must be under ${MAX_BODY_BYTES / 1024} KB.`) };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { response: problem(400, "Could not read the request body.") };
  }
  if (text.length > MAX_BODY_BYTES) return { response: problem(413, `Request body must be under ${MAX_BODY_BYTES / 1024} KB.`) };
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    return { response: problem(400, "Request body is not valid JSON.") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      response: problem(400, "Request failed validation.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      }),
    };
  }
  return { data: parsed.data };
}

/* ───────────── Rate limiting ───────────── */

const hits = new Map<string, number[]>();

/**
 * Sliding-window limit per key. Returns a 429 response when exceeded.
 * shortcut: in-process memory, so each server instance counts on its own; move to a shared
 * store (Redis) if abuse ever matters more than a few extra requests.
 */
export function rateLimit(key: string, limit: number, windowMs: number): Response | null {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    const retry = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    return problem(429, "Too many requests. Please wait before trying again.", { retryAfterSeconds: retry }, { "Retry-After": String(retry) });
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 50_000) hits.clear(); // bound memory under abuse
  return null;
}

export const MINUTE = 60_000;

/**
 * Limits an action per device and per IP. The IP limit is looser (campus networks and mobile
 * carriers put many people behind one address) and stops a client that drops its cookie to
 * become a "new device" on every request.
 */
export function limitAction(request: Request, device: Device, action: string, perDevice: number, perIp: number, windowMs: number) {
  return rateLimit(`${action}:device:${device.id}`, perDevice, windowMs) ?? rateLimit(`${action}:ip:${clientIp(request)}`, perIp, windowMs);
}

/** Writes to a device's own state: generous, since the client already coalesces changes. */
export const limitStateWrite = (request: Request, device: Device) => limitAction(request, device, "state", 120, 600, MINUTE);

/** Test-only: clear rate-limit windows. */
export function __resetRateLimitsForTests() {
  hits.clear();
}
