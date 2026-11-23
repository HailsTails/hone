import { assert, describe, expect, it } from "vitest";

import type {
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../../../../domain/language-layer/symptom-catalogue.ts";
import { holdsAt } from "../../../../../domain/records/answering/record-reach.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./ambient-randomness.ts";

const SOURCE_FILE = repoPathSchema.parse("src/choose-entry.ts");
const ADAPTER_FILE = repoPathSchema.parse("src/adapters/randomness.ts");
const BINDING: CheckBinding = {
  address: "ambient-randomness#random-call",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/ambient-randomness/random-call",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "ambient-randomness.ts" },
};

const parsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(parsePort.outcome === "ok");
const parse = parsePort.value;

const findingsIn = (request: {
  readonly file: RepoPath;
  readonly source: string;
}): readonly CheckHit[] => {
  const prepared = check.prepare({
    bindings: [BINDING],
    repository: {
      files: [request.file],
      exists: () => "present",
      disk: textsDisk({ root: "/repo", texts: {} }),
    },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const result = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [
      {
        modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
        bindings: [BINDING],
        check: prepared.value,
      },
    ],
    parse,
    escapes: [],
  });
  assert(result.outcome === "ok");
  return result.value.hits;
};

const DEBT: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};
const LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};
const SYMPTOM: Symptom = {
  ruleSet: "hone",
  name: "ambient-randomness",
  title: "Ambient randomness",
  seen: "A unit calls a built-in randomness source.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};
const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [DEBT, LOCATION],
  engines: [],
  symptoms: [SYMPTOM],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("ambient randomness", () => {
  it("reports the three direct random calls", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "Math.random();\ncrypto.randomUUID();\ncrypto['getRandomValues'](bytes);",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "Math.random",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "crypto.randomUUID",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "crypto['getRandomValues']",
      },
    ]);
  });

  it("passes an injected randomness port, unrelated calls, and an uncalled member", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          "const pick = (randomness: Randomness) => randomness.randomUUID();\nMath.floor(2);\nlocal.crypto.randomUUID();\nconst method = crypto.getRandomValues;",
      }),
    ).toEqual([]);
  });

  it("passes a crypto parameter used as an injected randomness port", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: 'const newId = (crypto: Pick<Crypto, "randomUUID">) => crypto.randomUUID();',
      }),
    ).toEqual([]);
  });

  it("finds browser-qualified crypto and aliases of Node crypto imports", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          'import { randomUUID as uuid, webcrypto as web } from "node:crypto";\nimport * as nodeCrypto from "crypto";\nglobalThis.crypto.randomUUID();\nwindow["crypto"].getRandomValues(bytes);\nuuid();\nnodeCrypto.randomUUID();\nweb.getRandomValues(bytes);',
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "globalThis.crypto.randomUUID",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: 'window["crypto"].getRandomValues',
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: "uuid",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 6, column: 0 },
        snippet: "nodeCrypto.randomUUID",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 7, column: 0 },
        snippet: "web.getRandomValues",
      },
    ]);
  });

  it("passes locally bound globals and a shadowed Node import alias", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          'import { randomUUID as uuid } from "node:crypto";\nfunction run(uuid: () => string) { return uuid(); }\nconst crypto = ports.crypto;\nconst Math = ports.math;\ncrypto.randomUUID();\nMath.random();\nconst fromPort = (window: Runtime) => window.crypto.getRandomValues(bytes);',
      }),
    ).toEqual([]);
  });

  it("finds Web Crypto and default exports through Node Crypto imports", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          'import * as nodeCrypto from "node:crypto";\nimport moduleCrypto from "node:crypto";\nimport { default as legacyCrypto } from "crypto";\nnodeCrypto.webcrypto.getRandomValues(bytes);\nmoduleCrypto["webcrypto"].getRandomValues(bytes);\nlegacyCrypto.randomUUID();\nnodeCrypto.default.randomUUID();\nnodeCrypto["default"].getRandomValues(bytes);\nmoduleCrypto.default.randomUUID();\nnodeCrypto.default.webcrypto.getRandomValues(bytes);',
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "nodeCrypto.webcrypto.getRandomValues",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: 'moduleCrypto["webcrypto"].getRandomValues',
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 6, column: 0 },
        snippet: "legacyCrypto.randomUUID",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 7, column: 0 },
        snippet: "nodeCrypto.default.randomUUID",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 8, column: 0 },
        snippet: 'nodeCrypto["default"].getRandomValues',
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 10, column: 0 },
        snippet: "nodeCrypto.default.webcrypto.getRandomValues",
      },
    ]);
  });

  it("finds a static require import in a TypeScript CommonJS file", () => {
    const file = repoPathSchema.parse("src/order.cts");
    expect(
      findingsIn({
        file,
        source: 'import nodeCrypto = require("crypto");\nnodeCrypto.randomUUID();',
      }),
    ).toEqual([
      {
        file,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "nodeCrypto.randomUUID",
      },
    ]);
  });

  it("leaves an aliased random function outside the syntax check", () => {
    expect(
      findingsIn({ file: SOURCE_FILE, source: "const { random } = Math;\nrandom();" }),
    ).toEqual([]);
  });

  it("only follows runtime bindings imported from Node crypto", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          'import { type randomUUID as typeUUID, randomUUID as nodeUUID } from "node:crypto";\nimport { randomUUID as adapterUUID } from "./runtime";\ntypeUUID();\nadapterUUID();\nnodeUUID();',
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: "nodeUUID",
      },
    ]);
  });

  it("does not treat a declare statement as a locally supplied crypto value", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "declare const crypto: Crypto;\ncrypto.randomUUID();",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "crypto.randomUUID",
      },
    ]);
  });

  it("lets a runtime random boundary record answer the finding in its adapter", () => {
    expect(findingsIn({ file: ADAPTER_FILE, source: "crypto.randomUUID();" })).toEqual([
      {
        file: ADAPTER_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "crypto.randomUUID",
      },
    ]);
    expect(
      holdsAt({
        record: {
          kind: "boundary-record",
          module: ADAPTER_FILE,
          outsideParty: { kind: "runtime", facility: "random" },
          holding: { held: "stated", ports: ["Randomness"] },
        },
        site: {
          file: ADAPTER_FILE,
          symptom: SYMPTOM,
          check: { found: "none" },
          party: { reported: "not-reported" },
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });
});
