import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import {
  type CheckForfeiture,
  FORFEITURE_ASSESSMENTS,
} from "../../../domain/settings/assessment.ts";
import {
  BASE_REVISION_OPTION,
  FORFEITURE_OPTION,
  REPO_OPTION,
  type Subcommand,
} from "./command-line.ts";
import { PRUNE_DEBT_SUBCOMMAND } from "./subcommand-names.ts";

type InvocationRequest = {
  readonly path: PathPort;
  readonly moduleUrl: string;
  readonly repoRoot: AbsolutePath;
};

const SHELL_SAFE_WORD = /^[\w./@:+-]+$/;

const shellWord = (request: { readonly path: string }): string => {
  const forwardSlashed = request.path.replaceAll("\\", "/");
  return SHELL_SAFE_WORD.test(forwardSlashed) ? forwardSlashed : `"${forwardSlashed}"`;
};

const optionWords = (request: {
  readonly name: string;
  readonly value: string | undefined;
}): readonly string[] =>
  request.value === undefined ? [] : [request.name, shellWord({ path: request.value })];

const toolInvocationOf = (
  request: InvocationRequest & {
    readonly subcommand: Subcommand;
    readonly options: readonly string[];
  },
): Result<string, LoadFailure> => {
  const entry = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entry.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: entry.error.url,
        detail: entry.error.detail,
      },
    };
  }
  return {
    outcome: "ok",
    value: [
      "node",
      shellWord({ path: entry.value }),
      request.subcommand,
      REPO_OPTION.name,
      shellWord({ path: request.repoRoot }),
      ...request.options,
    ].join(" "),
  };
};

export const projectCommandOf = (request: InvocationRequest): Result<string, LoadFailure> =>
  toolInvocationOf({ ...request, subcommand: "project", options: [] });

export const upgradeInvocationOf = (request: InvocationRequest): Result<string, LoadFailure> =>
  toolInvocationOf({ ...request, subcommand: "upgrade", options: [] });

export const pruneCommandOf = (
  request: InvocationRequest & {
    readonly baseRevision: string | undefined;
    readonly forfeiture: CheckForfeiture | undefined;
  },
): Result<string, LoadFailure> =>
  toolInvocationOf({
    ...request,
    subcommand: PRUNE_DEBT_SUBCOMMAND,
    options: [
      ...optionWords({ name: BASE_REVISION_OPTION.name, value: request.baseRevision }),
      ...optionWords({
        name: FORFEITURE_OPTION.name,
        value: FORFEITURE_ASSESSMENTS.find((forfeiture) => forfeiture === request.forfeiture),
      }),
    ],
  });
