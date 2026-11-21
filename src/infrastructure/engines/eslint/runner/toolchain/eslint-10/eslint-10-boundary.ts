import type { EslintMajorBoundary } from "../eslint-major-boundary.ts";

const DECLARATION_TEXT = `import type { Linter } from ${JSON.stringify("eslint")};\ndeclare const projection: Linter.Config[];\nexport default projection;\n`;

export const eslintBoundary: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  declarationText: DECLARATION_TEXT,
  reportDataOf: (request) => request.descriptor.data,
};
