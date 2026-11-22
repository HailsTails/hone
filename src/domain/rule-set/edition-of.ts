import type { Edition } from "./edition-types.ts";

type NonZeroDigit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type Digit = "0" | NonZeroDigit;

type OnlyDigits<Text extends string> = Text extends "" ? Text : Text extends `${Digit}${infer Rest}` ? OnlyDigits<Rest> : never;

export type StaticEdition<Text extends string> = string extends Text
  ? never
  : Text extends `${NonZeroDigit}${infer Rest}`
    ? [OnlyDigits<Rest>] extends [never]
      ? never
      : Text
    : never;

export const editionOf = <Text extends string>(text: StaticEdition<Text>): Edition => {
  const plain: string = text;
  return plain as Edition;
};
