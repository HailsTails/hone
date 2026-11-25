import { describe, expect, it } from "vitest";

import { createDefaultConsumerTypesPort } from "./consumer-types.ts";

describe("createDefaultConsumerTypesPort, over the real TypeScript", () => {
  it("reads nothing from a program that compiles against a package written for it", async () => {
    const port = createDefaultConsumerTypesPort({ installRoot: `${import.meta.dirname}/../../..` });

    const diagnostics = await port.read({
      entry: "entry.ts",
      resolution: "bundler",
      form: "typescript",
      texts: [
        {
          path: "entry.ts",
          text: 'import { count } from "counted";\n\nexport const first: number = count;\n',
        },
      ],
      packages: [
        {
          kind: "written",
          name: "counted",
          texts: [
            { path: "package.json", text: '{ "name": "counted", "types": "./counted.d.ts" }' },
            { path: "counted.d.ts", text: "export declare const count: number;\n" },
          ],
        },
      ],
    });

    expect(diagnostics).toEqual({ outcome: "ok", value: [] });
  });

  it("reads a package the consumer does not have as unresolved, though the repository has it installed", async () => {
    const port = createDefaultConsumerTypesPort({ installRoot: `${import.meta.dirname}/../../..` });

    const diagnostics = await port.read({
      entry: "entry.ts",
      resolution: "bundler",
      form: "typescript",
      texts: [{ path: "entry.ts", text: 'export type { ZodType } from "zod";\n' }],
      packages: [],
    });

    expect(diagnostics).toEqual({
      outcome: "ok",
      value: [
        {
          path: "entry.ts",
          code: 2307,
          message: "Cannot find module 'zod' or its corresponding type declarations.",
        },
      ],
    });
  });

  it("resolves a package from the folder it is installed in", async () => {
    const port = createDefaultConsumerTypesPort({ installRoot: `${import.meta.dirname}/../../..` });

    const diagnostics = await port.read({
      entry: "entry.ts",
      resolution: "bundler",
      form: "typescript",
      texts: [{ path: "entry.ts", text: 'export type { ZodType } from "renamed";\n' }],
      packages: [
        {
          kind: "installed",
          name: "renamed",
          nodeModules: `${import.meta.dirname}/../../../node_modules`,
          folder: "zod",
        },
      ],
    });

    expect(diagnostics).toEqual({ outcome: "ok", value: [] });
  });

  it("asks for a written extension under nodenext resolution", async () => {
    const port = createDefaultConsumerTypesPort({ installRoot: `${import.meta.dirname}/../../..` });

    const diagnostics = await port.read({
      entry: "entry.mts",
      resolution: "nodenext",
      form: "typescript",
      texts: [
        { path: "entry.mts", text: 'export { count } from "./counted";\n' },
        { path: "counted.mts", text: "export const count = 1;\n" },
      ],
      packages: [],
    });

    expect(diagnostics).toEqual({
      outcome: "ok",
      value: [
        {
          path: "entry.mts",
          code: 2835,
          message:
            "Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './counted.mjs'?",
        },
      ],
    });
  });

  it("checks JavaScript in the checked form, reading the top line of what it finds", async () => {
    const port = createDefaultConsumerTypesPort({ installRoot: `${import.meta.dirname}/../../..` });

    const diagnostics = await port.read({
      entry: "entry.mjs",
      resolution: "bundler",
      form: "checked-javascript",
      texts: [
        {
          path: "entry.mjs",
          text: "const held = { nested: { count: 1 } };\n\n/** @type {{ nested: { count: string } }} */\nexport const named = held;\n",
        },
      ],
      packages: [],
    });

    expect(diagnostics).toEqual({
      outcome: "ok",
      value: [
        {
          path: "entry.mjs",
          code: 2322,
          message:
            "Type '{ nested: { count: number; }; }' is not assignable to type '{ nested: { count: string; }; }'.",
        },
      ],
    });
  });
});
