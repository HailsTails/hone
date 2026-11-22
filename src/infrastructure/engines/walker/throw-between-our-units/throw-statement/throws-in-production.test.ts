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
import { check } from "./throws-in-production.ts";

const SOURCE_FILE = repoPathSchema.parse("src/read-order.ts");
const ADAPTER_FILE = repoPathSchema.parse("src/adapters/legacy-api.ts");
const BINDING: CheckBinding = {
  address: "throw-between-our-units#throw-statement",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/throw-between-our-units/throw-statement",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "throws-in-production.ts" },
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
        modulePath:
          "/install/walker/throw-between-our-units/throw-statement/throws-in-production.ts",
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
  name: "throw-between-our-units",
  title: "Throw between our units",
  seen: "A production unit throws at its caller.",
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

describe("throws in production", () => {
  it("reports a production throw at the keyword", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "function readOrder() {\n  throw new Error('missing order');\n}",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 2 },
        snippet: "throw new Error('missing order');",
      },
    ]);
  });

  it("passes returned failures and throws in test files", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "function readOrder() { return { outcome: 'failed' }; }",
      }),
    ).toEqual([]);
    expect(
      findingsIn({
        file: repoPathSchema.parse("src/read-order.test.ts"),
        source: "throw new Error('test setup');",
      }),
    ).toEqual([]);
  });

  it("does not follow calls into another unit that might throw", () => {
    expect(findingsIn({ file: SOURCE_FILE, source: "return parseOrder(input);" })).toEqual([]);
  });

  it("lets an authorised exception adapter answer its production throw", () => {
    expect(
      findingsIn({ file: ADAPTER_FILE, source: "throw new Error('legacy failure');" }),
    ).toEqual([
      {
        file: ADAPTER_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "throw new Error('legacy failure');",
      },
    ]);
    expect(
      holdsAt({
        record: {
          kind: "authorised-location",
          symptom: SYMPTOM,
          file: ADAPTER_FILE,
          reach: { reaches: "whole-symptom" },
          holding: {
            held: "carried",
            entry: { reason: "The caller expects exceptions." },
            lacks: ["case", "owes", "whyChain"],
            standing: "established",
          },
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
