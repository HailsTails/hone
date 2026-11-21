import { describe, expect, it } from "vitest";
import type { Branded } from "../../../../domain/repository/branded.ts";
import type { DeepReadonly, DeepReadonlyKeepingTuples, Equal } from "./type-equality.ts";

describe("Equal", () => {
  it("is true for two identical object types", () => {
    const identical: Equal<
      { readonly name: string },
      { readonly name: string }
    > = true;
    expect(identical).toBe(true);
  });

  it("is false for a readonly array against a mutable one", () => {
    const readonlyArray: Equal<readonly string[], string[]> = false;
    expect(readonlyArray).toBe(false);
  });
});

describe("Equal over DeepReadonlyKeepingTuples of a parsed shape, against a declared non-empty tuple", () => {
  it("is true when the declared type keeps a non-empty tuple that DeepReadonly would widen to an array", () => {
    const keptTuple: Equal<DeepReadonlyKeepingTuples<{ ids: [string, ...string[]] }>, { readonly ids: readonly [string, ...string[]] }> = true;
    const widenedTuple: Equal<DeepReadonly<{ ids: [string, ...string[]] }>, { readonly ids: readonly [string, ...string[]] }> = false;
    expect([keptTuple, widenedTuple]).toEqual([true, false]);
  });
});

describe("Equal over DeepReadonly of a parsed shape, against a declared readonly type", () => {
  it("is true when the declared type is the parsed shape made readonly all the way down", () => {
    const sameShape: Equal<
      DeepReadonly<{ outer: { lines: number[]; settings: unknown; path: Branded<string, "Path"> } }>,
      { readonly outer: { readonly lines: readonly number[]; readonly settings: unknown; readonly path: Branded<string, "Path"> } }
    > = true;
    expect(sameShape).toBe(true);
  });

  it("is false when unknown is declared as an empty object", () => {
    const unknownAsEmpty: Equal<DeepReadonly<{ settings: unknown }>, { readonly settings: Record<never, never> }> = false;
    expect(unknownAsEmpty).toBe(false);
  });

  it("is false when a function type changes", () => {
    const changedFunction: Equal<
      DeepReadonly<{ read: (request: { readonly path: string }) => string }>,
      { readonly read: (request: { readonly path: string }) => number }
    > = false;
    expect(changedFunction).toBe(false);
  });

  it("is false when the declared type drops a readonly", () => {
    const droppedReadonly: Equal<DeepReadonly<{ outer: { line: number } }>, { readonly outer: { line: number } }> = false;
    expect(droppedReadonly).toBe(false);
  });

  it("is false when a field's type changes", () => {
    const changedField: Equal<DeepReadonly<{ line: number }>, { readonly line: string }> = false;
    expect(changedField).toBe(false);
  });

  it("is false when the declared type adds an optional field", () => {
    const addedOptional: Equal<DeepReadonly<{ name: string }>, { readonly name: string; readonly note?: string }> = false;
    expect(addedOptional).toBe(false);
  });

  it("is false when the declared type loses a brand", () => {
    const lostBrand: Equal<DeepReadonly<{ path: Branded<string, "Path"> }>, { readonly path: string }> = false;
    expect(lostBrand).toBe(false);
  });
});
