export type OwedPoint = { readonly kind: "rule" | "principle"; readonly name: string };

export const compareOwedPoints = (request: {
  readonly left: OwedPoint;
  readonly right: OwedPoint;
}): "same" | "different" =>
  request.left.kind === request.right.kind && request.left.name === request.right.name
    ? "same"
    : "different";

export const findOwedPoint = <Owed>(request: {
  readonly owes: readonly Owed[];
  readonly point: OwedPoint;
  readonly mapOwedToPoint: (owed: Owed) => OwedPoint;
}): Owed | undefined =>
  request.owes.find(
    (owed) =>
      compareOwedPoints({ left: request.mapOwedToPoint(owed), right: request.point }) === "same",
  );

export const mapPointsToUnowed = (request: {
  readonly owes: readonly OwedPoint[];
  readonly points: readonly OwedPoint[];
}): readonly OwedPoint[] =>
  request.points.filter(
    (point) =>
      findOwedPoint({ owes: request.owes, point, mapOwedToPoint: (owed) => owed }) === undefined,
  );

export const createUnowedPointFault = (request: {
  readonly symptom: string;
  readonly owing: string;
  readonly point: OwedPoint;
}): string =>
  `${request.symptom} points ${request.owing} at ${request.point.name}, which ${request.owing} does not owe`;

export const findUnowedPointFaults = (request: {
  readonly symptom: string;
  readonly owing: { readonly name: string; readonly owes: readonly OwedPoint[] };
  readonly points: readonly OwedPoint[];
}): readonly string[] =>
  mapPointsToUnowed({ owes: request.owing.owes, points: request.points }).map((point) =>
    createUnowedPointFault({ symptom: request.symptom, owing: request.owing.name, point }),
  );
