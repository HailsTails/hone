import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CheckNativeException } from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { RunOxlint } from "../../../../node/process/oxlint-port.ts";
import type { ProjectionRule } from "./oxlint-projection.ts";

const DISABLE = /^\s*(?:\/\/|\/\*)\s*(?:oxlint|eslint)-disable(?:-next-line|-line)?\b/u;

export const mapDisabledChecks = (request: {
  readonly text: string;
  readonly line: number;
  readonly file: RepoPath;
  readonly rules: readonly ProjectionRule[];
}): readonly CheckNativeException[] => {
  const match = DISABLE.exec(request.text);
  if (match === null) return [];
  const selectors = request.text
    .slice(match[0].length)
    .replace(/\*\/$/u, "")
    .split("--")[0]
    .trim()
    .split(/[,\s]+/u)
    .filter(Boolean);
  return request.rules.flatMap(({ binding, rule }): readonly CheckNativeException[] => {
    const matcher = selectors.some((selector) => {
      const spelling = selector.replace(/^@typescript-eslint\//u, "typescript/");
      return (
        spelling === rule.id ||
        `eslint/${spelling}` === rule.id ||
        (rule.kind === "native" && rule.id.endsWith(`/${spelling}`))
      );
    });
    return selectors.length === 0 || matcher
      ? [
          {
            kind: "inline-disable",
            file: request.file,
            line: request.line,
            text: request.text,
            check: binding.address,
            reach: selectors.length === 0 ? "every-selected-check" : "one-check",
          },
        ]
      : [];
  });
};

export const readInlineDisables = async (request: {
  readonly repoRoot: string;
  readonly sources: readonly {
    readonly file: RepoPath;
    readonly fileName: string;
    readonly source: string;
  }[];
  readonly rules: readonly ProjectionRule[];
  readonly lint: RunOxlint;
}): Promise<Result<readonly CheckNativeException[], RunnerFailure>> => {
  const sources = request.sources.filter(({ source }) => /(?:oxlint|eslint)-disable/u.test(source));
  if (sources.length === 0) return { outcome: "ok", value: [] };
  const observed: CheckNativeException[] = [];
  const scan = await request.lint({
    resolveFrom: request.repoRoot,
    rules: [],
    sources,
    observeDisable: ({ index, line, text }) => {
      observed.push(
        ...mapDisabledChecks({ file: sources[index].file, line, text, rules: request.rules }),
      );
    },
  });
  return scan.outcome === "failed" ? scan : { outcome: "ok", value: observed };
};
