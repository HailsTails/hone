export type ReplyPort = {
  readonly write: (request: { readonly text: string }) => void;
};
