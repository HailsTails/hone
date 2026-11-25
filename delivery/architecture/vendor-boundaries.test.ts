import { describe, expect, it } from "vitest";

import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { findImportsOutside } from "./import-confinement.ts";
import type { ImportForm } from "./module-imports.ts";
import { VENDOR_BOUNDARIES } from "./vendor-boundaries.ts";

describe("VENDOR_BOUNDARIES", () => {
  it.each<{ boundary: string; file: string; specifier: string; form: ImportForm }>([
    {
      boundary: "core",
      file: "src/run/a.ts",
      specifier: "../infrastructure/engines/walker/y.ts",
      form: "value",
    },
    {
      boundary: "core",
      file: "src/run/deeper/b.ts",
      specifier: "../../infrastructure/engines/walker/y.ts",
      form: "value",
    },
    { boundary: "core", file: "src/run/a.ts", specifier: "../walker.ts", form: "value" },
    {
      boundary: "outside mechanisms",
      file: "hone.eslint.d.mts",
      specifier: "eslint",
      form: "type-only",
    },
    {
      boundary: "outside mechanisms",
      file: "delivery/release/hone.eslint.d.mts",
      specifier: "eslint",
      form: "type-only",
    },
    {
      boundary: "unlisted mechanisms",
      file: "src/infrastructure/engines/walker/stray.ts",
      specifier: "zod",
      form: "value",
    },
    {
      boundary: "runners",
      file: "src/infrastructure/engines/walker/runner/a.ts",
      specifier: "typescript",
      form: "type-only",
    },
    {
      boundary: "platform ports",
      file: "src/infrastructure/node/process/execution-port.ts",
      specifier: "typescript",
      form: "value",
    },
    {
      boundary: "module loader port",
      file: "src/infrastructure/node/modules/module-loader-port.ts",
      specifier: "load-runner",
      form: "dynamic",
    },
    {
      boundary: "install proof ports",
      file: "delivery/install-proof/install-proof-ports.ts",
      specifier: "zod",
      form: "value",
    },
    {
      boundary: "bundler port",
      file: "delivery/packaging/building/esbuild-bundler-port.ts",
      specifier: "zod",
      form: "value",
    },
    {
      boundary: "typescript parse",
      file: "src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts",
      specifier: "typescript",
      form: "value",
    },
    {
      boundary: "jsonc parse",
      file: "src/infrastructure/engines/walker/runner/pieces/jsonc-parse.ts",
      specifier: "jsonc-parser",
      form: "dynamic",
    },
    {
      boundary: "ESLint toolchain",
      file: "src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts",
      specifier: "eslint",
      form: "value",
    },
    {
      boundary: "ESLint toolchain",
      file: "src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts",
      specifier: "load-one",
      form: "dynamic",
    },
    {
      boundary: "ESLint instance",
      file: "src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts",
      specifier: "eslint",
      form: "value",
    },
    {
      boundary: "inline config parser",
      file: "src/infrastructure/engines/eslint/runner/native-exceptions/inline-config-parser.ts",
      specifier: "@eslint/plugin-kit",
      form: "dynamic",
    },
    {
      boundary: "native rules",
      file: "src/infrastructure/engines/eslint/runner/pieces/native-rules.ts",
      specifier: "zod",
      form: "value",
    },
    {
      boundary: "audit pieces",
      file: "src/infrastructure/engines/walker/rebinding/a.ts",
      specifier: "typescript",
      form: "value",
    },
    {
      boundary: "ESLint pieces",
      file: "src/infrastructure/engines/eslint/rebinding/a.ts",
      specifier: "eslint",
      form: "value",
    },
    { boundary: "tests", file: "src/run/a.test.ts", specifier: "zod", form: "type-only" },
  ])(
    "refuses, for $boundary, a $form import of $specifier in $file",
    ({ boundary, file, specifier, form }) => {
      const outside = findImportsOutside({
        sources: [{ file, imports: [{ specifier, kind: "import", form, names: [] }] }],
        boundaries: VENDOR_BOUNDARIES,
        path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
      });

      expect(outside).toEqual([{ boundary, file, specifier, kind: "import", form, names: [] }]);
    },
  );
});
