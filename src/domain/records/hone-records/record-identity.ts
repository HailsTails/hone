import { sameOwnedName } from "../../rule-set/rule-set-identity.ts";
import type {
  AuthorisedBinding,
  AuthorisedLocation,
  Debt,
  HoneRecord,
  OutsideParty,
  RecordReach,
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
    case "scheme":
      return right.kind === "scheme" && right.scheme === left.scheme ? "same" : "different";
  }
};

const sameBinding = (request: {
  readonly left: AuthorisedBinding;
  readonly right: AuthorisedBinding;
}): Sameness => {
  const { left, right } = request;
  switch (left.binds) {
    case "check-and-file":
      return right.binds === "check-and-file" ? "same" : "different";
    case "check-file-and-outside-party":
      return right.binds === "check-file-and-outside-party"
        ? sameOutsideParty({ left: left.outsideParty, right: right.outsideParty })
        : "different";
  }
};

const sameReach = (request: {
  readonly left: RecordReach;
  readonly right: RecordReach;
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
  readonly right: Debt | AuthorisedLocation;
}): Sameness => {
  const { left, right } = request;
  return sameOwnedName({ left: left.symptom, right: right.symptom }) === "same" &&
    sameReach({ left: left.reach, right: right.reach }) === "same" &&
    right.file === left.file
    ? "same"
    : "different";
};

const sameAuthorisedLocation = (request: {
  readonly left: AuthorisedLocation;
  readonly right: HoneRecord;
}): Sameness => {
  const { left, right } = request;
  return right.kind === "authorised-location" &&
    sameSymptomSite({ left, right }) === "same" &&
    sameBinding({ left: left.holding.binding, right: right.holding.binding }) === "same"
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
      return right.kind === "debt" ? sameSymptomSite({ left, right }) : "different";
    case "authorised-location":
      return sameAuthorisedLocation({ left, right });
    case "deviation":
      return right.kind === "deviation" &&
        sameOwnedName({ left: left.recipe, right: right.recipe }) === "same" &&
        right.file === left.file
        ? "same"
        : "different";
    case "dependency-record":
      return right.kind === "dependency-record" && right.dependency === left.dependency
        ? "same"
        : "different";
  }
};

export const identityPlaceOf = (request: { readonly record: HoneRecord }): string => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "deviation":
      return record.file;
    case "dependency-record":
      return record.dependency;
  }
};
