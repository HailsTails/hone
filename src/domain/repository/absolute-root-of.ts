import type { AbsolutePath } from "./absolute-path-types.ts";

type DriveLetter =
  | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
  | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z"
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

type Backslash = "\\";

export type AbsoluteRootText = `/${string}` | `${DriveLetter}:${Backslash}${string}` | `${DriveLetter}:/${string}` | `${Backslash}${Backslash}${string}`;

export type StaticAbsoluteRoot<Text extends string> = string extends Text ? never : Text extends AbsoluteRootText ? Text : never;

export const absoluteRootOf = <Text extends string>(text: StaticAbsoluteRoot<Text>): AbsolutePath => {
  const plain: string = text;
  return plain as AbsolutePath;
};
