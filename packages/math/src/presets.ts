import { z } from "zod";

import { PresetId, type PresetInfo } from "@cb2077/shared";
import { Grid } from "@cb2077/shared/game";

import rawPresets from "./presets.json";

const Preset = z.object({
  id: PresetId,
  label: z.string().min(1),
  grid: Grid,
});

export type Preset = z.infer<typeof Preset>;

/** Ready-made grids for the debug drawer, validated at startup. */
export const presets: readonly Preset[] = z
  .array(Preset)
  .refine(
    (list) => new Set(list.map((preset) => preset.id)).size === list.length,
    "Duplicate preset id",
  )
  .parse(rawPresets);

export function findPreset(id: string): Preset | undefined {
  return presets.find((preset) => preset.id === id);
}

export function presetInfos(): PresetInfo[] {
  return presets.map(({ id, label }) => ({ id, label }));
}
