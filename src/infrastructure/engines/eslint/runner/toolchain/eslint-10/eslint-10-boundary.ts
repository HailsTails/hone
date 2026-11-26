import { type EslintMajorBoundary, PROJECTION_TYPE_TEXT } from "../eslint-major-boundary.ts";

export const eslintBoundary: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  projectionTypeText: PROJECTION_TYPE_TEXT,
  reportDataOf: (request) => request.descriptor.data,
};
