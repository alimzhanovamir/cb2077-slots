import { z } from "zod";

import { ErrorCode, PresetId } from "./primitives.ts";

export const MAX_LATENCY_MS = 30_000;

export const DebugState = z.object({
  /** Preset used by the next spin. */
  forceNext: PresetId.optional(),
  /** Error returned by the next spin. */
  failNext: ErrorCode.optional(),
  /** Delay applied to every spin response. */
  latencyMs: z.number().int().min(0).max(MAX_LATENCY_MS),
});

export type DebugState = z.infer<typeof DebugState>;

export const PresetInfo = z.object({
  id: PresetId,
  label: z.string(),
});

export type PresetInfo = z.infer<typeof PresetInfo>;

export const DebugInfo = z.object({
  presets: z.array(PresetInfo),
  state: DebugState,
});

export type DebugInfo = z.infer<typeof DebugInfo>;
