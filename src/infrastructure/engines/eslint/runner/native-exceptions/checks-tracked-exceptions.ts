import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CheckNativeException } from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type {
  NativeException,
  ScriptOptionCause,
} from "../../../../../domain/runner/runner-result-types.ts";
import type { SelectedNamedCheck } from "../checks-runner/checks-run-types.ts";
import { filesNamed, repositoryDirectoryOf } from "../config-roots/checks-paths.ts";
import {
  type CheckSubject,
  type PackageJsonScan,
  type PackageScriptsReader,
  type RuleSubject,
  type ScannedRule,
  type ScriptOption,
  type ScriptOptionException,
  scannedScriptsFor,
  type SelectedRule,
} from "./package-script-scanner.ts";
import type { OptionVerdict, ScriptOptionJudge } from "./script-option-effect.ts";
import {
  type SuppressionException,
  type SuppressionsReader,
  suppressionEntriesFor,
} from "./suppressions-scanner.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;
type TrackedException<Subject extends RuleSubject> =
  | SuppressionException<Subject>
  | (ScriptOptionException<Subject> & { readonly cause: ScriptOptionCause });

const SUPPRESSIONS_FILE_NAME = "eslint-suppressions.json";

const PACKAGE_JSON_NAME = "package.json";

const suppressionsExceptions = <Subject extends RuleSubject>(request: {
  readonly suppressionsAt: SuppressionsReader;
  readonly location: RepoPath;
  readonly keysRelativeTo: RepoPath | "repo-root";
  readonly selectedRules: readonly ScannedRule<Subject>[];
}): Outcome<readonly TrackedException<Subject>[]> => {
  const suppressions = request.suppressionsAt({ location: request.location });
  return suppressions.outcome === "failed"
    ? suppressions
    : suppressionEntriesFor({
        location: request.location,
        keysRelativeTo: request.keysRelativeTo,
        suppressions: suppressions.value,
        selectedRules: request.selectedRules,
      });
};

const causeOf = (request: {
  readonly verdict: OptionVerdict;
  readonly option: Pick<ScriptOption, "command">;
}): ScriptOptionCause | undefined => {
  switch (request.verdict.kind) {
    case "weakens":
      return { kind: "weakens-run" };
    case "not-plain":
      return { ...request.verdict.reason, command: request.option.command };
    case "weakens-nothing":
      return undefined;
  }
};

const weakeningExceptions = <Subject extends RuleSubject>(request: {
  readonly option: ScriptOption<Subject>;
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly TrackedException<Subject>[]>> =>
  request.judge({ option: request.option }).then((verdict) => {
    if (verdict.outcome === "failed") {
      return verdict;
    }
    const cause = causeOf({ verdict: verdict.value, option: request.option });
    return {
      outcome: "ok",
      value:
        cause === undefined
          ? []
          : request.option.exceptions.map((exception): TrackedException<Subject> => ({
              ...exception,
              cause,
            })),
    };
  });

const judgedScriptExceptions = <Subject extends RuleSubject>(request: {
  readonly scan: PackageJsonScan<Subject>;
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly TrackedException<Subject>[]>> =>
  Promise.all(
    request.scan.scriptOptions.map((option) =>
      weakeningExceptions({ option, judge: request.judge }),
    ),
  ).then((outcomes) => gatheredOutcomes({ outcomes }));

const unreadableScriptExceptions = <Subject extends RuleSubject>(request: {
  readonly scan: PackageJsonScan<Subject>;
}): readonly TrackedException<Subject>[] =>
  request.scan.unreadableScripts.flatMap((unreadable) =>
    unreadable.exceptions.map((exception): TrackedException<Subject> => ({
      ...exception,
      cause: { kind: "unreadable", command: unreadable.command },
    })),
  );

const scannedPackageExceptions = <Subject extends RuleSubject>(request: {
  readonly suppressionsAt: SuppressionsReader;
  readonly packagePath: RepoPath;
  readonly scan: PackageJsonScan<Subject>;
  readonly selectedRules: readonly ScannedRule<Subject>[];
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly TrackedException<Subject>[]>> =>
  judgedScriptExceptions(request).then((scriptExceptions) =>
    gatheredOutcomes({
      outcomes: [
        scriptExceptions,
        { outcome: "ok", value: unreadableScriptExceptions({ scan: request.scan }) },
        ...request.scan.suppressionsLocations.map((scripted) =>
          suppressionsExceptions({
            suppressionsAt: request.suppressionsAt,
            location: scripted.location,
            keysRelativeTo: repositoryDirectoryOf({ path: request.packagePath }),
            selectedRules: request.selectedRules,
          }),
        ),
      ],
    }),
  );

const packageJsonExceptions = <Subject extends RuleSubject>(request: {
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly packagePath: RepoPath;
  readonly selectedRules: readonly ScannedRule<Subject>[];
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly TrackedException<Subject>[]>> => {
  const scripts = request.packageScriptsAt({ packagePath: request.packagePath });
  if (scripts.outcome === "failed") {
    return Promise.resolve(scripts);
  }
  const scan = scannedScriptsFor({
    path: request.packagePath,
    scripts: scripts.value,
    selectedRules: request.selectedRules,
  });
  return scan.outcome === "failed"
    ? Promise.resolve(scan)
    : scannedPackageExceptions({ ...request, scan: scan.value });
};

export type TrackedRequest = {
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly trackedPaths: readonly RepoPath[];
  readonly judge: ScriptOptionJudge;
};

const trackedFor = <Subject extends RuleSubject>(
  request: TrackedRequest & { readonly selectedRules: readonly ScannedRule<Subject>[] },
): Promise<Outcome<readonly TrackedException<Subject>[]>> =>
  Promise.all([
    ...filesNamed({ trackedPaths: request.trackedPaths, name: SUPPRESSIONS_FILE_NAME }).map(
      (location) =>
        Promise.resolve(
          suppressionsExceptions({
            ...request,
            location,
            keysRelativeTo: repositoryDirectoryOf({ path: location }),
          }),
        ),
    ),
    ...filesNamed({ trackedPaths: request.trackedPaths, name: PACKAGE_JSON_NAME }).map(
      (packagePath) => packageJsonExceptions({ ...request, packagePath }),
    ),
  ]).then((outcomes) => gatheredOutcomes({ outcomes }));

export const trackedExceptionsOfRules = (
  request: TrackedRequest & { readonly selectedRules: readonly SelectedRule[] },
): Promise<Outcome<readonly NativeException[]>> =>
  trackedFor({
    ...request,
    selectedRules: request.selectedRules.map(({ ruleId, clause }) => ({
      ruleId,
      subject: { clause },
    })),
  });

export const trackedNamedExceptionsOf = (
  request: TrackedRequest & { readonly selected: readonly SelectedNamedCheck[] },
): Promise<Outcome<readonly CheckNativeException[]>> =>
  Promise.all(
    request.selected.map(({ ruleId, address }) =>
      trackedFor<CheckSubject>({
        ...request,
        selectedRules: [{ ruleId, subject: { check: address } }],
      }),
    ),
  ).then((outcomes) => gatheredOutcomes({ outcomes }));
