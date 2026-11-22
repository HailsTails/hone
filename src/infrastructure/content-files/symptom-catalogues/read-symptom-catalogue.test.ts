import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { FilePresence } from "../../../domain/repository/file-presence.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import { createSymptomCatalogueRepository } from "./read-symptom-catalogue.ts";
import type { Case, Engine, Principle, RecordKind, Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";

const RULE_SET_ROOT = absolutePathSchema.parse("/install");

const CATALOGUE_PATH = "/install/rules/typescript/symptoms.json";

const CATALOGUE_TEXT = `{
  "version": 1,
  "principles": [{ "name": "no-hidden-effects", "title": "No hidden effects" }],
  "rules": [],
  "cases": [{ "name": "makes-a-new-value-from-what-it-has", "title": "Makes a new value from what it has", "standing": "accepted", "owes": [{ "principle": "no-hidden-effects" }] }],
  "recipes": [],
  "recordKinds": [
    { "name": "authorised-location", "title": "Authorised location", "phrase": "an authorised location", "todaysFormat": "authorised-location" },
    { "name": "debt", "title": "Debt", "phrase": "debt", "todaysFormat": "file-carve-out" }
  ],
  "engines": [{ "name": "eslint", "mechanism": "eslint" }],
  "symptoms": [
    {
      "name": "rebinding",
      "title": "Rebinding",
      "seen": "A \`let\` assigned again.",
      "mayIndicate": [{ "case": "makes-a-new-value-from-what-it-has", "points": [{ "principle": "no-hidden-effects" }] }],
      "breachUsuallySits": "in the unit",
      "recipes": [],
      "correctUses": []
    }
  ],
  "clauses": [{ "clause": "CD-44#parameter-reassignment", "sight": { "kind": "one-symptom", "symptom": "rebinding" } }],
  "checks": [{ "symptom": "rebinding", "name": "parameter-reassignment", "clause": "CD-44#parameter-reassignment", "engines": ["eslint"] }],
  "namedBans": []
}`;

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const MAKES_A_NEW_VALUE: Case = {
  name: "makes-a-new-value-from-what-it-has",
  title: "Makes a new value from what it has",
  standing: "accepted",
  owes: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }],
};

const ESLINT: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

const PARAMETER_REASSIGNMENT = clauseAddressSchema.parse("CD-44#parameter-reassignment");

const REBINDING: Symptom = {
  name: "rebinding",
  title: "Rebinding",
  seen: "A `let` assigned again.",
  mayIndicate: [{ case: MAKES_A_NEW_VALUE, points: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }] }],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const fileTextHolding = (request: { readonly presence: FilePresence; readonly read: ReturnType<FileTextPort["read"]> }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue(request.read),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue(request.presence),
  write: vi.fn<FileTextPort["write"]>(),
});

const pathJoiningTo = (joined: string): Pick<PathPort, "join"> => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(joined),
});

describe("createSymptomCatalogueRepository", () => {
  it("reads the catalogue under the rule set's root into its typed form", () => {
    const fileText = fileTextHolding({ presence: "present", read: { outcome: "ok", value: CATALOGUE_TEXT } });
    const path = pathJoiningTo(CATALOGUE_PATH);
    expect(createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "ok",
      value: {
        held: "catalogue",
        catalogue: {
          principles: [NO_HIDDEN_EFFECTS],
          rules: [],
          cases: [MAKES_A_NEW_VALUE],
          recipes: [],
          recordKinds: [AUTHORISED_LOCATION, DEBT],
          alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
          engines: [ESLINT],
          symptoms: [REBINDING],
          clauses: [{ clause: PARAMETER_REASSIGNMENT, sight: { kind: "one-symptom", symptom: REBINDING } }],
          checks: [{ name: "parameter-reassignment", symptom: REBINDING, clause: PARAMETER_REASSIGNMENT, engines: [ESLINT], forms: [] }],
          namedBans: [],
        },
      },
    });
    expect(path.join).toHaveBeenCalledExactlyOnceWith({ segments: ["/install", "rules", "typescript", "symptoms.json"] });
    expect(fileText.exists).toHaveBeenCalledExactlyOnceWith({ path: CATALOGUE_PATH });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: CATALOGUE_PATH });
    expect(fileText.write).not.toHaveBeenCalled();
  });

  it("holds no catalogue, reading nothing, when the rule set holds none", () => {
    const fileText = fileTextHolding({ presence: "absent", read: { outcome: "ok", value: CATALOGUE_TEXT } });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "ok",
      value: { held: "none" },
    });
    expect(fileText.read).not.toHaveBeenCalled();
    expect(fileText.write).not.toHaveBeenCalled();
  });

  it("fails file-unreadable when the catalogue cannot be read", () => {
    const fileText = fileTextHolding({ presence: "present", read: { outcome: "failed", error: { kind: "unreadable", path: CATALOGUE_PATH, detail: "EACCES" } } });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: CATALOGUE_PATH, detail: "EACCES" },
    });
  });

  it("fails file-malformed when the catalogue is not JSON", () => {
    const fileText = fileTextHolding({ presence: "present", read: { outcome: "ok", value: "{ not json" } });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: CATALOGUE_PATH, detail: "Expected property name or '}' in JSON at position 2 (line 1 column 3)" },
    });
  });

  it("fails unsupported-version when the catalogue is of a later version", () => {
    const fileText = fileTextHolding({ presence: "present", read: { outcome: "ok", value: '{ "version": 2 }' } });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: CATALOGUE_PATH, found: 2 },
    });
  });

  it("fails file-malformed, saying why, when the catalogue names a symptom it does not hold", () => {
    const fileText = fileTextHolding({
      presence: "present",
      read: {
        outcome: "ok",
        value:
          '{ "version": 1, "principles": [], "rules": [], "cases": [], "recipes": [], "recordKinds": [{ "name": "authorised-location", "title": "Authorised location", "phrase": "an authorised location", "todaysFormat": "authorised-location" }, { "name": "debt", "title": "Debt", "phrase": "debt", "todaysFormat": "file-carve-out" }], "engines": [], "symptoms": [], "clauses": [{ "clause": "CD-15#loops", "sight": { "kind": "one-symptom", "symptom": "loop-keyword" } }], "checks": [], "namedBans": [] }',
      },
    });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: CATALOGUE_PATH, detail: "✖ clauses names loop-keyword, which the catalogue does not hold" },
    });
  });
});
