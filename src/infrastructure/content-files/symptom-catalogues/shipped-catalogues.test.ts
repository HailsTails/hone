import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { shippedCataloguesOf } from "./shipped-catalogues.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const UNLISTED: DirectoryPort = {
  list: vi.fn<DirectoryPort["list"]>(),
  create: vi.fn<DirectoryPort["create"]>(),
};

const NAMES_TEXT =
  '{ "version": 1, "clauses": [], "recordKinds": { "authorised-location": "authorised-location", "debt": "file-carve-out" } }';

const MAKES_A_NEW_VALUE_TEXT =
  '# Makes a new value from what it has\n\n```json\n{ "standing": "accepted", "owes": [{ "principle": "no-hidden-effects" }] }\n```\n';

const NO_HIDDEN_EFFECTS_TEXT = "# No hidden effects\n\n```json\n{}\n```\n";

const AUTHORISED_LOCATION_TEXT =
  '# Authorised location\n\n```json\n{ "phrase": "an authorised location" }\n```\n';

const DEBT_TEXT = '# Debt\n\n```json\n{ "phrase": "debt" }\n```\n';

const REBINDING_TEXT =
  '# Rebinding\n\n```json\n{ "group": "Effects and state", "seen": "A `let` assigned again.", "mayIndicate": [{ "case": "makes-a-new-value-from-what-it-has", "points": [{ "principle": "no-hidden-effects" }] }], "breachUsuallySits": "in the unit", "seenBy": ["syntax"], "recipes": [], "correctUses": [] }\n```\n';

describe("shippedCataloguesOf", () => {
  it("reads the install's catalogue as Hone's own, its symptom owned by Hone", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: MAKES_A_NEW_VALUE_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: NO_HIDDEN_EFFECTS_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: AUTHORISED_LOCATION_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: DEBT_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: REBINDING_TEXT }),
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
        .mockReturnValueOnce({
          outcome: "ok",
          value: [{ name: "makes-a-new-value-from-what-it-has.md", kind: "file" }],
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [{ name: "no-hidden-effects.md", kind: "file" }],
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "authorised-location.md", kind: "file" },
            { name: "debt.md", kind: "file" },
          ],
        })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "symptoms", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "rebinding.md", kind: "file" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(
      shippedCataloguesOf({ fileText, directory, path: PATH, installRoot: INSTALL_ROOT }),
    ).toMatchObject({
      outcome: "ok",
      value: [
        {
          ruleSet: "hone",
          catalogue: { symptoms: [{ ruleSet: "hone", name: "rebinding" }], checks: [] },
        },
      ],
    });
  });

  it("fails naming the catalogue's path when the install holds none", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value: '{ "version": 1, "clauses": [], "recordKinds": {} }',
      }),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      shippedCataloguesOf({ fileText, directory: UNLISTED, path: PATH, installRoot: INSTALL_ROOT }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        path: "/install/rules",
        detail: "the install holds no symptom catalogue",
      },
    });
  });

  it("fails with the load failure when the install's rule items cannot be listed", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value: '{ "version": 1, "clauses": [], "recordKinds": {} }',
      }),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({
        outcome: "failed",
        error: {
          kind: "directory-unreadable",
          path: absoluteRootOf("/install/rules"),
          detail: "EACCES",
        },
      }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(
      shippedCataloguesOf({ fileText, directory, path: PATH, installRoot: INSTALL_ROOT }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/install/rules", detail: "EACCES" },
    });
  });

  it("fails with the load failure when the catalogue cannot be read", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({
        outcome: "failed",
        error: {
          kind: "unreadable",
          path: "/install/src/infrastructure/disciplines-file/version-one-names.json",
          detail: "EACCES",
        },
      }),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      shippedCataloguesOf({ fileText, directory: UNLISTED, path: PATH, installRoot: INSTALL_ROOT }),
    ).toMatchObject({ outcome: "failed", error: { kind: "file-unreadable" } });
  });
});
