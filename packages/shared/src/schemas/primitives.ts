import { z } from "zod";

/** Money in integer cents. `€$ 12.50` is `1250`. */
export const Cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).brand<"Cents">();
export type Cents = z.infer<typeof Cents>;

/**
 * Unchecked conversion of an integer that is known to be valid money (e.g. the result of
 * integer arithmetic on other `Cents`). Use `Cents.parse` for untrusted input.
 */
export function asCents(value: number): Cents {
  return value as Cents;
}

const id = z.string().min(1).max(64);

export const SessionId = id.brand<"SessionId">();
export type SessionId = z.infer<typeof SessionId>;

export const RoundId = id.brand<"RoundId">();
export type RoundId = z.infer<typeof RoundId>;

export const RequestId = id.brand<"RequestId">();
export type RequestId = z.infer<typeof RequestId>;

/** Key of a debug preset in the math's `presets.json`. */
export const PresetId = id;
export type PresetId = z.infer<typeof PresetId>;

export const ERROR_CODES = [
  "INSUFFICIENT_FUNDS",
  "INVALID_BET",
  "BAD_REQUEST",
  "INTERNAL",
] as const;

export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;
