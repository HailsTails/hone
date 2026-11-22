import { z } from "zod";

import {
  REPORT_OUTPUTS,
  type ReportOutput,
  VERSION_TWO_REPORT_OUTPUTS,
  type VersionTwoReportOutput,
} from "../../domain/settings/report-output.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const reportOutputSchema = z.enum(REPORT_OUTPUTS);

export const versionTwoReportOutputSchema = z.enum(VERSION_TWO_REPORT_OUTPUTS);

export const isReportOutputSchemaEqual: Equal<
  z.output<typeof reportOutputSchema>,
  ReportOutput
> = true;
export const isVersionTwoReportOutputSchemaEqual: Equal<
  z.output<typeof versionTwoReportOutputSchema>,
  VersionTwoReportOutput
> = true;
