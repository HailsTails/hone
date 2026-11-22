import type { Branded } from "../repository/branded.ts";
import type { StaticRuleSetName } from "../rule-set/rule-set-name-of.ts";

export const CATALOGUE_NAME = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";

const WHOLE_CATALOGUE_NAME = new RegExp(`^${CATALOGUE_NAME}$`);

export type CatalogueName = Branded<string, "CatalogueName">;

type StaticCatalogueName<Text extends string> = Text extends `${string}--${string}` | `${string}-`
  ? never
  : StaticRuleSetName<Text>;

export function catalogueNameOf<Text extends string>(
  text: StaticCatalogueName<Text>,
): CatalogueName;
export function catalogueNameOf(text: string): string {
  return text;
}

export const isCatalogueName = (text: string): text is CatalogueName =>
  WHOLE_CATALOGUE_NAME.test(text);
