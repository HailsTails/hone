import type { NamedFolderKind } from "../records/hone-records/named-folder-kind.ts";
import type { RuleSetName } from "../rule-set/identifier-types.ts";
import type { RepoPath } from "./repo-path-types.ts";

type Backslash = "\\";

type DriveLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

type UnwalkableSegment = "" | "." | "..";

type Written<Text extends string> = Text extends ""
  ? true
  : Text extends `${infer Character}${infer Rest}`
    ? string extends Character
      ? false
      : Written<Rest>
    : false;

type WalkableSegments<Text extends string> = Text extends `${infer Segment}/${infer Rest}`
  ? Segment extends UnwalkableSegment
    ? never
    : WalkableSegments<Rest>
  : Text extends UnwalkableSegment
    ? never
    : Text;

type OutsideTheRepository =
  | `/${string}`
  | `${DriveLetter}:${string}`
  | `${string}${Backslash}${string}`
  | `${string}\n${string}`
  | `${string}\r${string}`
  | `${string}\0${string}`;

export type StaticRepoPath<Text extends string> =
  Written<Text> extends true
    ? Text extends OutsideTheRepository
      ? never
      : [WalkableSegments<Text>] extends [never]
        ? never
        : Text
    : never;

const brandedAsRepoPath = (text: string): RepoPath => text as RepoPath;

export const repoPathOf = <Text extends string>(text: StaticRepoPath<Text>): RepoPath => {
  const plain: string = text;
  return brandedAsRepoPath(plain);
};

export const repoPathBeneath = (request: {
  readonly parent: RepoPath;
  readonly segment: RuleSetName | NamedFolderKind;
}): RepoPath => brandedAsRepoPath(`${request.parent}/${request.segment}`);
