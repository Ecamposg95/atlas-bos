import { useEnabledModulesStore } from '../store/enabledModulesStore'
import { presetFor } from '../components/atlas-one'
import type { PresetConfig } from '../components/atlas-one'

/**
 * usePreset — fuente ÚNICA del preset visual para componentes (WS-1).
 *
 * Reconcilia la taxonomía dual: el store guarda el IndustryType crudo (MAYÚS,
 * ej. `ATLAS_ONE_RESTAURANT`, mismo valor que el CSS `[data-preset]`), y este
 * hook lo mapea al `PresetConfig` de tokens.ts (accent, sidebar, tint…) que
 * consumen los componentes atlas-one. Así los componentes ya no reciben el
 * preset a mano ni leen variables CSS: piden `usePreset()` y listo.
 *
 * `presetFor` cae a `PRESETS.pos` si el preset es nulo/desconocido, e incluye
 * los alias legacy (ATLAS_ONE_GASTRO→restaurant, ATLAS_ONE_BEAUTY→beauty_wellness).
 */
export function usePreset(): PresetConfig {
  const preset = useEnabledModulesStore((s) => s.preset)
  return presetFor(preset ?? undefined)
}
