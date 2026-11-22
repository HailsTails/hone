import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { NO_VERSION_ONE_NAMES, readVersionOneNames, VERSION_ONE_NAMES_SEGMENTS, versionOneNamesOf } from "./version-one-names.ts";

const PATH = "/install/src/infrastructure/disciplines-file/version-one-names.json";

const fileTextHolding = (request: { readonly text: string }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const UNREADABLE: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: PATH, detail: "EACCES" } }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
};

describe("VERSION_ONE_NAMES_SEGMENTS", () => {
  it("places the map beside the version 1 selection reader", () => {
    expect(VERSION_ONE_NAMES_SEGMENTS).toEqual(["src", "infrastructure", "disciplines-file", "version-one-names.json"]);
  });
});

describe("versionOneNamesOf", () => {
  it("gives each clause its sight, each check named under a clause that clause, and each record kind its format of today", () => {
    expect(
      versionOneNamesOf({
        document: {
          version: 1,
          clauses: [{ clause: "CD-17#clock-sources", sight: { kind: "outside-the-cases" }, checks: ["date-used-directly#clock-sources"] }],
          recordKinds: { debt: "file-carve-out" },
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        clauses: [{ clause: clauseAddressSchema.parse("CD-17#clock-sources"), sight: { kind: "outside-the-cases" } }],
        clauseOfCheck: new Map([["date-used-directly#clock-sources", clauseAddressSchema.parse("CD-17#clock-sources")]]),
        formatsOfToday: { debt: "file-carve-out" },
      },
    });
  });

  it("fails when a record kind is given none-yet, which a kind the map leaves out already has", () => {
    expect(versionOneNamesOf({ document: { version: 1, clauses: [], recordKinds: { debt: "none-yet" } } })).toEqual({
      outcome: "failed",
      error: expect.stringContaining("recordKinds.debt"),
    });
  });

  it("fails when one check is named by two clauses", () => {
    expect(
      versionOneNamesOf({
        document: {
          version: 1,
          clauses: [
            { clause: "CD-17#clock-sources", sight: { kind: "outside-the-cases" }, checks: ["a#b"] },
            { clause: "CD-18#other", sight: { kind: "outside-the-cases" }, checks: ["a#b"] },
          ],
          recordKinds: {},
        },
      }),
    ).toEqual({ outcome: "failed", error: "✖ a#b is named by more than one clause" });
  });

  it("fails when a check is no check address", () => {
    expect(
      versionOneNamesOf({ document: { version: 1, clauses: [{ clause: "CD-17#clock-sources", sight: { kind: "outside-the-cases" }, checks: ["clock-sources"] }], recordKinds: {} } }),
    ).toEqual({ outcome: "failed", error: expect.stringContaining("is not a check address of the form <symptom>#<check>") });
  });

  it("fails with the reason when the document is not the names map", () => {
    expect(versionOneNamesOf({ document: { version: 2, clauses: [], recordKinds: {} } })).toEqual({
      outcome: "failed",
      error: "✖ Invalid input: expected 1\n  → at version",
    });
  });
});

describe("readVersionOneNames", () => {
  it("gives the names the map's text holds", () => {
    const text = '{ "version": 1, "clauses": [{ "clause": "CD-17#clock-sources", "sight": { "kind": "one-symptom", "symptom": "date-used-directly" }, "checks": ["date-used-directly#clock-sources"] }], "recordKinds": {} }';
    expect(readVersionOneNames({ fileText: fileTextHolding({ text }), path: PATH })).toEqual({
      outcome: "ok",
      value: {
        clauses: [{ clause: clauseAddressSchema.parse("CD-17#clock-sources"), sight: { kind: "one-symptom", symptom: "date-used-directly" } }],
        clauseOfCheck: new Map([["date-used-directly#clock-sources", clauseAddressSchema.parse("CD-17#clock-sources")]]),
        formatsOfToday: {},
      },
    });
  });

  it("gives no names, reading nothing, when the map is absent", () => {
    const fileText: FileTextPort = { ...fileTextHolding({ text: "{}" }), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    expect(readVersionOneNames({ fileText, path: PATH })).toEqual({ outcome: "ok", value: NO_VERSION_ONE_NAMES });
    expect(fileText.read).not.toHaveBeenCalled();
  });

  it("fails file-unreadable when the map cannot be read", () => {
    expect(readVersionOneNames({ fileText: UNREADABLE, path: PATH })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: PATH, detail: "EACCES" },
    });
  });

  it("fails file-malformed with the reason when the map's text is not the names map", () => {
    const text = '{ "version": 1, "clauses": [{ "clause": "CD-17#clock-sources", "sight": { "kind": "outside-the-cases" }, "checks": ["a#b"] }, { "clause": "CD-18#other", "sight": { "kind": "outside-the-cases" }, "checks": ["a#b"] }], "recordKinds": {} }';
    expect(readVersionOneNames({ fileText: fileTextHolding({ text }), path: PATH })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: PATH, detail: "✖ a#b is named by more than one clause" },
    });
  });
});