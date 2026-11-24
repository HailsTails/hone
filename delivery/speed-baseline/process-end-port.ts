export type ProcessEndPort = {
  readonly run: (request: { readonly listener: () => void }) => void;
};
