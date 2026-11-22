import type { AbsolutePath } from "./absolute-path-types.ts";

type DriveLetter =
  | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
  | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z"
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

type Backslash = "\\";

type BeforeSeparator<Text extends string> = Text extends `${infer Head}${Backslash}${infer Rest}`
  ? Head extends `${string}/${string}`
    ? BeforeSlash<Text>
    : [Head, Rest]
  : BeforeSlash<Text>;

type BeforeSlash<Text extends string> = Text extends `${infer Head}/${infer Rest}` ? [Head, Rest] : never;

type Named<Part extends string> = Part extends "" ? never : Part;

type ShareRoot<Rest extends string> = [BeforeSeparator<Rest>] extends [never]
  ? never
  : BeforeSeparator<Rest> extends [infer Host extends string, infer Tail extends string]
    ? [Named<Host>] extends [never]
      ? never
      : [BeforeSeparator<Tail>] extends [never]
        ? never
        : BeforeSeparator<Tail> extends [infer Share extends string, string]
          ? [Named<Share>] extends [never]
            ? never
            : true
          : never
    : never;

type StaticShareRoot<Text extends string> = Text extends `${Backslash}${Backslash}${infer Rest}`
  ? [ShareRoot<Rest>] extends [never]
    ? never
    : Text
  : never;

type Written<Text extends string> = Text extends "" ? true : Text extends `${infer Character}${infer Rest}` ? (string extends Character ? false : Written<Rest>) : false;

export type StaticAbsoluteRoot<Text extends string> = Written<Text> extends true
  ? Text extends `/${string}` | `${DriveLetter}:${Backslash}${string}` | `${DriveLetter}:/${string}`
    ? Text
    : StaticShareRoot<Text>
  : never;

export const absoluteRootOf = <Text extends string>(text: StaticAbsoluteRoot<Text>): AbsolutePath => {
  const plain: string = text;
  return plain as AbsolutePath;
};
