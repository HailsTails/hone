export type CommandFailure =
  | { readonly kind: "exited"; readonly status: number; readonly output: string }
  | { readonly kind: "unlaunched"; readonly detail: string };
