import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { CommandFailure } from "./command-failure.ts";

export type TargetTreeFailure = {
  readonly kind: "target-tree-unread";
  readonly command: CommandFailure;
};

export type TargetTreeWriteFailure = {
  readonly kind: "target-tree-unwritten";
  readonly command: CommandFailure;
};

export type TargetTreePort = {
  readonly read: (request: {
    readonly repo: AbsolutePath;
    readonly index: AbsolutePath;
  }) => Result<string, TargetTreeFailure>;
  readonly write: (request: {
    readonly copy: AbsolutePath;
    readonly tree: string;
  }) => Result<null, TargetTreeWriteFailure>;
};
