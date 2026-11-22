export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ReadonlyJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly ReadonlyJsonValue[]
  | { readonly [key: string]: ReadonlyJsonValue };
