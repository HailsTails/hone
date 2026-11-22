import { type EslintMajorBoundary, PROJECTION_DECLARATION_TEXT } from "../eslint-major-boundary.ts";

export const eslintBoundary: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  declarationText: PROJECTION_DECLARATION_TEXT,
  reportDataOf: (request) => request.descriptor.data,
};
