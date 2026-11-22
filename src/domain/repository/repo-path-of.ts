import type { RepoPath } from "./repo-path-types.ts";

type Backslash = "\\";

type UnwalkableSegment = "" | "." | "..";

type WalkableSegments<Text extends string> = Text extends `${infer Segment}/${infer Rest}`
  ? Segment extends UnwalkableSegment
    ? never
    : WalkableSegments<Rest>
  : Text extends UnwalkableSegment
    ? never
    : Text;

type OutsideTheRepository = `/${string}` | `${string}${Backslash}${string}` | `${string}:${string}` | `${string}\n${string}` | `${string}\r${string}` | `${string}\0${string}`;

export type StaticRepoPath<Text extends string> = string extends Text
  ? never
  : Text extends OutsideTheRepository
    ? never
    : [WalkableSegments<Text>] extends [never]
      ? never
      : Text;

export const repoPathOf = <Text extends string>(text: StaticRepoPath<Text>): RepoPath => {
  const plain: string = text;
  return plain as RepoPath;
};
