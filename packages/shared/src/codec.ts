import type { z } from "zod";

import { RequestId } from "./schemas/primitives.ts";

export type DecodeResult<T> =
  { ok: true; value: T } | { ok: false; error: string; requestId: RequestId | undefined };

/**
 * Parses a JSON message and validates it against a schema. On failure, still tries to recover
 * the `requestId` so that the error response can be matched to its request.
 */
export function decodeMessage<T>(schema: z.ZodType<T>, raw: string): DecodeResult<T> {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON", requestId: undefined };
  }

  const result = schema.safeParse(json);

  if (result.success) {
    return { ok: true, value: result.data };
  }

  // Reads one field of an unknown object; `RequestId.safeParse` validates it below.
  const candidate =
    typeof json === "object" && json !== null
      ? (json as { requestId?: unknown }).requestId
      : undefined;

  const requestId = RequestId.safeParse(candidate);

  return {
    ok: false,
    error: result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; "),
    requestId: requestId.success ? requestId.data : undefined,
  };
}

export function encodeMessage(message: unknown): string {
  return JSON.stringify(message);
}
