import type { EslintMajorBoundary, ReportData } from "../src/infrastructure/engines/eslint/runner/toolchain/eslint-major-boundary.ts";

export const STUB_DECLARATION_TEXT = "declare const projection: readonly unknown[];\nexport default projection;\n";

export const boundaryReporting = (request: { readonly data: ReportData | undefined }): EslintMajorBoundary => ({
  nearestLookup: { flags: [] },
  reportDataOf: () => request.data,
  declarationText: STUB_DECLARATION_TEXT,
});

export const boundaryWithLookupFlags = (request: { readonly flags: readonly string[] }): EslintMajorBoundary => ({
  nearestLookup: { flags: request.flags },
  reportDataOf: () => undefined,
  declarationText: STUB_DECLARATION_TEXT,
});

export const SILENT_BOUNDARY: EslintMajorBoundary = boundaryReporting({ data: undefined });
