import type { ReadonlyJsonValue } from "./json-value.ts";

export type JsonKind = "string" | "number" | "boolean" | "null" | "array" | "object";

export type JsonSameness = "same" | "different";

export const JSON_KIND_NAMES: Readonly<Record<JsonKind, string>> = {
  string: "a string",
  number: "a number",
  boolean: "a boolean",
  null: "null",
  array: "an array",
  object: "an object",
};

type JsonObject = { readonly [key: string]: ReadonlyJsonValue };

export const jsonKindOf = (request: { readonly value: ReadonlyJsonValue }): JsonKind => {
  if (request.value === null) return "null";
  if (Array.isArray(request.value)) return "array";
  const kind = typeof request.value;
  if (kind === "string" || kind === "number" || kind === "boolean") return kind;
  return "object";
};

const isJsonObject = (candidate: ReadonlyJsonValue): candidate is JsonObject =>
  jsonKindOf({ value: candidate }) === "object";

const sameItems = (request: {
  readonly left: readonly ReadonlyJsonValue[];
  readonly right: readonly ReadonlyJsonValue[];
}): JsonSameness =>
  request.left.length === request.right.length &&
  request.left.every(
    (leftItem, position) =>
      sameJsonValue({ left: leftItem, right: request.right[position] }) === "same",
  )
    ? "same"
    : "different";

const sameObjects = (request: {
  readonly left: JsonObject;
  readonly right: JsonObject;
}): JsonSameness =>
  Object.keys(request.left).length === Object.keys(request.right).length &&
  Object.entries(request.left).every(
    ([key, leftEntry]) =>
      Object.hasOwn(request.right, key) &&
      sameJsonValue({ left: leftEntry, right: request.right[key] }) === "same",
  )
    ? "same"
    : "different";

export const sameJsonValue = (request: {
  readonly left: ReadonlyJsonValue;
  readonly right: ReadonlyJsonValue | undefined;
}): JsonSameness => {
  const { left, right } = request;
  if (right === undefined || jsonKindOf({ value: left }) !== jsonKindOf({ value: right }))
    return "different";
  if (Array.isArray(left) && Array.isArray(right)) return sameItems({ left, right });
  if (isJsonObject(left) && isJsonObject(right)) return sameObjects({ left, right });
  return left === right ? "same" : "different";
};
