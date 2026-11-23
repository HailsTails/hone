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
import { check } from "./process-global-used-in-place.ts";

const SOURCE_FILE = repoPathSchema.parse("src/read-settings.ts");
const ADAPTER_FILE = repoPathSchema.parse("src/adapters/process.ts");
const BINDING: CheckBinding = {
  address: "process-global-used-in-place#direct-global-use",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/process-global-used-in-place/direct-global-use",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "process-global-used-in-place.ts" },
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
          "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
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
  name: "process-global-used-in-place",
  title: "Process global used in place",
  seen: "A unit uses the process runtime directly.",
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

describe("process globals", () => {
  it("reports Node built-in imports that name the original process and console", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          'import process from "node:process";\nimport * as console from "console";\nprocess.env.MODE;\nconsole.log("ready");',
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "process.env",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "console.log",
      },
    ]);
  });

  it("reports each direct global use at the expression", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          "process.env.MODE;\nprocess['argv'];\nprocess.exit(1);\nprocess.on('exit', finish);\nconsole.log('ready');\nconst runtime = globalThis;",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "process.env",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "process['argv']",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "process.exit",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "process.on",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: "console.log",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 6, column: 16 },
        snippet: "globalThis",
      },
    ]);
  });

  it("passes injected parameters and unrelated object members", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          "const read = (process: Runtime) => process.env;\nconst notify = ({ console }: Runtime) => console.log('ready');\nprovided.process.env;\nprovided.globalThis;\ntype Runtime = typeof globalThis;",
      }),
    ).toEqual([]);
  });

  it("leaves a destructured process alias outside the syntax check", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "const { env: environment } = process;\nenvironment.MODE;",
      }),
    ).toEqual([]);
  });

  it("leaves locally declared and imported receivers alone", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          'import { console } from "./ports.ts";\nconsole.log("ready");\nfunction run() { const process = ports.process; return process.env.MODE; }\nfunction read() { const globalThis = ports.global; return { globalThis }; }',
      }),
    ).toEqual([]);
  });

  it("keeps bare global reads and test writes when the name has no local binding", () => {
    const file = repoPathSchema.parse("src/worker.test.ts");
    expect(
      findingsIn({
        file,
        source: "const roots = { globalThis };\nprocess.env.MODE = 'test';",
      }),
    ).toEqual([
      { file, check: BINDING.address, anchor: { line: 1, column: 16 }, snippet: "globalThis" },
      { file, check: BINDING.address, anchor: { line: 2, column: 0 }, snippet: "process.env" },
    ]);
  });

  it("still reports globals described by ambient declarations", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          'export {};\ndeclare const process: Runtime;\ndeclare global { var console: Console; }\nprocess.env.MODE;\nconsole.log("ready");',
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "process.env",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: "console.log",
      },
    ]);
  });

  it("lets a runtime process boundary record answer the finding in its adapter", () => {
    expect(findingsIn({ file: ADAPTER_FILE, source: "process.env.MODE;" })).toEqual([
      {
        file: ADAPTER_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "process.env",
      },
    ]);
    expect(
      holdsAt({
        record: {
          kind: "boundary-record",
          module: ADAPTER_FILE,
          outsideParty: { kind: "runtime", facility: "process" },
          holding: { held: "stated", ports: ["Process"] },
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
