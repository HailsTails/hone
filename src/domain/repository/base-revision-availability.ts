export type BaseRevisionAvailability =
  | { readonly state: "not-given" }
  | { readonly state: "git-failed"; readonly revision: string; readonly gitMessage: string };
