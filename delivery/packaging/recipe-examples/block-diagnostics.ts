import type { BlockTypeError } from "./block-verdicts-port.ts";
import type { ExampleBlock } from "./example-block.ts";

export type BlockFile = { readonly block: ExampleBlock; readonly path: string };

export type Diagnostic = { readonly path: string | undefined; readonly message: string };

const mapDiagnosticToTypeError = (request: {
  readonly diagnostic: Diagnostic;
  readonly files: readonly BlockFile[];
}): BlockTypeError => {
  const { path, message } = request.diagnostic;
  const file = request.files.find((candidate) => candidate.path === path);
  if (file !== undefined) {
    return { kind: "in-a-block", block: file.block, message };
  }
  return {
    kind: "outside-the-blocks",
    message: path === undefined ? message : `${path}: ${message}`,
  };
};

export const mapDiagnosticsToTypeErrors = (request: {
  readonly diagnostics: readonly Diagnostic[];
  readonly files: readonly BlockFile[];
}): readonly BlockTypeError[] =>
  request.diagnostics.map((diagnostic) => mapDiagnosticToTypeError({ ...request, diagnostic }));
