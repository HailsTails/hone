import { describe, expect, it, vi } from "vitest";

import type {
  Check,
  RecordKind,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { DEFAULT_TEST_FILES } from "../../../domain/settings/test-files.ts";
import type { ParsedNamedRunner } from "../../ports/engine/engine-run.ts";
import {
  createNamedVersionOneEnginePass,
  type NamedVersionOnePassRequest,
} from "./named-version-one-engine-pass.ts";

const REPO = absoluteRootOf("/repo");
const INSTALL = absoluteRootOf("/install");
const CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const INPUT: NamedVersionOnePassRequest = {
  measureVersionOne: vi.fn<NamedVersionOnePassRequest["measureVersionOne"]>(),
  selected: [{ address: CLAUSE, mechanism: "walker", exceptions: "allowed" }],
  selection: {
    version: 1,
    ruleSets: [],
    clauses: [[CLAUSE, { state: "run", mechanism: "walker" }]],
    exclude: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "optional",
    reportOutput: "full",
    assessment: { forfeiture: "this-run" },
    clauseSettings: [],
    checkEditions: "pinned",
  },
  catalogues: [],
  repoRoot: REPO,
  installRoot: INSTALL,
  moduleExtension: ".ts",
  path: { join: vi.fn() },
  modules: { load: vi.fn() },
  tree: { tracked: [], declaredConfigRoots: [] },
  engine: { load: vi.fn(), run: vi.fn(), project: vi.fn() },
  settingsPath: "hone.config.json",
  sources: { settingsFile: vi.fn(), ruleSetRoot: vi.fn(), catalogue: vi.fn() },
  readPiece: vi.fn(),
  checkProjection: vi.fn(),
  loadFailureDetail: vi.fn(),
};

const LOOP: Check = {
  name: "loops",
  symptom: {
    ruleSet: TOOL_RULE_SET,
    name: "loop-keyword",
    title: "Loop keyword",
    seen: "A loop.",
    mayIndicate: [],
    breachUsuallySits: "in the unit",
    recipes: [],
    correctUses: [],
  },
  clause: CLAUSE,
  engines: [{ name: "walker" }],
  forms: [],
};

const DEBT: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [DEBT, AUTHORISED],
  engines: LOOP.engines,
  symptoms: [LOOP.symptom],
  clauses: [{ clause: CLAUSE, sight: { kind: "one-symptom", symptom: LOOP.symptom } }],
  checks: [LOOP],
  namedBans: [],
};

const RUNNER: ParsedNamedRunner = {
  fileScope: "tracked",
  projectedKinds: [],
  run: vi.fn(),
  conform: vi.fn(),
  project: vi.fn(),
};

const PROJECTION = {
  settingsFile: "disciplines.json",
  projectionFile: repoPathOf("disciplines.eslint.mjs"),
  packageFiles: [],
  rules: new Map(),
};

const FIRST = editionOf("1");

const WALKER_MEASURED = {
  report: {
    mechanism: "walker",
    coverableKinds: [],
    hits: [],
    measured: [],
    nativeExceptions: [],
    projection: "none",
    slices: [],
    nestedConfigurations: [],
    unprojectedFolders: [],
    misnamedRuleIds: [],
  },
  unappliedSlices: [],
} as const;

const WALKER_PIECE = {
  exceptions: "allowed",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/loop-keyword/loops",
  settings: {},
  declarations: {},
  forms: {},
  editions: { declared: [FIRST], default: FIRST, latest: FIRST },
} as const;

describe("createNamedVersionOneEnginePass", () => {
  it("refuses a legacy selection whose clause cannot be matched to a named check", async () => {
    const pass = createNamedVersionOneEnginePass(INPUT);
    await expect(pass.findingsFor({ records: [] })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "version-one-run-failed",
        detail: "version one selection could not be bound to checks: clause-without-check",
      },
    });
    expect(INPUT.checkProjection).not.toHaveBeenCalled();
    expect(INPUT.engine.load).not.toHaveBeenCalled();
  });

  it("sends a selected Walker check through the upgrade measurement port with the inspected projection", async () => {
    const measureVersionOne = vi
      .fn<NamedVersionOnePassRequest["measureVersionOne"]>()
      .mockResolvedValue({ outcome: "ok", value: WALKER_MEASURED });
    const engine: NamedVersionOnePassRequest["engine"] = {
      load: vi.fn().mockResolvedValue({ outcome: "ok", value: RUNNER }),
      run: vi.fn(),
      project: vi.fn(),
    };
    const pass = createNamedVersionOneEnginePass({
      ...INPUT,
      catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: CATALOGUE }],
      sources: {
        ...INPUT.sources,
        ruleSetRoot: vi.fn().mockReturnValue({ outcome: "ok", value: INSTALL }),
        catalogue: vi.fn().mockReturnValue({
          outcome: "ok",
          value: { held: "catalogue", catalogue: CATALOGUE },
        }),
      },
      readPiece: vi.fn().mockReturnValue({ outcome: "ok", value: WALKER_PIECE }),
      engine,
      checkProjection: vi.fn().mockResolvedValue({ outcome: "ok", value: PROJECTION }),
      measureVersionOne,
    });
    await expect(pass.findingsFor({ records: [] })).resolves.toEqual({
      outcome: "ok",
      value: {
        findings: [],
        runs: [{ mechanism: "walker", coverableKinds: [], nativeExceptions: [] }],
      },
    });
    expect(measureVersionOne).toHaveBeenCalledExactlyOnceWith({
      call: { mechanism: "walker", runner: RUNNER, request: expect.anything() },
      projection: PROJECTION,
      location: {
        installRoot: INSTALL,
        mechanism: "walker",
        moduleExtension: ".ts",
        path: INPUT.path,
        modules: INPUT.modules,
      },
    });
    expect(engine.run).not.toHaveBeenCalled();
  });

  it("sends a team rule set's checks with their own rule set", async () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamLoop: Check = { ...LOOP, symptom: { ...LOOP.symptom, ruleSet: acme } };
    const measureVersionOne = vi
      .fn<NamedVersionOnePassRequest["measureVersionOne"]>()
      .mockResolvedValue({ outcome: "ok", value: WALKER_MEASURED });
    const engine: NamedVersionOnePassRequest["engine"] = {
      load: vi.fn().mockResolvedValue({ outcome: "ok", value: RUNNER }),
      run: vi.fn(),
      project: vi.fn(),
    };
    const pass = createNamedVersionOneEnginePass({
      ...INPUT,
      catalogues: [
        { ruleSet: TOOL_RULE_SET, catalogue: CATALOGUE },
        {
          ruleSet: acme,
          catalogue: { ...CATALOGUE, symptoms: [teamLoop.symptom], checks: [teamLoop] },
        },
      ],
      sources: {
        ...INPUT.sources,
        ruleSetRoot: vi.fn().mockReturnValue({ outcome: "ok", value: INSTALL }),
        catalogue: vi.fn().mockReturnValue({
          outcome: "ok",
          value: { held: "catalogue", catalogue: CATALOGUE },
        }),
      },
      readPiece: vi.fn().mockReturnValue({ outcome: "ok", value: WALKER_PIECE }),
      engine,
      checkProjection: vi.fn().mockResolvedValue({ outcome: "ok", value: PROJECTION }),
      measureVersionOne,
    });
    await pass.findingsFor({ records: [] });
    expect(measureVersionOne).toHaveBeenCalledExactlyOnceWith({
      call: {
        mechanism: "walker",
        runner: RUNNER,
        request: {
          repoRoot: REPO,
          installRoot: INSTALL,
          files: [],
          trackedPaths: [],
          bindings: [
            {
              address: "loop-keyword#loops",
              ruleSet: TOOL_RULE_SET,
              engine: "walker",
              anchor: { kind: "file" },
              pieceRoot: "/install/walker/loop-keyword/loops",
              settings: {},
              forms: {},
              checkSettings: {},
              edition: FIRST,
            },
          ],
          checks: [LOOP, teamLoop],
          answered: [],
          declaredConfigRoots: [],
          testFiles: DEFAULT_TEST_FILES,
        },
      },
      projection: PROJECTION,
      location: {
        installRoot: INSTALL,
        mechanism: "walker",
        moduleExtension: ".ts",
        path: INPUT.path,
        modules: INPUT.modules,
      },
    });
  });
});
