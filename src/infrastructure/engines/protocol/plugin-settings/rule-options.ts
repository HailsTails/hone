import { z } from "zod";

import { editionReaches } from "../../../../domain/rule-set/edition-reach.ts";
import type { Edition } from "../../../../domain/rule-set/edition-types.ts";
import type { JsonValue } from "../../../../domain/settings/json-values/json-value.ts";
import { editionSchema } from "../../../content-files/edition.ts";

type OptionArguments = readonly JsonValue[];

export const ruleOptionsSchema = z.array(z.json()).readonly();

export const optionsByEditionSchema = z
  .record(z.string(), ruleOptionsSchema)
  .transform((options) => new Map(Object.entries(options)))
  .pipe(z.map(editionSchema, ruleOptionsSchema))
  .readonly();

export const ruleOptionsOf = (request: {
  readonly settings: {
    readonly options?: OptionArguments;
    readonly optionsByEdition?: ReadonlyMap<Edition, OptionArguments>;
  };
  readonly edition: Edition;
}): OptionArguments => {
  const { settings, edition } = request;
  const reached = [...(settings.optionsByEdition ?? [])]
    .filter(([introducedIn]) => editionReaches({ edition, introducedIn }) === "reached")
    .reduce<readonly [Edition, OptionArguments] | undefined>((latest, candidate) => {
      if (latest === undefined) return candidate;
      return editionReaches({ edition: candidate[0], introducedIn: latest[0] }) === "reached"
        ? candidate
        : latest;
    }, undefined);
  return reached?.[1] ?? settings.options ?? [];
};
