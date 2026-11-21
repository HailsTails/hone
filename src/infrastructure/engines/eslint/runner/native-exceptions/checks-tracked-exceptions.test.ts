import { describe, expect, it, vi } from "vitest";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import type { SelectedCheck } from "../checks-runner/checks-run-types.ts";
import { trackedExceptionsOf } from "./checks-tracked-exceptions.ts";
import type { PackageScriptsReader } from "./package-script-scanner.ts";
import type { ScriptOptionJudge } from "./script-option-effect.ts";
import type { SuppressionsReader } from "./suppressions-scanner.ts";

const CLAUSE = clauseAddressSchema.parse("CD-1#explicit-any");

const EXPLICIT_ANY: SelectedCheck = { address: "untyped-value#explicit-any", symptom: "untyped-value", ruleId: "hone/untyped-value#explicit-any", clause: CLAUSE, options: [] };

const SUPPRESSIONS = repoPathSchema.parse("eslint-suppressions.json");

const SUPPRESSING_A = { "src/a.ts": { "hone/untyped-value#explicit-any": { count: 2 }, "no-console": { count: 1 } } };

const trackedOver = (request: { readonly trackedPaths: readonly RepoPath[] }) =>
  trackedExceptionsOf({
    packageScriptsAt: vi.fn<PackageScriptsReader>(),
    suppressionsAt: vi.fn<SuppressionsReader>().mockReturnValue({ outcome: "ok", value: SUPPRESSING_A }),
    trackedPaths: request.trackedPaths,
    selected: [EXPLICIT_ANY],
    judge: vi.fn<ScriptOptionJudge>(),
  });

describe("trackedExceptionsOf", () => {
  it("reports a suppression entry for the check's rule, naming the check, and none for another plugin's rule", async () => {
    expect(await trackedOver({ trackedPaths: [SUPPRESSIONS] })).toEqual({
      outcome: "ok",
      value: [{ kind: "suppression-entry", clause: CLAUSE, file: "src/a.ts", location: "eslint-suppressions.json", check: "untyped-value#explicit-any" }],
    });
  });

  it("reports nothing when no suppressions file or package.json is tracked", async () => {
    expect(await trackedOver({ trackedPaths: [repoPathSchema.parse("src/a.ts")] })).toEqual({ outcome: "ok", value: [] });
  });
});
