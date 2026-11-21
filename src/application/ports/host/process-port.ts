export type ExitCode = 0 | 1 | 2 | 3;

export type ProcessPort = {
  readonly arguments: readonly string[];
  readonly writeOut: (request: { readonly text: string }) => void;
  readonly writeError: (request: { readonly text: string }) => void;
  readonly exitWith: (request: { readonly code: ExitCode }) => void;
};
