import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { NativeException, ScriptOptionCause } from "../../../../../domain/runner/runner-result-types.ts";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import { filesNamed, repositoryDirectoryOf } from "../config-roots/checks-paths.ts";
import type { SelectedCheck } from "../checks-runner/checks-run-types.ts";
import { type PackageJsonScan, type PackageScriptsReader, type ScriptOption, scannedPackageScripts, type SelectedRule } from "./package-script-scanner.ts";
import type { OptionVerdict, ScriptOptionJudge } from "./script-option-effect.ts";
import { type SuppressionsReader, suppressionEntriesIn } from "./suppressions-scanner.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

const SUPPRESSIONS_FILE_NAME = "eslint-suppressions.json";

const PACKAGE_JSON_NAME = "package.json";

const suppressionsExceptions = (request: {
  readonly suppressionsAt: SuppressionsReader;
  readonly location: RepoPath;
  readonly keysRelativeTo: RepoPath | "repo-root";
  readonly selectedRules: readonly SelectedRule[];
}): Outcome<readonly NativeException[]> => {
  const suppressions = request.suppressionsAt({ location: request.location });
  return suppressions.outcome === "failed"
    ? suppressions
    : suppressionEntriesIn({ location: request.location, keysRelativeTo: request.keysRelativeTo, suppressions: suppressions.value, selectedRules: request.selectedRules });
};

const causeOf = (request: { readonly verdict: OptionVerdict; readonly option: ScriptOption }): ScriptOptionCause | undefined => {
  switch (request.verdict.kind) {
    case "weakens":
      return { kind: "weakens-run" };
    case "not-plain":
      return { ...request.verdict.reason, command: request.option.command };
    case "weakens-nothing":
      return undefined;
  }
};

const weakeningExceptions = (request: { readonly option: ScriptOption; readonly judge: ScriptOptionJudge }): Promise<Outcome<readonly NativeException[]>> =>
  request.judge({ option: request.option }).then((verdict) => {
    if (verdict.outcome === "failed") {
      return verdict;
    }
    const cause = causeOf({ verdict: verdict.value, option: request.option });
    return { outcome: "ok", value: cause === undefined ? [] : request.option.exceptions.map((exception): NativeException => ({ ...exception, cause })) };
  });

const judgedScriptExceptions = (request: { readonly scan: PackageJsonScan; readonly judge: ScriptOptionJudge }): Promise<Outcome<readonly NativeException[]>> =>
  Promise.all(request.scan.scriptOptions.map((option) => weakeningExceptions({ option, judge: request.judge }))).then((outcomes) => gatheredOutcomes({ outcomes }));

const unreadableScriptExceptions = (request: { readonly scan: PackageJsonScan }): readonly NativeException[] =>
  request.scan.unreadableScripts.flatMap((unreadable) => unreadable.exceptions.map((exception): NativeException => ({ ...exception, cause: { kind: "unreadable", command: unreadable.command } })));

const scannedPackageExceptions = (request: {
  readonly suppressionsAt: SuppressionsReader;
  readonly packagePath: RepoPath;
  readonly scan: PackageJsonScan;
  readonly selectedRules: readonly SelectedRule[];
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly NativeException[]>> =>
  judgedScriptExceptions(request).then((scriptExceptions) =>
    gatheredOutcomes({
      outcomes: [
        scriptExceptions,
        { outcome: "ok", value: unreadableScriptExceptions({ scan: request.scan }) },
        ...request.scan.suppressionsLocations.map((scripted) =>
          suppressionsExceptions({ suppressionsAt: request.suppressionsAt, location: scripted.location, keysRelativeTo: repositoryDirectoryOf({ path: request.packagePath }), selectedRules: request.selectedRules }),
        ),
      ],
    }),
  );

const packageJsonExceptions = (request: {
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly packagePath: RepoPath;
  readonly selectedRules: readonly SelectedRule[];
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly NativeException[]>> => {
  const scripts = request.packageScriptsAt({ packagePath: request.packagePath });
  if (scripts.outcome === "failed") {
    return Promise.resolve(scripts);
  }
  const scan = scannedPackageScripts({ path: request.packagePath, scripts: scripts.value, selectedRules: request.selectedRules });
  return scan.outcome === "failed" ? Promise.resolve(scan) : scannedPackageExceptions({ ...request, scan: scan.value });
};

export type TrackedRequest = {
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly trackedPaths: readonly RepoPath[];
  readonly judge: ScriptOptionJudge;
};

export const trackedExceptionsOfRules = (request: TrackedRequest & { readonly selectedRules: readonly SelectedRule[] }): Promise<Outcome<readonly NativeException[]>> =>
  Promise.all([
    ...filesNamed({ trackedPaths: request.trackedPaths, name: SUPPRESSIONS_FILE_NAME }).map((location) =>
      Promise.resolve(suppressionsExceptions({ ...request, location, keysRelativeTo: repositoryDirectoryOf({ path: location }) })),
    ),
    ...filesNamed({ trackedPaths: request.trackedPaths, name: PACKAGE_JSON_NAME }).map((packagePath) => packageJsonExceptions({ ...request, packagePath })),
  ]).then((outcomes) => gatheredOutcomes({ outcomes }));

const namedFor = (request: { readonly entry: SelectedCheck; readonly outcome: Outcome<readonly NativeException[]> }): Outcome<readonly NativeException[]> =>
  request.outcome.outcome === "failed"
    ? request.outcome
    : { outcome: "ok", value: request.outcome.value.map((exception): NativeException => ({ ...exception, check: request.entry.address })) };

export const trackedExceptionsOf = (request: TrackedRequest & { readonly selected: readonly SelectedCheck[] }): Promise<Outcome<readonly NativeException[]>> =>
  Promise.all(
    request.selected.map((entry) =>
      trackedExceptionsOfRules({ ...request, selectedRules: [{ ruleId: entry.ruleId, clause: entry.clause }] }).then((outcome) => namedFor({ entry, outcome })),
    ),
  ).then((outcomes) => gatheredOutcomes({ outcomes }));
