import { moduleFileForm } from "../../../../../application/ports/host/module-extension.ts";
import { isRepoPathText } from "../../../../../domain/repository/repo-path.ts";
import { z } from "zod";
import { TYPE_DIRECTIVES } from "./type-directives.ts";

export const walkerPieceSettingsSchema = z
  .object({
    module: z
      .string()
      .refine(
        (text) => moduleFileForm({ text }) === "module-file" && isRepoPathText({ text }) === "repo-path",
        "the module is not a path inside the piece folder ending .ts, or .js in a built install",
      ),
    escapingDirectives: z.array(z.enum(TYPE_DIRECTIVES)).readonly().optional(),
  })
  .readonly();

export type WalkerPieceSettings = z.infer<typeof walkerPieceSettingsSchema>;
