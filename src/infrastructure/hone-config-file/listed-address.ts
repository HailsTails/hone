import { z } from "zod";

import { type ListedAddress, listedAddressOf } from "../../domain/settings/listed-address.ts";

const NOT_A_LISTED_ADDRESS = "is not a check address of the form [<ruleSet>/]<symptom>#<check>";

export const listedAddressSchema = z.string().transform((text, context): ListedAddress => {
  const address = listedAddressOf({ text });
  if (address === undefined) {
    context.addIssue({ code: "custom", message: NOT_A_LISTED_ADDRESS });
    return z.NEVER;
  }
  return address;
});
