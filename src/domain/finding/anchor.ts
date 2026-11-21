export type AnchorKind =
  | { readonly kind: "keyword"; readonly keyword: string }
  | { readonly kind: "file" };

export type Anchor = { readonly line: number; readonly column: number };
