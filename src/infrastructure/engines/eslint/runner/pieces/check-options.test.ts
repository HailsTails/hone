import { describe, expect, it } from "vitest";

import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { readEslintCheckOptions } from "./check-options.ts";

describe("readEslintCheckOptions", () => {
  it("maps Hone's parameter policy to ESLint's rule arguments", () => {
    const edition = editionOf("1");

    const options = readEslintCheckOptions({
      edition,
      settings: { pluginModule: "max-params.ts", pluginNamespace: "hone", rule: "max-params" },
      checkOptions: { kind: "parameter-count", maximumSlots: 2, voidReceiver: "count" },
    });

    expect(options).toEqual([{ max: 2, countVoidThis: true }]);
  });
});
