export type GitFailure = {
  readonly kind: "git-failed";
  readonly command: string;
  readonly detail: string;
};
