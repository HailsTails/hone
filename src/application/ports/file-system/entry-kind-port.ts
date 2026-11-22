export type EntryKind = "file" | "directory" | "absent";

export type EntryKindPort = {
  readonly kindOf: (request: { readonly path: string }) => EntryKind;
};
