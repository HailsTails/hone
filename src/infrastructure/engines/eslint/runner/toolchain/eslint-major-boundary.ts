import type { Rule } from "./eslint-instance.ts";

export const PROJECTION_DECLARATION_TEXT = `import type { Linter } from ${JSON.stringify("eslint")};\ndeclare const projection: Linter.Config[];\nexport default projection;\n`;

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
