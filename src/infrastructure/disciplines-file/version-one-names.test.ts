import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { NO_VERSION_ONE_NAMES, readVersionOneNames, VERSION_ONE_NAMES_SEGMENTS } from "./version-one-names.ts";

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

describe("readVersionOneNames", () => {
  it("gives each clause its sight, and each check named under a clause that clause", () => {
    const text = JSON.stringify({
      version: 1,
      clauses: [
        { clause: "CD-17#clock-sources", sight: { kind: "one-symptom", symptom: "date-used-directly" }, checks: ["date-used-directly#clock-sources"] },
        { clause: "CD-32#pii-redaction", sight: { kind: "outside-the-cases" }, checks: [] },
      ],
    });
    expect(readVersionOneNames({ fileText: fileTextHolding({ text }), path: PATH })).toEqual({
      outcome: "ok",
      value: {
        clauses: [
          { clause: clauseAddressSchema.parse("CD-17#clock-sources"), sight: { kind: "one-symptom", symptom: "date-used-directly" } },
          { clause: clauseAddressSchema.parse("CD-32#pii-redaction"), sight: { kind: "outside-the-cases" } },
        ],
        clauseOfCheck: new Map([["date-used-directly#clock-sources", clauseAddressSchema.parse("CD-17#clock-sources")]]),
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

  it("fails file-malformed when one check is named by two clauses", () => {
    const text = JSON.stringify({
      version: 1,
      clauses: [
        { clause: "CD-17#clock-sources", sight: { kind: "outside-the-cases" }, checks: ["a#b"] },
        { clause: "CD-18#other", sight: { kind: "outside-the-cases" }, checks: ["a#b"] },
      ],
    });
    expect(readVersionOneNames({ fileText: fileTextHolding({ text }), path: PATH })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: PATH, detail: "✖ a#b is named by more than one clause" },
    });
  });

  it("fails file-malformed when a check is no check address", () => {
    const text = JSON.stringify({ version: 1, clauses: [{ clause: "CD-17#clock-sources", sight: { kind: "outside-the-cases" }, checks: ["clock-sources"] }] });
    expect(readVersionOneNames({ fileText: fileTextHolding({ text }), path: PATH })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: PATH, detail: expect.stringContaining("is not a check address of the form <symptom>#<check>") },
    });
  });
});
