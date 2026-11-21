import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { ConfigFileSearch, EslintPort, QueryInstance } from "../toolchain/eslint-instance.ts";
import { type NotPlainReason, repoPathResolved, type ScriptOption } from "./package-script-scanner.ts";

export type OptionVerdict =
  | { readonly kind: "weakens" }
  | { readonly kind: "weakens-nothing" }
  | { readonly kind: "not-plain"; readonly reason: NotPlainReason };

export type ScriptOptionJudge = (request: {
  readonly option: ScriptOption;
}) => Promise<Result<OptionVerdict, RunnerFailure>>;

type JudgeContext = {
  readonly query: Pick<QueryInstance, "configFileOf">;
  readonly eslint: Pick<EslintPort, "ignoredByPatterns">;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly checked: readonly RepoPath[];
};

const WEAKENS: Result<OptionVerdict, RunnerFailure> = { outcome: "ok", value: { kind: "weakens" } };

const WEAKENS_NOTHING: Result<OptionVerdict, RunnerFailure> = { outcome: "ok", value: { kind: "weakens-nothing" } };

const folderSegmentsOf = (request: { readonly location: RepoPath }): readonly string[] =>
  request.location.split("/").slice(0, -1);

const checkedWithin = (request: {
  readonly checked: readonly RepoPath[];
  readonly folderSegments: readonly string[];
}): readonly RepoPath[] => {
  const folder = request.folderSegments.join("/");
  return request.checked.filter((file) => folder === "" || file.startsWith(`${folder}/`));
};

const resolvesTo = (request: {
  readonly search: ConfigFileSearch;
  readonly config: RepoPath;
  readonly context: JudgeContext;
}): "same-config" | "other-config" => {
  if (request.search.kind !== "found") return "other-config";
  const location = request.context.path.relative({ from: request.context.repoRoot, to: request.search.path });
  return location.relation === "within-root" && location.path === request.config ? "same-config" : "other-config";
};

const configVerdict = (request: { readonly context: JudgeContext; readonly location: RepoPath; readonly config: string }): Promise<Result<OptionVerdict, RunnerFailure>> => {
  const folderSegments = folderSegmentsOf(request);
  const config = repoPathResolved({ baseSegments: folderSegments, path: request.config });
  if (config.outcome === "failed") return Promise.resolve(WEAKENS);
  const files = checkedWithin({ checked: request.context.checked, folderSegments });
  if (files.length === 0) return Promise.resolve(WEAKENS);
  return Promise.all(files.map((file) => request.context.query.configFileOf({ file }))).then((searches) =>
    searches.every((search) => resolvesTo({ search, config: config.value, context: request.context }) === "same-config")
      ? WEAKENS_NOTHING
      : WEAKENS,
  );
};

const ignorePatternVerdict = (request: { readonly context: JudgeContext; readonly location: RepoPath; readonly pattern: string }): Promise<Result<OptionVerdict, RunnerFailure>> => {
  const folderSegments = folderSegmentsOf(request);
  const files = checkedWithin({ checked: request.context.checked, folderSegments });
  if (files.length === 0) return Promise.resolve(WEAKENS);
  const cwd = request.context.path.resolve({ path: request.context.path.join({ segments: [request.context.repoRoot, ...folderSegments] }) });
  if (cwd.outcome === "failed") return Promise.resolve(WEAKENS);
  return request.context.eslint
    .ignoredByPatterns({
      cwd: cwd.value,
      patterns: [request.pattern],
      paths: files.map((file) => file.split("/").slice(folderSegments.length).join("/")),
    })
    .then((states) => {
      if (states.outcome === "failed") return states;
      return states.value.includes("ignored") ? WEAKENS : WEAKENS_NOTHING;
    });
};

export const scriptOptionJudge =
  (context: JudgeContext): ScriptOptionJudge =>
  ({ option }) => {
    if (option.effect.kind === "weakens" || option.settlement.kind === "unresolved") return Promise.resolve(WEAKENS);
    if (option.settlement.kind === "not-plain") {
      return Promise.resolve({ outcome: "ok", value: { kind: "not-plain", reason: option.settlement.reason } });
    }
    switch (option.effect.kind) {
      case "names-config":
        return configVerdict({ context, location: option.location, config: option.effect.config });
      case "ignores-pattern":
        return ignorePatternVerdict({ context, location: option.location, pattern: option.effect.pattern });
    }
  };
