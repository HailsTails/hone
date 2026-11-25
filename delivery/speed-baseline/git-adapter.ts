import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { ExecutionPort } from "../../src/infrastructure/node/process/execution-port.ts";
import type { BaselineCheckoutPort } from "./baseline-checkout-port.ts";
import type { CommandFailure } from "./command-failure.ts";
import { mapExecutionToCommandResult } from "./command-result.ts";
import {
  mapCommitToCheckoutSegments,
  mapPlaceToSegments,
  TARGET_INDEX_NAME,
} from "./speed-baseline-places.ts";
import type { TargetCopyPort } from "./target-copy-port.ts";
import type { TargetIndexPort } from "./target-index-port.ts";
import type { TargetTreePort } from "./target-tree-port.ts";

type WorktreeFailure =
  | { readonly kind: "command"; readonly command: CommandFailure }
  | { readonly kind: "unresolved"; readonly path: string };

const WORKTREE_LINE_PREFIX = "worktree ";

type CreateGit = (request: { readonly indexFile?: string }) => ExecutionPort<"captured", "none">;

const runGit = (request: {
  readonly git: ExecutionPort<"captured", "none">;
  readonly arguments: readonly string[];
  readonly cwd: AbsolutePath;
}): Result<string, CommandFailure> => {
  const run = mapExecutionToCommandResult({
    run: request.git.run({ arguments: request.arguments, cwd: request.cwd }),
  });
  return run.outcome === "failed" ? run : { outcome: "ok", value: run.value.stdout };
};

const readWorktreeDirectory = (request: {
  readonly git: ExecutionPort<"captured", "none">;
  readonly path: Pick<PathPort, "directoryOf" | "join" | "resolve">;
  readonly repository: AbsolutePath;
  readonly segments: readonly string[];
}): Result<AbsolutePath, WorktreeFailure> => {
  const commonDirectory = runGit({
    git: request.git,
    arguments: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    cwd: request.repository,
  });
  if (commonDirectory.outcome === "failed") {
    return { outcome: "failed", error: { kind: "command", command: commonDirectory.error } };
  }
  const directory = request.path.join({
    segments: [
      request.path.directoryOf({ path: commonDirectory.value.trim() }),
      ...request.segments,
    ],
  });
  const resolved = request.path.resolve({ path: directory });
  return resolved.outcome === "failed"
    ? { outcome: "failed", error: { kind: "unresolved", path: directory } }
    : resolved;
};

type Registration = "registered" | "unregistered";

const readRegistration = (request: {
  readonly git: ExecutionPort<"captured", "none">;
  readonly path: Pick<PathPort, "resolve">;
  readonly repository: AbsolutePath;
  readonly directory: AbsolutePath;
}): Result<Registration, CommandFailure> => {
  const listed = runGit({
    git: request.git,
    arguments: ["worktree", "list", "--porcelain"],
    cwd: request.repository,
  });
  if (listed.outcome === "failed") return listed;
  const registered = listed.value
    .split("\n")
    .filter((line) => line.startsWith(WORKTREE_LINE_PREFIX))
    .map((line) => request.path.resolve({ path: line.slice(WORKTREE_LINE_PREFIX.length).trim() }))
    .some((resolved) => resolved.outcome === "ok" && resolved.value === request.directory);
  return { outcome: "ok", value: registered ? "registered" : "unregistered" };
};

const removeWorktree = (request: {
  readonly git: ExecutionPort<"captured", "none">;
  readonly path: Pick<PathPort, "resolve">;
  readonly repository: AbsolutePath;
  readonly directory: AbsolutePath;
}): Result<null, CommandFailure> => {
  const removed = runGit({
    git: request.git,
    arguments: ["worktree", "remove", "--force", request.directory],
    cwd: request.repository,
  });
  if (removed.outcome === "ok") return { outcome: "ok", value: null };
  const registration = readRegistration(request);
  return registration.outcome === "ok" && registration.value === "unregistered"
    ? { outcome: "ok", value: null }
    : removed;
};

export const createBaselineCheckoutPort = (options: {
  readonly git: ExecutionPort<"captured", "none">;
  readonly path: Pick<PathPort, "directoryOf" | "join" | "resolve">;
  readonly repository: AbsolutePath;
}): BaselineCheckoutPort => ({
  read: (request) => {
    const commit = runGit({
      git: options.git,
      arguments: ["rev-parse", "--verify", "--short", `${request.revision}^{commit}`],
      cwd: options.repository,
    });
    if (commit.outcome === "failed") {
      return {
        outcome: "failed",
        error: { kind: "baseline-unchecked-out", command: commit.error },
      };
    }
    const directory = readWorktreeDirectory({
      ...options,
      segments: mapCommitToCheckoutSegments({ commit: commit.value.trim() }),
    });
    if (directory.outcome === "ok") return directory;
    return directory.error.kind === "command"
      ? {
          outcome: "failed",
          error: { kind: "baseline-unchecked-out", command: directory.error.command },
        }
      : { outcome: "failed", error: { kind: "baseline-unresolved", path: directory.error.path } };
  },
  write: (request) => {
    const added = runGit({
      git: options.git,
      arguments: ["worktree", "add", "--detach", request.directory, request.revision],
      cwd: options.repository,
    });
    return added.outcome === "failed"
      ? { outcome: "failed", error: { kind: "baseline-unchecked-out", command: added.error } }
      : { outcome: "ok", value: null };
  },
  remove: (request) => {
    const removed = removeWorktree({ ...options, directory: request.directory });
    return removed.outcome === "failed"
      ? {
          outcome: "failed",
          error: {
            kind: "baseline-unremoved",
            directory: request.directory,
            command: removed.error,
          },
        }
      : { outcome: "ok", value: null };
  },
});

export const createTargetCopyPort = (options: {
  readonly git: ExecutionPort<"captured", "none">;
  readonly path: Pick<PathPort, "directoryOf" | "join" | "resolve">;
}): TargetCopyPort => ({
  read: (request) => {
    const directory = readWorktreeDirectory({
      ...options,
      repository: request.repo,
      segments: mapPlaceToSegments({ place: request.place }),
    });
    if (directory.outcome === "ok") return directory;
    return directory.error.kind === "command"
      ? { outcome: "failed", error: { kind: "target-uncopied", command: directory.error.command } }
      : {
          outcome: "failed",
          error: { kind: "target-copy-unresolved", path: directory.error.path },
        };
  },
  write: (request) => {
    const added = runGit({
      git: options.git,
      arguments: ["worktree", "add", "--detach", request.directory, "HEAD"],
      cwd: request.repo,
    });
    return added.outcome === "failed"
      ? { outcome: "failed", error: { kind: "target-uncopied", command: added.error } }
      : { outcome: "ok", value: null };
  },
  remove: (request) => {
    const removed = removeWorktree({
      ...options,
      repository: request.repo,
      directory: request.directory,
    });
    return removed.outcome === "failed"
      ? {
          outcome: "failed",
          error: {
            kind: "target-copy-unremoved",
            directory: request.directory,
            command: removed.error,
          },
        }
      : { outcome: "ok", value: null };
  },
});

export const createTargetIndexPort = (options: {
  readonly git: ExecutionPort<"captured", "none">;
  readonly path: Pick<PathPort, "resolve">;
}): TargetIndexPort => ({
  read: (request) => {
    const index = runGit({
      git: options.git,
      arguments: ["rev-parse", "--path-format=absolute", "--git-path", TARGET_INDEX_NAME],
      cwd: request.repo,
    });
    if (index.outcome === "failed") {
      return { outcome: "failed", error: { kind: "target-index-unread", command: index.error } };
    }
    const resolved = options.path.resolve({ path: index.value.trim() });
    return resolved.outcome === "failed"
      ? { outcome: "failed", error: { kind: "target-index-unresolved", path: index.value.trim() } }
      : resolved;
  },
});

const readTree = (request: {
  readonly createGit: CreateGit;
  readonly repo: AbsolutePath;
  readonly index: AbsolutePath;
}): Result<string, CommandFailure> => {
  const indexGit = request.createGit({ indexFile: request.index });
  const head = runGit({ git: indexGit, arguments: ["read-tree", "HEAD"], cwd: request.repo });
  if (head.outcome === "failed") return head;
  const added = runGit({ git: indexGit, arguments: ["add", "--all"], cwd: request.repo });
  if (added.outcome === "failed") return added;
  const tree = runGit({ git: indexGit, arguments: ["write-tree"], cwd: request.repo });
  return tree.outcome === "failed" ? tree : { outcome: "ok", value: tree.value.trim() };
};

export const createTargetTreePort = (options: {
  readonly git: ExecutionPort<"captured", "none">;
  readonly createGit: CreateGit;
}): TargetTreePort => ({
  read: (request) => {
    const tree = readTree({
      createGit: options.createGit,
      repo: request.repo,
      index: request.index,
    });
    return tree.outcome === "failed"
      ? { outcome: "failed", error: { kind: "target-tree-unread", command: tree.error } }
      : tree;
  },
  write: (request) => {
    const written = runGit({
      git: options.git,
      arguments: ["read-tree", "-u", "--reset", request.tree],
      cwd: request.copy,
    });
    return written.outcome === "failed"
      ? { outcome: "failed", error: { kind: "target-tree-unwritten", command: written.error } }
      : { outcome: "ok", value: null };
  },
});
