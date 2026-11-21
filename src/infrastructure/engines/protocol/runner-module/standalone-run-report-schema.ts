import { z } from "zod";
import { inlineDisableSchema } from "../embedded/embedded-run-report-schema.ts";
import { hitSchema, measuredSchema } from "./runner-result-schema.ts";

const STANDALONE_RUN_SHAPE_MESSAGE = "a standalone run's value is { hits, nativeExceptions }, not a bare list of hits";

export const standaloneRunReportSchema = z
  .object(
    {
      hits: z.array(hitSchema).readonly(),
      nativeExceptions: z.array(inlineDisableSchema).readonly(),
      measured: measuredSchema,
    },
    { error: STANDALONE_RUN_SHAPE_MESSAGE },
  )
  .readonly();

export type StandaloneRunReport = z.infer<typeof standaloneRunReportSchema>;
