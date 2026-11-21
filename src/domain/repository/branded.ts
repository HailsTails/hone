declare const brandName: unique symbol;

export type Branded<Base, Name extends string> = Base & { readonly [brandName]: Name };
