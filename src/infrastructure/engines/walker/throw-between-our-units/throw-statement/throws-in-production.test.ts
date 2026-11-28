import { assert, describe, expect, it } from "vitest";

import type {
  Check,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../../../../domain/language-layer/symptom-catalogue.ts";
import { holdsAt } from "../../../../../domain/records/answering/record-reach.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { DEFAULT_TEST_FILES } from "../../../../../domain/settings/test-files.ts";
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
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/throw-between-our-units/throw-statement",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "throws-in-production.ts" },
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
  engines: [],
  symptoms: [SYMPTOM],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("throws in production", () => {
  it("reports a production throw at the keyword", () => {
    const source = "function readOrder() {\n  throw new Error('missing order');\n}";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/throw-between-our-units/throw-statement/throws-in-production.ts",
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
        anchor: { line: 2, column: 2 },
        snippet: "throw new Error('missing order');",
      },
    ]);
  });

  it("passes returned failures", () => {
    const source = "function readOrder() { return { outcome: 'failed' }; }";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/throw-between-our-units/throw-statement/throws-in-production.ts",
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

  it("flattens and bounds a multiline production throw", () => {
    const source =
      'function readOrder() {\n  throw new Error(\n    "1234567890123456789012345678901234567890123456789012345678901234567890",\n  );\n}';
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/throw-between-our-units/throw-statement/throws-in-production.ts",
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
        anchor: { line: 2, column: 2 },
        snippet:
          'throw new Error( "12345678901234567890123456789012345678901234567890123456789012…',
      },
    ]);
  });

  it.each(["src/read-order.test.ts", "src/read-order.test.tsx"])(
    "leaves throws in %s to the test detector",
    (fileName) => {
      const file = repoPathSchema.parse(fileName);
      const source = "throw new Error('test setup');";
      assert(parsed.outcome === "ok");
      const prepared = check.prepare({
        bindings: [BINDING],
        repository: {
          files: [file],
          exists: () => "present",
          disk: textsDisk({ root: "/repo", texts: {} }),
          testFiles: DEFAULT_TEST_FILES,
        },
        syntaxApi: parsed.value.syntaxApi,
      });
      assert(prepared.outcome === "ok");
      const observed = observeWalkerFile({
        file: { file, readText: () => ({ outcome: "ok", value: source }) },
        pieces: [
          {
            modulePath:
              "/install/walker/throw-between-our-units/throw-statement/throws-in-production.ts",
            bindings: [BINDING],
            check: prepared.value,
          },
        ],
        parse: parsed.value,
        escapes: [],
      });
      assert(observed.outcome === "ok");
      expect(observed.value.hits).toEqual([]);
    },
  );

  it.each([
    "src/read-order.spec.ts",
    "src/read-order.spec.tsx",
    "src/read-order.spec.mts",
    "src/read-order.spec.cts",
    "src/read-order.test.mts",
    "src/read-order.test.cts",
  ])("preserves the production detector's existing exclusion for %s", (name) => {
    const file = repoPathSchema.parse(name);
    const source = "throw failure;";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [file],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/throw-between-our-units/throw-statement/throws-in-production.ts",
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

  it("does not follow calls into another unit that might throw", () => {
    const source = "return parseOrder(input);";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/throw-between-our-units/throw-statement/throws-in-production.ts",
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

  it("lets an authorised exception adapter answer its production throw", () => {
    const source = "throw new Error('legacy failure');";
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [ADAPTER_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: ADAPTER_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/throw-between-our-units/throw-statement/throws-in-production.ts",
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
        snippet: "throw new Error('legacy failure');",
      },
    ]);
    const throwStatement: Check = {
      name: "throw-statement",
      symptom: { ruleSet: "hone", name: "throw-between-our-units" },
      page: "throw-between-our-units/throw-statement.md",
      engines: [{ name: "walker" }],
      forms: [],
      findingSpecifics: [],
    };
    expect(
      holdsAt({
        record: {
          kind: "authorised-location",
          symptom: { ruleSet: "hone", name: "throw-between-our-units" },
          file: ADAPTER_FILE,
          reach: { reaches: "one-check", check: throwStatement },
          holding: {
            held: "carried",
            entry: { reason: "The caller expects exceptions." },
            lacks: ["case", "owes", "whyChain"],
            standing: "established",
            binding: { binds: "check-and-file" },
          },
        },
        site: {
          file: ADAPTER_FILE,
          symptom: { ruleSet: "hone", name: "throw-between-our-units" },
          recipes: [],
          check: { found: "check", check: throwStatement },
          party: { reported: "not-reported" },
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });
});
