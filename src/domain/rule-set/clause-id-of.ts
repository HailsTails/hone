import type { ClauseId } from "./identifier-types.ts";

type LowercaseLetter =
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
  | "z";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type OnlyNameCharacters<Text extends string> = Text extends ""
  ? Text
  : Text extends `${LowercaseLetter | Digit | "-"}${infer Rest}`
    ? OnlyNameCharacters<Rest>
    : never;

export type StaticClauseId<Text extends string> = string extends Text
  ? never
  : Text extends `${LowercaseLetter}${infer Rest}`
    ? [OnlyNameCharacters<Rest>] extends [never]
      ? never
      : Text
    : never;

export const clauseIdOf = <Text extends string>(text: StaticClauseId<Text>): ClauseId => {
  const plain: string = text;
  return plain as ClauseId;
};
