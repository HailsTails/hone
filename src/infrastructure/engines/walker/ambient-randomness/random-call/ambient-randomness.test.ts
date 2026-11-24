import { assert, describe, expect, it } from "vitest";

import type {
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../../../../domain/language-layer/symptom-catalogue.ts";
import { holdsAt } from "../../../../../domain/records/answering/record-reach.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
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

const parsed = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});

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
    const source = "Math.random();\ncrypto.randomUUID();\ncrypto['getRandomValues'](bytes);";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
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
    const source =
      "const pick = (randomness: Randomness) => randomness.randomUUID();\nMath.floor(2);\nlocal.crypto.randomUUID();\nconst method = crypto.getRandomValues;";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("passes a crypto parameter used as an injected randomness port", () => {
    const source = 'const newId = (crypto: Pick<Crypto, "randomUUID">) => crypto.randomUUID();';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("finds browser-qualified crypto and aliases of Node crypto imports", () => {
    const source =
      'import { randomUUID as uuid, webcrypto as web } from "node:crypto";\nimport * as nodeCrypto from "crypto";\nglobalThis.crypto.randomUUID();\nwindow["crypto"].getRandomValues(bytes);\nuuid();\nnodeCrypto.randomUUID();\nweb.getRandomValues(bytes);';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
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
    const source =
      'import { randomUUID as uuid } from "node:crypto";\nfunction run(uuid: () => string) { return uuid(); }\nconst crypto = ports.crypto;\nconst Math = ports.math;\ncrypto.randomUUID();\nMath.random();\nconst fromPort = (window: Runtime) => window.crypto.getRandomValues(bytes);';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("finds Web Crypto and default exports through Node Crypto imports", () => {
    const source =
      'import * as nodeCrypto from "node:crypto";\nimport moduleCrypto from "node:crypto";\nimport { default as legacyCrypto } from "crypto";\nnodeCrypto.webcrypto.getRandomValues(bytes);\nmoduleCrypto["webcrypto"].getRandomValues(bytes);\nlegacyCrypto.randomUUID();\nnodeCrypto.default.randomUUID();\nnodeCrypto["default"].getRandomValues(bytes);\nmoduleCrypto.default.randomUUID();\nnodeCrypto.default.webcrypto.getRandomValues(bytes);';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
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
    const source = 'import nodeCrypto = require("crypto");\nnodeCrypto.randomUUID();';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [file],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        file,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "nodeCrypto.randomUUID",
      },
    ]);
  });

  it("finds a CommonJS require of Node crypto", () => {
    const source = 'const nodeCrypto = require("node:crypto");\nnodeCrypto.randomUUID();';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "nodeCrypto.randomUUID",
      },
    ]);
  });

  it("passes crypto from a locally supplied require", () => {
    const source =
      'const require = injectedLoader;\nconst nodeCrypto = require("node:crypto");\nnodeCrypto.randomUUID();';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("leaves an aliased random function outside the syntax check", () => {
    const source = "const { random } = Math;\nrandom();";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("only follows runtime bindings imported from Node crypto", () => {
    const source =
      'import { type randomUUID as typeUUID, randomUUID as nodeUUID } from "node:crypto";\nimport { randomUUID as adapterUUID } from "./runtime";\ntypeUUID();\nadapterUUID();\nnodeUUID();';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: "nodeUUID",
      },
    ]);
  });

  it("does not treat a declare statement as a locally supplied crypto value", () => {
    const source = "declare const crypto: Crypto;\ncrypto.randomUUID();";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "crypto.randomUUID",
      },
    ]);
  });

  it("lets a runtime random boundary record answer the finding in its adapter", () => {
    const source = "crypto.randomUUID();";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [ADAPTER_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: ADAPTER_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath: "/install/walker/ambient-randomness/random-call/ambient-randomness.ts",
          bindings: [BINDING],
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
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
          symptom: { ruleSet: "hone", name: "ambient-randomness" },
          recipes: [],
          check: { found: "none" },
          party: { reported: "not-reported" },
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });
});
