import { z } from "zod";
import type { Branded } from "../../domain/repository/branded.ts";

export const brandedTextSchema = <Brand extends Branded<string, string>>(request: {
  readonly text: z.ZodType<string, string>;
  readonly isBranded: (text: string) => text is Brand;
  readonly refusal: string;
}) =>
  request.text.transform((text, context): Brand => {
    if (request.isBranded(text)) {
      return text;
    }
    context.addIssue({ code: "custom", message: request.refusal });
    return z.NEVER;
  });
