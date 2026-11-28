import type {
  AuthorisedLocation,
  CarriedListing,
  CatalogueNote,
  HoneRecord,
  PlacedRecord,
} from "./hone-record.ts";

const reachNotesOf = (request: {
  readonly record: AuthorisedLocation;
}): readonly CatalogueNote[] => {
  const { record } = request;
  return record.reach.reaches === "unknown-check"
    ? [{ kind: "unknown-check", symptom: record.symptom, check: record.reach.check }]
    : [];
};

const owingNotesOf = (request: {
  readonly record: AuthorisedLocation;
}): readonly CatalogueNote[] => {
  const { holding } = request.record;
  return holding.held === "stated" && holding.owing.matches === "not-the-catalogue"
    ? [holding.owing.note]
    : [];
};

export const catalogueNotesOf = (request: {
  readonly record: AuthorisedLocation;
}): readonly CatalogueNote[] => [...reachNotesOf(request), ...owingNotesOf(request)];

const carriedOf = (request: {
  readonly record: HoneRecord;
}): readonly Omit<CarriedListing, "place">[] => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return record.holding.held === "carried"
        ? [{ lacks: record.holding.lacks, standing: record.holding.standing }]
        : [];
    case "deviation":
    case "dependency-record":
      return [];
  }
};

export const carriedListingOf = (request: {
  readonly records: readonly PlacedRecord[];
}): readonly CarriedListing[] =>
  request.records.flatMap(({ place, record }) =>
    carriedOf({ record }).map((carried) => ({ place, ...carried })),
  );
