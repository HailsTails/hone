import { describe, expect, it } from "vitest";
import type { DeclarationEmit } from "../delivery/packaging/type-declarations/package-declarations.ts";
import { publicTypeReachOf, valueClaimsIn } from "./public-type-reach.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

const syntaxApi = defaultParsePort.syntaxApi;

const ENTRIES = [
  { subpath: "audit", source: "api/audit.ts" },
  { subpath: "rule-set", source: "api/rule-set.ts" },
];

const EMIT: DeclarationEmit = {
  diagnostics: [],
  declarations: [
    { path: "api/audit.d.ts", text: 'export type { Tree } from "../core/tree.js";\n', specifiers: ["../core/tree.js"], refusals: [] },
    { path: "api/rule-set.d.ts", text: "export declare const ruleSet: 1;\n", specifiers: [], refusals: [] },
    { path: "core/tree.d.ts", text: 'import type typescript from "typescript";\nexport type Tree = typescript.Node;\nexport declare const tree: Tree;\n', specifiers: ["typescript"], refusals: [] },
    { path: "core/schema.d.ts", text: 'import { z } from "zod";\n', specifiers: ["zod"], refusals: [] },
  ],
};

describe("publicTypeReachOf", () => {
  it("names each entry's reached declarations and the packages they import, the values each entry declares, and the other shipped declarations that claim a value", () => {
    expect(publicTypeReachOf({ syntaxApi, emitted: { outcome: "ok", value: EMIT }, entries: ENTRIES, requiredPeers: ["typescript"] })).toEqual({
      problems: [],
      entries: {
        audit: { reached: ["api/audit.d.ts", "core/tree.d.ts"], packageImports: ["typescript"] },
        "rule-set": { reached: ["api/rule-set.d.ts"], packageImports: [] },
      },
      valueDeclaring: ["core/tree.d.ts: tree"],
      entryValues: { audit: [], "rule-set": ["ruleSet"] },
      zodMentioning: [],
    });
  });

  it("names a shipped declaration that mentions zod", () => {
    expect(
      publicTypeReachOf({
        syntaxApi,
        emitted: {
          outcome: "ok",
          value: { diagnostics: [], declarations: [{ path: "api/audit.d.ts", text: "export type Schema = 'zod';\n", specifiers: [], refusals: [] }] },
        },
        entries: [{ subpath: "audit", source: "api/audit.ts" }],
        requiredPeers: [],
      }).zodMentioning,
    ).toEqual(["api/audit.d.ts"]);
  });

  it("names the publication problems and ships nothing when a reached declaration imports a package that is not a required peer", () => {
    expect(publicTypeReachOf({ syntaxApi, emitted: { outcome: "ok", value: EMIT }, entries: ENTRIES, requiredPeers: [] })).toMatchObject({
      problems: ["core/tree.d.ts imports typescript, which is neither shipped nor a required peer"],
      valueDeclaring: [],
    });
  });

  it("names the port's failure as the only problem", () => {
    expect(
      publicTypeReachOf({ syntaxApi, emitted: { outcome: "failed", error: { kind: "declarations-failed", detail: "no tsconfig.json" } }, entries: ENTRIES, requiredPeers: [] }),
    ).toEqual({ problems: ["no tsconfig.json"], entries: {}, valueDeclaring: [], entryValues: {}, zodMentioning: [] });
  });
});

describe("valueClaimsIn", () => {
  it("names exported values, export assignments, value re-exports and local exports of values", () => {
    expect(
      valueClaimsIn({
        syntaxApi,
        text: 'export declare const answer: 1;\nexport declare function ask(): void;\nexport declare class Asker {}\nexport declare enum Mood { Calm }\nexport declare namespace Space {}\nexport default answer;\ndeclare const hidden: 1;\nexport { hidden };\nexport * from "./other.js";\nexport * as other from "./other.js";\nexport { reply } from "./other.js";\n',
      }),
    ).toEqual([
      "answer",
      "ask",
      "Asker",
      "Mood",
      "export declare namespace Space {}",
      "export default answer;",
      "hidden",
      'export * from "./other.js";',
      'export * as other from "./other.js";',
      'export { reply } from "./other.js";',
    ]);
  });

  it("names a value imported and exported again, import-equals, namespaces and augmentations, exported or not", () => {
    expect(
      valueClaimsIn({
        syntaxApi,
        text: 'import { answer } from "./other.js";\nexport { answer };\nimport reply = require("./other.js");\ndeclare namespace Hidden {}\nexport { Hidden };\ndeclare global { var shared: 1; }\ndeclare module "other" { export const inner: 1; }\nexport as namespace Hone;\n',
      }),
    ).toEqual([
      'import { answer } from "./other.js";',
      "answer",
      'import reply = require("./other.js");',
      "declare namespace Hidden {}",
      "Hidden",
      "declare global { var shared: 1; }",
      'declare module "other" { export const inner: 1; }',
      "export as namespace Hone;",
    ]);
  });

  it("claims nothing for types, type-only imports, type-only exports and a private symbol a type depends on", () => {
    expect(
      valueClaimsIn({
        syntaxApi,
        text: 'import type typescript from "typescript";\nimport { type Node } from "./node.js";\nexport { Node };\ndeclare const brand: unique symbol;\nexport type Branded = { readonly [brand]: 1 };\nexport interface Shape {}\ntype Local = 1;\nexport { type Local };\nexport type { Answer } from "./other.js";\nexport {};\n',
      }),
    ).toEqual([]);
  });
});