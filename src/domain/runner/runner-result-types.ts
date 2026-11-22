import type { Anchor } from "../finding/anchor.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";

export type Remedy = {
  readonly fix: string;
  readonly page: string;
  readonly section: string;
};

export type MeasuredPair = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
};

export type Hit = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
  readonly anchor: Anchor;
  readonly snippet: string;
  readonly remedy?: Remedy;
  readonly importSpecifier?: string;
  readonly check?: string;
};

export type InlineReach = "one-clause" | "every-selected-clause";

export type ScriptOptionCause =
  | { readonly kind: "weakens-run" }
  | {
      readonly kind: "after-another-command";
      readonly command: string;
      readonly invocation: string;
    }
  | { readonly kind: "wrapped"; readonly command: string; readonly wrapper: string }
  | { readonly kind: "unreadable"; readonly command: string };

export type NativeException =
  | {
      readonly kind: "ignore";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
    }
  | {
      readonly kind: "config-override";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
    }
  | {
      readonly kind: "suppression-entry";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly location: RepoPath;
    }
  | {
      readonly kind: "inline-disable";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly line: number;
      readonly text: string;
      readonly reach: InlineReach;
    }
  | {
      readonly kind: "inline-rule-config";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly line: number;
      readonly text: string;
    }
  | {
      readonly kind: "command-line-option";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly location: RepoPath;
      readonly script: string;
      readonly option: string;
      readonly cause: ScriptOptionCause;
    };

export type InlineDisable = Extract<NativeException, { readonly kind: "inline-disable" }>;

export type ProjectionState = "current" | "out-of-date" | "missing" | "not-included";

export type CaseVerdict = {
  readonly caseName: string;
  readonly flaggedLines: readonly number[];
};

export type ProjectionWrite = {
  readonly path: RepoPath;
  readonly effect: "written" | "unchanged" | "removed" | "left-in-place";
};
