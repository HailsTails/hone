import { assert, describe, expect, it } from "vitest";

import type {
  RecordKind,
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
const SYMPTOM = {
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
  alwaysRecordable: { debt: DEBT, authorisedLocation: LOCATION },
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

  it("leaves an aliased random function outside the syntax check", () => {
    expect(
      findingsIn({ file: SOURCE_FILE, source: "const { random } = Math;\nrandom();" }),
    ).toEqual([]);
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
