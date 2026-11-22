import type { RepoPath } from "./repo-path-types.ts";

type Backslash = "\\";

type DriveLetter =
  | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
  | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z"
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

type UnwalkableSegment = "" | "." | "..";

type Written<Text extends string> = Text extends "" ? true : Text extends `${infer Character}${infer Rest}` ? (string extends Character ? false : Written<Rest>) : false;

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

export type StaticRepoPath<Text extends string> = Written<Text> extends true
  ? Text extends OutsideTheRepository
    ? never
    : [WalkableSegments<Text>] extends [never]
      ? never
      : Text
  : never;

export const repoPathOf = <Text extends string>(text: StaticRepoPath<Text>): RepoPath => {
  const plain: string = text;
  return plain as RepoPath;
};
