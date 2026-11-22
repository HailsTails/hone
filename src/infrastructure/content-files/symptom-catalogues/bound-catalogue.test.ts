import { describe, expect, it, vi } from "vitest";
import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { createBoundCatalogueOf, readBoundCatalogue } from "./bound-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const TEAM_ROOT = absoluteRootOf("/repo/team-rules");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const NAMES_TEXT =
  '{ "version": 1, "clauses": [{ "clause": "CD-44#parameter-reassignment", "sight": { "kind": "one-symptom", "symptom": "rebinding" }, "checks": ["rebinding#parameter-reassignment"], "anchor": { "kind": "file" } }], "recordKinds": { "authorised-location": "authorised-location", "debt": "file-carve-out" } }';

const MAKES_A_NEW_VALUE_TEXT = '# Makes a new value from what it has\n\n```json\n{ "standing": "accepted", "owes": [{ "principle": "no-hidden-effects" }] }\n```\n';

const NO_HIDDEN_EFFECTS_TEXT = "# No hidden effects\n\n```json\n{}\n```\n";

const AUTHORISED_LOCATION_TEXT = '# Authorised location\n\n```json\n{ "phrase": "an authorised location" }\n```\n';

const DEBT_TEXT = '# Debt\n\n```json\n{ "phrase": "debt" }\n```\n';

const REBINDING_TEXT =
  '# Rebinding\n\n```json\n{ "group": "Effects and state", "seen": "A `let` assigned again.", "mayIndicate": [{ "case": "makes-a-new-value-from-what-it-has", "points": [{ "principle": "no-hidden-effects" }] }], "breachUsuallySits": "in the unit", "seenBy": ["syntax"], "recipes": [], "correctUses": [] }\n```\n';

const PARAMETER_REASSIGNMENT_TEXT = '# parameter-reassignment\n\n```json\n{}\n```\n';

describe("readBoundCatalogue", () => {
  it("fails as a malformed catalogue, naming its rules folder, when no piece runs the clause of a check", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValueOnce("absent").mockReturnValueOnce("absent"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: MAKES_A_NEW_VALUE_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: NO_HIDDEN_EFFECTS_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: AUTHORISED_LOCATION_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: DEBT_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: REBINDING_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: PARAMETER_REASSIGNMENT_TEXT }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "cases", kind: "directory" },
            { name: "principles", kind: "directory" },
            { name: "record-kinds", kind: "directory" },
            { name: "typescript", kind: "directory" },
          ],
        })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "makes-a-new-value-from-what-it-has.md", kind: "file" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "no-hidden-effects.md", kind: "file" }] })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "authorised-location.md", kind: "file" },
            { name: "debt.md", kind: "file" },
          ],
        })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "symptoms", kind: "directory" }] })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "rebinding", kind: "directory" },
            { name: "rebinding.md", kind: "file" },
          ],
        })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "parameter-reassignment.md", kind: "file" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };

    expect(readBoundCatalogue({ fileText, directory, path: PATH, ruleSetRoot: INSTALL_ROOT, installRoot: INSTALL_ROOT })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/install/rules", detail: "no piece runs the clause of rebinding#parameter-reassignment" },
    });
  });
  it("reads a team's content from its rules folder and its pieces from its mechanisms folder", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>(),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("present").mockReturnValueOnce("absent"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unreadable", path: absoluteRootOf("/repo/team-rules/mechanisms/audit"), detail: "EACCES" } }),
      create: vi.fn<DirectoryPort["create"]>(),
    };

    expect(readBoundCatalogue({ fileText, directory, path: PATH, ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/repo/team-rules/mechanisms/audit", detail: "EACCES" },
    });
    expect(fileText.exists).toHaveBeenNthCalledWith(1, { path: "/repo/team-rules/rules" });
    expect(fileText.exists).toHaveBeenNthCalledWith(2, { path: "/repo/team-rules/mechanisms/audit" });
    expect(fileText.read).not.toHaveBeenCalled();
  });

  it("holds no catalogue when a team's rule set holds neither content nor pieces", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>(),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() };

    expect(readBoundCatalogue({ fileText, directory, path: PATH, ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT })).toEqual({ outcome: "ok", value: { held: "none" } });
    expect(fileText.exists).toHaveBeenNthCalledWith(2, { path: "/repo/team-rules/mechanisms/audit" });
  });
});

describe("createBoundCatalogueOf", () => {
  it("reads through the directory it was built with", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>(),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("present").mockReturnValueOnce("absent"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = { list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "ok", value: [] }), create: vi.fn<DirectoryPort["create"]>() };

    expect(createBoundCatalogueOf({ directory })({ fileText, path: PATH, ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT })).toEqual({ outcome: "ok", value: { held: "none" } });
    expect(directory.list).toHaveBeenCalledExactlyOnceWith({ path: "/repo/team-rules/mechanisms/audit" });
  });
});
