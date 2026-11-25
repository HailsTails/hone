import type { Rule } from "./eslint-instance.ts";

export const PROJECTION_DECLARATION_TEXT = `declare const projection: {
  name: string;
  files: string[];
  ignores?: string[];
  plugins?: Record<string, object>;
  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;
}[];
export default projection;
`;

export type ReportDataValue = string | number | bigint | boolean | null | undefined;

export type ReportData = Readonly<Record<string, ReportDataValue>>;

export type NearestLookupOptions = { readonly flags: readonly string[] };

export type EslintMajorBoundary = {
  readonly nearestLookup: NearestLookupOptions;
  readonly reportDataOf: (request: {
    readonly descriptor: Rule.ReportDescriptor;
  }) => ReportData | undefined;
  readonly declarationText: string;
};
