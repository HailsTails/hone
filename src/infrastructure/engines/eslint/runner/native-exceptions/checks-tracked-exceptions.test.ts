import { describe, expect, it, vi } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { SelectedNamedCheck } from "../checks-runner/checks-run-types.ts";
import { trackedNamedExceptionsOf } from "./checks-tracked-exceptions.ts";
import type { PackageScriptsReader } from "./package-script-scanner.ts";
import type { ScriptOptionJudge } from "./script-option-effect.ts";
import type { SuppressionsReader } from "./suppressions-scanner.ts";

const EXPLICIT_ANY: SelectedNamedCheck = {
  ruleSet: "hone",
  address: "untyped-value#explicit-any",
  symptom: "untyped-value",
  ruleId: "hone/untyped-value#explicit-any",
  options: [],
};

const SUPPRESSIONS = repoPathOf("eslint-suppressions.json");

const SUPPRESSING_A = {
  "src/a.ts": { "hone/untyped-value#explicit-any": { count: 2 }, "no-console": { count: 1 } },
};

const trackedOver = (request: { readonly trackedPaths: readonly RepoPath[] }) =>
  trackedNamedExceptionsOf({
    packageScriptsAt: vi.fn<PackageScriptsReader>(),
    suppressionsAt: vi
      .fn<SuppressionsReader>()
      .mockReturnValue({ outcome: "ok", value: SUPPRESSING_A }),
    trackedPaths: request.trackedPaths,
    selected: [EXPLICIT_ANY],
    judge: vi.fn<ScriptOptionJudge>(),
  });

describe("trackedNamedExceptionsOf", () => {
  it("reports a suppression entry for the check's rule, naming the check, and none for another plugin's rule", async () => {
    expect(await trackedOver({ trackedPaths: [SUPPRESSIONS] })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "suppression-entry",
          file: "src/a.ts",
          location: "eslint-suppressions.json",
          check: "untyped-value#explicit-any",
        },
      ],
    });
  });

  it("reports a package.json script option that weakens the whole run as a command-line-option naming the check", async () => {
    const outcome = await trackedNamedExceptionsOf({
      packageScriptsAt: vi.fn<PackageScriptsReader>().mockReturnValue({
        outcome: "ok",
        value: { "lint:suppress": "eslint --suppress-all ." },
      }),
      suppressionsAt: vi.fn<SuppressionsReader>(),
      trackedPaths: [repoPathOf("package.json")],
      selected: [EXPLICIT_ANY],
      judge: vi
        .fn<ScriptOptionJudge>()
        .mockResolvedValue({ outcome: "ok", value: { kind: "weakens" } }),
    });

    expect(outcome).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "command-line-option",
          location: "package.json",
          script: "lint:suppress",
          option: "--suppress-all",
          cause: { kind: "weakens-run" },
          check: "untyped-value#explicit-any",
        },
      ],
    });
  });

  it("reports nothing when no suppressions file or package.json is tracked", async () => {
    expect(await trackedOver({ trackedPaths: [repoPathOf("src/a.ts")] })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
