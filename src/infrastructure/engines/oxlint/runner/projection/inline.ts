import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { CheckNativeException } from "../../../../../domain/runner/check-observations.ts";
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
