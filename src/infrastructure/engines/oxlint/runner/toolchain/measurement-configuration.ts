import type { SelectedOxlintRule } from "../selected-rule.ts";

export const createMeasurementConfiguration = (selected: readonly SelectedOxlintRule[]) => ({
  categories: { correctness: "off" },
  rules: Object.fromEntries(selected.map(({ id, options }) => [id, ["error", ...options]])),
  jsPlugins: [
    ...new Map(
      selected.flatMap((rule) => (rule.kind === "plugin" ? [[rule.namespace, rule.module]] : [])),
    ),
  ].map(([name, specifier]) => ({ name, specifier })),
});
