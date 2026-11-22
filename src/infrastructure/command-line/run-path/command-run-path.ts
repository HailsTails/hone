import type { CommandRequest } from "../../../application/ports/command-request.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { repoArgumentOf } from "../arguments/repo-argument.ts";
import { type RunPath, runPathOf } from "./run-path.ts";

export type CommandRunPath =
  | { readonly kind: "no-repository" }
  | {
      readonly kind: "repository";
      readonly repoRoot: AbsolutePath;
      readonly chosen: Result<RunPath, RunLoadFailure>;
    };

export const commandRunPathOf = (request: {
  readonly command: Pick<CommandRequest, "process" | "path" | "fileText">;
}): CommandRunPath => {
  const { command } = request;
  const repo = repoArgumentOf({ arguments: command.process.arguments });
  const resolved = repo === undefined ? undefined : command.path.resolve({ path: repo });
  if (resolved === undefined || resolved.outcome === "failed") {
    return { kind: "no-repository" };
  }
  return {
    kind: "repository",
    repoRoot: resolved.value,
    chosen: runPathOf({ fileText: command.fileText, path: command.path, repoRoot: resolved.value }),
  };
};
