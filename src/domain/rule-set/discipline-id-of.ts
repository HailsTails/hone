import type { DisciplineId } from "./identifier-types.ts";

type UppercaseLetter =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

type LowercaseLetter =
  | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
  | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type OnlyDigits<Text extends string> = Text extends "" ? Text : Text extends `${Digit}${infer Rest}` ? OnlyDigits<Rest> : never;

type NonEmpty<Text extends string> = Text extends "" ? never : Text;

type NumberedWithOptionalLetter<Text extends string> = Text extends `${infer Number}${LowercaseLetter}`
  ? [OnlyDigits<NonEmpty<Number>>] extends [never]
    ? never
    : Text
  : [OnlyDigits<NonEmpty<Text>>] extends [never]
    ? never
    : Text;

type UppercasePrefix<Text extends string> = Text extends `${UppercaseLetter}${UppercaseLetter}${infer Rest}`
  ? Rest extends ""
    ? Text
    : Rest extends `${UppercaseLetter}${infer Last}`
      ? Last extends "" | UppercaseLetter
        ? Text
        : never
      : never
  : never;

export type StaticDisciplineId<Text extends string> = string extends Text
  ? never
  : Text extends `${infer Prefix}-${infer Numbered}`
    ? [UppercasePrefix<Prefix>] extends [never]
      ? never
      : [NumberedWithOptionalLetter<Numbered>] extends [never]
        ? never
        : Text
    : never;

export const disciplineIdOf = <Text extends string>(text: StaticDisciplineId<Text>): DisciplineId => {
  const plain: string = text;
  return plain as DisciplineId;
};
