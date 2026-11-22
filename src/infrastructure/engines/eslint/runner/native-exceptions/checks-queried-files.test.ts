import { describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { AnsweredFile } from "../projection/checks-projection.ts";
import { projectionEffectOf, queriedFilesOf, queryExceptionsOf } from "./checks-queried-files.ts";
import type { CheckedFile } from "./checks-rule-effects.ts";
import type { SelectedCheck } from "../checks-runner/checks-run-types.ts";
import type { RuleState } from "../toolchain/eslint-config-schema.ts";
import type { ConfigFileSearch, IgnoredState, QueryInstance } from "../toolchain/eslint-instance.ts";
import type { GoverningIgnores } from "../config-roots/governing-config.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";

const CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-1"), clause: clauseIdOf("explicit-any") };

const EXPLICIT_ANY: SelectedCheck = { address: "untyped-value#explicit-any", symptom: "untyped-value", ruleId: "hone/untyped-value#explicit-any", clause: CLAUSE, options: [] };

const A = repoPathOf("src/a.ts");

const B = repoPathOf("src/b.ts");

const ENFORCED: RuleState = { state: "configured", severity: 2, options: [] };

const OFF: RuleState = { state: "configured", severity: 0, options: [] };

const ABSENT: RuleState = { state: "rule-absent" };

const checkedWith = (request: { readonly file: CheckedFile["file"]; readonly state: RuleState }): CheckedFile => ({
  file: request.file,
  states: [{ ruleId: EXPLICIT_ANY.ruleId, state: request.state }],
});

const ANSWERED_B: readonly AnsweredFile[] = [{ symptom: "untyped-value", file: B }];

type Outcome<Value> = Result<Value, RunnerFailure>;

const ignoredOutcome = (request: { readonly state: IgnoredState }): Outcome<IgnoredState> => ({ outcome: "ok", value: request.state });

const REPO = absoluteRootOf("/repo");

const BROKEN_FIXTURE_FILE = repoPathOf("fixtures/bad/b.ts");

const BROKEN_CONFIG: ConfigFileSearch = { kind: "found", path: "/repo/fixtures/bad/eslint.config.mjs" };

const ROOT_CONFIG: ConfigFileSearch = { kind: "found", path: "/repo/eslint.config.mjs" };

const CONFIG_UNLOADABLE: Outcome<IgnoredState> = { outcome: "failed", error: { kind: "team-config-unloadable", detail: "Unexpected token ';'" } };

const locationOver = (request: { readonly governingIgnoreOf: GoverningIgnores }) => ({
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" }),
  repoRoot: REPO,
  governingIgnoreOf: request.governingIgnoreOf,
});

const NOTHING_IGNORED = locationOver({ governingIgnoreOf: vi.fn<GoverningIgnores>().mockResolvedValue("not-ignored") });

describe("queriedFilesOf", () => {
  it("splits the files into ignored ones and checked ones with the state of each selected rule", async () => {
    const query: QueryInstance = {
      ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValueOnce(ignoredOutcome({ state: "ignored" })).mockResolvedValueOnce(ignoredOutcome({ state: "checked" })),
      ruleState: vi.fn<QueryInstance["ruleState"]>().mockResolvedValueOnce({ outcome: "ok", value: ENFORCED }),
      configFileOf: vi.fn<QueryInstance["configFileOf"]>(),
    };
    expect(await queriedFilesOf({ query, files: [A, B], ruleIds: [EXPLICIT_ANY.ruleId], location: NOTHING_IGNORED })).toEqual({
      outcome: "ok",
      value: { ignored: [A], checked: [checkedWith({ file: B, state: ENFORCED })] },
    });
  });

  it("fails when the query fails", async () => {
    const query: QueryInstance = {
      ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValueOnce({ outcome: "failed", error: { kind: "team-config-unloadable", detail: "broken" } }),
      ruleState: vi.fn<QueryInstance["ruleState"]>(),
      configFileOf: vi.fn<QueryInstance["configFileOf"]>().mockResolvedValue({ kind: "unknown" }),
    };
    expect(await queriedFilesOf({ query, files: [A], ruleIds: [EXPLICIT_ANY.ruleId], location: NOTHING_IGNORED })).toEqual({
      outcome: "failed",
      error: { kind: "team-config-unloadable", detail: "the ESLint config for src/a.ts failed to load: broken. Fix that config." },
    });
  });

  it("reports a file whose broken config sits in a folder the governing config ignores as ignored, the way version 1 does", async () => {
    const query: QueryInstance = {
      ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValueOnce(CONFIG_UNLOADABLE),
      ruleState: vi.fn<QueryInstance["ruleState"]>(),
      configFileOf: vi.fn<QueryInstance["configFileOf"]>().mockResolvedValueOnce(BROKEN_CONFIG).mockResolvedValueOnce(ROOT_CONFIG),
    };
    const location = locationOver({ governingIgnoreOf: vi.fn<GoverningIgnores>().mockResolvedValue("ignored") });
    expect(await queriedFilesOf({ query, files: [BROKEN_FIXTURE_FILE], ruleIds: [EXPLICIT_ANY.ruleId], location })).toEqual({
      outcome: "ok",
      value: { ignored: [BROKEN_FIXTURE_FILE], checked: [] },
    });
  });

  it("fails naming the broken config and how to repair it when the governing config does not ignore its folder", async () => {
    const query: QueryInstance = {
      ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValueOnce(CONFIG_UNLOADABLE),
      ruleState: vi.fn<QueryInstance["ruleState"]>(),
      configFileOf: vi.fn<QueryInstance["configFileOf"]>().mockResolvedValue(BROKEN_CONFIG),
    };
    expect(await queriedFilesOf({ query, files: [BROKEN_FIXTURE_FILE], ruleIds: [EXPLICIT_ANY.ruleId], location: NOTHING_IGNORED })).toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "fixtures/bad/eslint.config.mjs, the ESLint config for fixtures/bad/b.ts, failed to load: Unexpected token ';'. Fix that config. Only if fixtures/bad holds nothing Hone should check, add it to exclude in hone.config.json instead.",
      },
    });
  });
});

describe("queryExceptionsOf", () => {
  it("reports an ignored file as an ignore and a weakened rule as a config override, each naming the check", () => {
    expect(queryExceptionsOf({ selected: [EXPLICIT_ANY], answered: [], queried: { ignored: [A], checked: [checkedWith({ file: B, state: OFF })] } })).toEqual([
      { kind: "ignore", clause: CLAUSE, file: A, check: "untyped-value#explicit-any" },
      { kind: "config-override", clause: CLAUSE, file: B, check: "untyped-value#explicit-any" },
    ]);
  });

  it("does not report as an override the off state of a file the records answer", () => {
    expect(queryExceptionsOf({ selected: [EXPLICIT_ANY], answered: ANSWERED_B, queried: { ignored: [], checked: [checkedWith({ file: B, state: OFF })] } })).toEqual([]);
  });

  it("reports nothing for a rule enforced at severity 2", () => {
    expect(queryExceptionsOf({ selected: [EXPLICIT_ANY], answered: [], queried: { ignored: [], checked: [checkedWith({ file: A, state: ENFORCED })] } })).toEqual([]);
  });
});

describe("projectionEffectOf", () => {
  it("is in effect when every selected rule is configured on a checked file and answered files are off", () => {
    expect(projectionEffectOf({ selected: [EXPLICIT_ANY], answered: ANSWERED_B, queried: { ignored: [], checked: [checkedWith({ file: B, state: OFF })] } })).toBe("in-effect");
  });

  it("is in effect when no file is checked, so nothing says the rule is not enabled", () => {
    expect(projectionEffectOf({ selected: [EXPLICIT_ANY], answered: [], queried: { ignored: [A], checked: [] } })).toBe("in-effect");
  });

  it("is not in effect when a selected rule is absent from every checked file", () => {
    expect(projectionEffectOf({ selected: [EXPLICIT_ANY], answered: [], queried: { ignored: [], checked: [checkedWith({ file: A, state: ABSENT })] } })).toBe("not-in-effect");
  });

  it("is not in effect when an answered file is not turned off", () => {
    expect(projectionEffectOf({ selected: [EXPLICIT_ANY], answered: ANSWERED_B, queried: { ignored: [], checked: [checkedWith({ file: B, state: ENFORCED })] } })).toBe("not-in-effect");
  });
});
