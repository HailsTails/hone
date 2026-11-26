import { z } from "zod";

import {
  type EslintMajorBoundary,
  PROJECTION_TYPE_TEXT,
  type ReportData,
  type ReportDataValue,
} from "../eslint-major-boundary.ts";

const NEAREST_LOOKUP_FLAG = "v10_config_lookup_from_file";

const reportDataValueSchema = z.union([
  z.string(),
  z.number(),
  z.bigint(),
  z.boolean(),
  z.null(),
  z.undefined(),
]);

const reportDataValueOf = (request: { readonly candidate: unknown }): ReportDataValue => {
  const parsed = reportDataValueSchema.safeParse(request.candidate);
  return parsed.success ? parsed.data : String(request.candidate);
};

const reportDataFrom = (request: {
  readonly data: Readonly<Record<string, unknown>>;
}): ReportData =>
  Object.fromEntries(
    Object.entries(request.data).map(([name, candidate]) => [
      name,
      reportDataValueOf({ candidate }),
    ]),
  );

export const eslintBoundary: EslintMajorBoundary = {
  nearestLookup: { flags: [NEAREST_LOOKUP_FLAG] },
  projectionTypeText: PROJECTION_TYPE_TEXT,
  reportDataOf: (request) =>
    request.descriptor.data === undefined
      ? undefined
      : reportDataFrom({ data: request.descriptor.data }),
};
