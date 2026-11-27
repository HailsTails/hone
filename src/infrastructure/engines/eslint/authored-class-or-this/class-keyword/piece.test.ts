import { assert, describe, expect, it } from "vitest";

import { catalogueNameOf } from "../../../../../domain/language-layer/catalogue-name.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { readNamedPiece } from "../../../named-piece.ts";
import { eslintPieceSettingsSchema } from "../../../protocol/plugin-settings/eslint-piece-settings-schema.ts";
import classKeyword from "./piece.json" with { type: "json" };

describe("authored class ESLint declarations", () => {
  it("names the class authoring rule", () => {
    expect(eslintPieceSettingsSchema.safeParse(classKeyword.settings)).toEqual({
      success: true,
      data: {
        pluginNamespace: "hone",
        pluginModule: "eslint-plugin.ts",
        rule: "no-class-authoring",
      },
    });
  });

  it("reuses the class plugin for the check for classes with only static members", () => {
    const path = createDefaultPathPort({});
    const installRoot = path.join({ segments: [import.meta.dirname, "../../../../../../"] });
    const piece = readNamedPiece({
      mechanism: "eslint",
      fileText: createDefaultFileTextPort({}),
      path,
      installRoot,
      ruleSetRoot: installRoot,
      symptom: catalogueNameOf("authored-class-or-this"),
      check: catalogueNameOf("static-members-only"),
    });
    assert(piece.outcome === "ok");
    expect(piece.value.pieceRoot).toBe(import.meta.dirname);
    expect(eslintPieceSettingsSchema.safeParse(piece.value.settings)).toEqual({
      success: true,
      data: {
        pluginNamespace: "hone",
        pluginModule: "eslint-plugin.ts",
        rule: "no-extraneous-class",
      },
    });
  });
});
