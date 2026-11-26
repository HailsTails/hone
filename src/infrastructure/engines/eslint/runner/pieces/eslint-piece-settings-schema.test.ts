import { describe, expect, it } from "vitest";

import { eslintPieceSettingsSchema } from "./eslint-piece-settings-schema.ts";

describe("ESLint piece settings", () => {
  it("exposes the shared schema for a local plugin rule", () => {
    const settings = {
      pluginNamespace: "team",
      pluginModule: "plugin.ts",
      rule: "no-marker",
    };

    const parsed = eslintPieceSettingsSchema.safeParse(settings);

    expect(parsed).toEqual({ success: true, data: settings });
  });
});
