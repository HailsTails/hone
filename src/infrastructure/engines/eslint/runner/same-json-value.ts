export type JsonComparison = "same" | "different";

type JsonScalar = string | number | boolean | null;

type JsonShape =
  | { readonly shape: "scalar"; readonly scalar: JsonScalar }
  | { readonly shape: "list"; readonly items: readonly unknown[] }
  | { readonly shape: "record"; readonly entries: readonly (readonly [string, unknown])[] }
  | { readonly shape: "opaque" };

const scalarOf = (candidate: unknown): JsonScalar | undefined =>
  candidate === null ||
  typeof candidate === "string" ||
  typeof candidate === "number" ||
  typeof candidate === "boolean"
    ? candidate
    : undefined;

const plainPrototype = (candidate: object): "plain" | "instance" => {
  const prototype: unknown = Object.getPrototypeOf(candidate);
  return prototype === Object.prototype || prototype === null ? "plain" : "instance";
};

const byKey = (left: readonly [string, unknown], right: readonly [string, unknown]): number =>
  left[0].localeCompare(right[0], "en");

const recordShapeOf = (candidate: object): JsonShape => {
  const entries: readonly (readonly [string, unknown])[] = Object.entries(candidate);
  return { shape: "record", entries: [...entries].sort(byKey) };
};

const objectShapeOf = (candidate: object): JsonShape => {
  if (Array.isArray(candidate)) {
    const items: readonly unknown[] = Array.from(candidate);
    return { shape: "list", items };
  }
  return plainPrototype(candidate) === "plain" ? recordShapeOf(candidate) : { shape: "opaque" };
};

const jsonShapeOf = (candidate: unknown): JsonShape => {
  const scalar = scalarOf(candidate);
  if (scalar !== undefined) {
    return { shape: "scalar", scalar };
  }
  return typeof candidate === "object" && candidate !== null
    ? objectShapeOf(candidate)
    : { shape: "opaque" };
};

const sameLists = (request: {
  readonly left: readonly unknown[];
  readonly right: readonly unknown[];
}): JsonComparison =>
  request.left.length === request.right.length &&
  request.left.every(
    (element, index) => sameJsonValue({ left: element, right: request.right[index] }) === "same",
  )
    ? "same"
    : "different";

const sameEntry = (request: {
  readonly left: readonly [string, unknown];
  readonly right: readonly [string, unknown] | undefined;
}): JsonComparison =>
  request.right !== undefined && request.left[0] === request.right[0]
    ? sameJsonValue({ left: request.left[1], right: request.right[1] })
    : "different";

const sameRecords = (request: {
  readonly left: readonly (readonly [string, unknown])[];
  readonly right: readonly (readonly [string, unknown])[];
}): JsonComparison =>
  request.left.length === request.right.length &&
  request.left.every(
    (entry, index) => sameEntry({ left: entry, right: request.right[index] }) === "same",
  )
    ? "same"
    : "different";

const sameShapes = (request: {
  readonly left: JsonShape;
  readonly right: JsonShape;
}): JsonComparison => {
  const { left, right } = request;
  if (left.shape === "scalar" && right.shape === "scalar") {
    return Object.is(left.scalar, right.scalar) ? "same" : "different";
  }
  if (left.shape === "list" && right.shape === "list") {
    return sameLists({ left: left.items, right: right.items });
  }
  if (left.shape === "record" && right.shape === "record") {
    return sameRecords({ left: left.entries, right: right.entries });
  }
  return "different";
};

export const sameJsonValue = (request: {
  readonly left: unknown;
  readonly right: unknown;
}): JsonComparison =>
  sameShapes({ left: jsonShapeOf(request.left), right: jsonShapeOf(request.right) });
