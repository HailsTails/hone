export type Equal<A, B> =
  (<Probe>() => Probe extends A ? 1 : 2) extends <Probe>() => Probe extends B ? 1 : 2
    ? true
    : false;

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type DeepReadonly<Value> = unknown extends Value
  ? Value
  : Value extends Primitive | ((...callArguments: never[]) => unknown)
    ? Value
    : Value extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> };

export type DeepReadonlyKeepingTuples<Value> = unknown extends Value
  ? Value
  : Value extends Primitive | ((...callArguments: never[]) => unknown)
    ? Value
    : Value extends readonly [unknown, ...unknown[]]
      ? { readonly [Key in keyof Value]: DeepReadonlyKeepingTuples<Value[Key]> }
      : Value extends readonly (infer Item)[]
        ? readonly DeepReadonlyKeepingTuples<Item>[]
        : { readonly [Key in keyof Value]: DeepReadonlyKeepingTuples<Value[Key]> };
