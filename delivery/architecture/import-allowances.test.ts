import { describe, expect, it } from "vitest";

import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  COMPUTED_LOAD,
  decideImport,
  EVERY_FORM,
  type ImportAllowance,
  type ImportVerdict,
  NODE_BUILTIN_IMPORT,
  PACKAGE_OR_COMPUTED_IMPORT,
  RELATIVE_IMPORT,
  RELATIVE_IMPORT_OF_ANY_FORM,
  VITEST_IMPORT,
  ZOD_IMPORT,
} from "./import-allowances.ts";
import type { ImportForm } from "./module-imports.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const ANY_LOADER: ImportAllowance = {
  kind: "specifier",
  specifier: /^load-\w+$/,
  forms: EVERY_FORM,
};

const REACHING_VALUES: ImportAllowance = { kind: "relative-reach", reach: /^src\/values\// };

describe("decideImport", () => {
  it.each<{
    allowed: readonly ImportAllowance[];
    specifier: string;
    form: ImportForm;
    verdict: ImportVerdict;
  }>([
    { allowed: [RELATIVE_IMPORT], specifier: "./a.ts", form: "value", verdict: "allowed" },
    { allowed: [RELATIVE_IMPORT], specifier: "../a.ts", form: "type-only", verdict: "allowed" },
    { allowed: [RELATIVE_IMPORT], specifier: "./a.ts", form: "dynamic", verdict: "outside" },
    {
      allowed: [RELATIVE_IMPORT_OF_ANY_FORM],
      specifier: "./a.ts",
      form: "dynamic",
      verdict: "allowed",
    },
    { allowed: [RELATIVE_IMPORT_OF_ANY_FORM], specifier: "zod", form: "value", verdict: "outside" },
    { allowed: [NODE_BUILTIN_IMPORT], specifier: "node:path", form: "value", verdict: "allowed" },
    { allowed: [NODE_BUILTIN_IMPORT], specifier: "node:path", form: "dynamic", verdict: "outside" },
    { allowed: [NODE_BUILTIN_IMPORT], specifier: "zod", form: "value", verdict: "outside" },
    { allowed: [COMPUTED_LOAD], specifier: "`${a}.ts`", form: "dynamic", verdict: "allowed" },
    { allowed: [COMPUTED_LOAD], specifier: "./runner.ts", form: "dynamic", verdict: "outside" },
    { allowed: [COMPUTED_LOAD], specifier: "`${a}.ts`", form: "value", verdict: "outside" },
    {
      allowed: [PACKAGE_OR_COMPUTED_IMPORT],
      specifier: "zod",
      form: "dynamic",
      verdict: "allowed",
    },
    {
      allowed: [PACKAGE_OR_COMPUTED_IMPORT],
      specifier: "./a.ts",
      form: "value",
      verdict: "outside",
    },
    { allowed: [ZOD_IMPORT], specifier: "zod", form: "type-only", verdict: "allowed" },
    { allowed: [ZOD_IMPORT], specifier: "zod", form: "dynamic", verdict: "outside" },
    { allowed: [VITEST_IMPORT], specifier: "vitest", form: "value", verdict: "allowed" },
    { allowed: [VITEST_IMPORT], specifier: "vitest-extra", form: "value", verdict: "outside" },
    { allowed: [ANY_LOADER, ZOD_IMPORT], specifier: "zod", form: "value", verdict: "allowed" },
    { allowed: [], specifier: "zod", form: "value", verdict: "outside" },
    { allowed: [REACHING_VALUES], specifier: "../values/x.ts", form: "value", verdict: "allowed" },
    {
      allowed: [REACHING_VALUES],
      specifier: "../../values/x.ts",
      form: "value",
      verdict: "outside",
    },
    { allowed: [REACHING_VALUES], specifier: "src/values/x.ts", form: "value", verdict: "outside" },
  ])(
    "answers $verdict for a $form import of $specifier",
    ({ allowed, specifier, form, verdict }) => {
      const decided = decideImport({
        allowed,
        file: "src/run/a.ts",
        moduleImport: { specifier, form },
        path: PATH,
      });

      expect(decided).toBe(verdict);
    },
  );
});
