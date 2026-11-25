import { describe, expect, it } from "vitest";

import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { ESLINT_MAJOR_BOUNDARIES } from "./eslint-major-boundaries.ts";
import { findImportsOutside } from "./import-confinement.ts";

describe("ESLINT_MAJOR_BOUNDARIES", () => {
  it("finds eslint and eslint-9 imported in any form, at the root and in a folder, and no package whose name they only begin", () => {
    const outside = findImportsOutside({
      sources: [
        {
          file: "hone.eslint.d.mts",
          imports: [{ specifier: "eslint", kind: "import", form: "type-only", names: ["Linter"] }],
        },
        {
          file: "src/infrastructure/engines/eslint/runner/hone.eslint.d.mts",
          imports: [
            { specifier: "eslint-9/side-effect", kind: "import", form: "value", names: [] },
            { specifier: "eslint-plugin", kind: "import", form: "value", names: ["plugin"] },
            { specifier: "zod", kind: "import", form: "value", names: ["z"] },
            { specifier: "eslint-9", kind: "load", form: "dynamic", names: [] },
          ],
        },
        {
          file: "delivery/install-proof/consumer-proof/eslint.config.mjs",
          imports: [{ specifier: "eslint", kind: "import", form: "value", names: ["ESLint"] }],
        },
      ],
      boundaries: ESLINT_MAJOR_BOUNDARIES,
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
    });

    expect(outside).toEqual([
      {
        boundary: "no ESLint major",
        file: "hone.eslint.d.mts",
        specifier: "eslint",
        kind: "import",
        form: "type-only",
        names: ["Linter"],
      },
      {
        boundary: "no ESLint major",
        file: "src/infrastructure/engines/eslint/runner/hone.eslint.d.mts",
        specifier: "eslint-9/side-effect",
        kind: "import",
        form: "value",
        names: [],
      },
      {
        boundary: "no ESLint major",
        file: "src/infrastructure/engines/eslint/runner/hone.eslint.d.mts",
        specifier: "eslint-9",
        kind: "load",
        form: "dynamic",
        names: [],
      },
    ]);
  });
});
