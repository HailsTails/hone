import type {
  AuthorisedLocation,
  AuthorisedReach,
  Debt,
  HoneRecord,
  OutsideParty,
} from "./hone-record.ts";

export type Sameness = "same" | "different";

const sameOutsideParty = (request: {
  readonly left: OutsideParty;
  readonly right: OutsideParty;
}): Sameness => {
  const { left, right } = request;
  switch (left.kind) {
    case "package":
      return right.kind === "package" && right.dependency === left.dependency
        ? "same"
        : "different";
    case "scheme-module":
      return right.kind === "scheme-module" && right.specifier === left.specifier
        ? "same"
        : "different";
    case "runtime":
      return right.kind === "runtime" && right.facility === left.facility ? "same" : "different";
  }
};

const sameReach = (request: {
  readonly left: AuthorisedReach;
  readonly right: AuthorisedReach;
}): Sameness => {
  const { left, right } = request;
  switch (left.reaches) {
    case "whole-symptom":
      return right.reaches === "whole-symptom" ? "same" : "different";
    case "one-check":
      return right.reaches === "one-check" && right.check.name === left.check.name
        ? "same"
        : "different";
    case "unknown-check":
      return right.reaches === "unknown-check" && right.check === left.check ? "same" : "different";
  }
};

const sameSymptomSite = (request: {
  readonly left: Debt | AuthorisedLocation;
  readonly right: HoneRecord;
}): Sameness => {
  const { left, right } = request;
  return (right.kind === "debt" || right.kind === "authorised-location") &&
    right.kind === left.kind &&
    right.symptom.name === left.symptom.name &&
    sameReach({ left: left.reach, right: right.reach }) === "same" &&
    right.file === left.file
    ? "same"
    : "different";
};

export const sameRecordIdentity = (request: {
  readonly left: HoneRecord;
  readonly right: HoneRecord;
}): Sameness => {
  const { left, right } = request;
  switch (left.kind) {
    case "debt":
    case "authorised-location":
      return sameSymptomSite({ left, right });
    case "deviation":
      return right.kind === "deviation" &&
        right.recipe.name === left.recipe.name &&
        right.file === left.file
        ? "same"
        : "different";
    case "boundary-record":
      return right.kind === "boundary-record" &&
        right.module === left.module &&
        sameOutsideParty({ left: left.outsideParty, right: right.outsideParty }) === "same"
        ? "same"
        : "different";
    case "dependency-record":
      return right.kind === "dependency-record" && right.dependency === left.dependency
        ? "same"
        : "different";
  }
};
