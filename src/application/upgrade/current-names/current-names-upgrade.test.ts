import { describe, expect, it, vi } from "vitest";

import type { RecordsFolderFailure } from "../../../domain/records/records-folder-failure.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { RecordsReader } from "../../ports/records/records-reader.ts";
import type { RecordsSource } from "../../ports/records/records-source.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import { writeCurrentNames } from "./current-names-upgrade.ts";

const REPO = absoluteRootOf("/repo");

const FORMER = repoPathOf("hone-records/debt/export-from-a-test-file.json");

const CURRENT = repoPathOf("hone-records/debt/export-from-a-test.json");

const FORMER_PATH = absoluteRootOf("/repo/hone-records/debt/export-from-a-test-file.json");

const CURRENT_PATH = absoluteRootOf("/repo/hone-records/debt/export-from-a-test.json");

const SETTINGS_PATH = absoluteRootOf("/repo/hone.config.json");

describe("writeCurrentNames", () => {
  it("names the records files and checks it moved to their current names", () => {
    const renamed = [{ under: "checks", from: "former#check", to: "current#check" }] as const;
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: "former settings" })
        .mockReturnValueOnce({ outcome: "ok", value: '{ "version": 2, "records": [] }\n' }),
    };
    const renameKeys = vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
      outcome: "ok",
      value: { text: "current settings", renamed, listed: [] },
    });
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValue({ outcome: "all-applied", settled: [] });
    const effects = { apply, undo: vi.fn<ProofEffects["undo"]>() };
    const settingsFormat = { renameKeys };
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects,
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "ok",
      value: {
        outcome: "renamed",
        records: [{ from: FORMER, to: CURRENT, records: 0 }],
        checks: renamed,
      },
    });
  });

  it("applies the records writes, then the records removals, then the settings, in one list", () => {
    const renamed = [{ under: "checks", from: "former#check", to: "current#check" }] as const;
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: "former settings" })
        .mockReturnValueOnce({ outcome: "ok", value: '{ "version": 2, "records": [] }\n' }),
    };
    const renameKeys = vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
      outcome: "ok",
      value: { text: "current settings", renamed, listed: [] },
    });
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValue({ outcome: "all-applied", settled: [] });
    const effects = { apply, undo: vi.fn<ProofEffects["undo"]>() };
    const settingsFormat = { renameKeys };
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects,
    };

    writeCurrentNames({ ports });

    expect(apply).toHaveBeenCalledExactlyOnceWith({
      effects: [
        {
          kind: "create-file",
          path: CURRENT_PATH,
          text: '{\n  "version": 2,\n  "records": []\n}\n',
        },
        {
          kind: "remove-restorable-file",
          path: FORMER_PATH,
          original: '{ "version": 2, "records": [] }\n',
        },
        {
          kind: "replace-file",
          path: SETTINGS_PATH,
          text: "current settings",
          original: "former settings",
        },
      ],
    });
  });

  it("asks for the check addresses under checks and checkSettings in the settings it read", () => {
    const renamed = [{ under: "checks", from: "former#check", to: "current#check" }] as const;
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: "former settings" })
        .mockReturnValueOnce({ outcome: "ok", value: '{ "version": 2, "records": [] }\n' }),
    };
    const renameKeys = vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
      outcome: "ok",
      value: { text: "current settings", renamed, listed: [] },
    });
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValue({ outcome: "all-applied", settled: [] });
    const effects = { apply, undo: vi.fn<ProofEffects["undo"]>() };
    const settingsFormat = { renameKeys };
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects,
    };

    writeCurrentNames({ ports });

    expect(renameKeys).toHaveBeenCalledExactlyOnceWith({
      text: "former settings",
      under: ["checks", "checkSettings"],
      rename: expect.any(Function),
    });
  });

  it("puts back the records it applied when the settings write fails, and says nothing was changed", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '{"checks": {"walker-pre": "walker"}}' })
        .mockReturnValueOnce({ outcome: "ok", value: '{ "version": 2, "records": [] }\n' }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "ok",
        value: { text: '{"checks": {"walker-current": "walker"}}', renamed: [], listed: [] },
      }),
    };
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValue([]);
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValue({
      outcome: "stopped",
      settled: [
        { effect: { kind: "create-file", path: CURRENT_PATH, text: "{}\n" }, outcome: "applied" },
        {
          effect: { kind: "remove-restorable-file", path: FORMER_PATH, original: "{ }\n" },
          outcome: "applied",
        },
      ],
      stopped: {
        effect: { kind: "replace-file", path: SETTINGS_PATH, text: "{}", original: "{ }" },
        outcome: "failed",
        detail: "EACCES",
      },
    });
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects: { apply, undo },
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "ok",
      value: {
        outcome: "unwritten",
        failure: { kind: "unwritable", path: SETTINGS_PATH, detail: "EACCES" },
      },
    });
    expect(undo).toHaveBeenCalledExactlyOnceWith({
      writes: [
        { kind: "file-replaced", path: SETTINGS_PATH, original: "{ }" },
        { kind: "file-removed", path: FORMER_PATH, original: "{ }\n" },
        { kind: "file-created", path: CURRENT_PATH },
      ],
    });
  });

  it("removes the file it created when a later records step fails, leaving the settings untouched", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '{"checks": {"walker-pre": "walker"}}' })
        .mockReturnValueOnce({ outcome: "ok", value: '{ "version": 2, "records": [] }\n' }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "ok",
        value: { text: '{"checks": {"walker-current": "walker"}}', renamed: [], listed: [] },
      }),
    };
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValue([]);
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValue({
      outcome: "stopped",
      settled: [
        { effect: { kind: "create-file", path: CURRENT_PATH, text: "{}\n" }, outcome: "applied" },
      ],
      stopped: {
        effect: { kind: "remove-restorable-file", path: FORMER_PATH, original: "{ }\n" },
        outcome: "failed",
        detail: "EBUSY",
      },
    });
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects: { apply, undo },
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "ok",
      value: {
        outcome: "unwritten",
        failure: { kind: "unremovable", path: FORMER_PATH, detail: "EBUSY" },
      },
    });
    expect(undo).toHaveBeenCalledExactlyOnceWith({
      writes: [{ kind: "file-created", path: CURRENT_PATH }],
    });
  });

  it("leaves everything as it was when the first records write fails", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '{"checks": {"walker-pre": "walker"}}' })
        .mockReturnValueOnce({ outcome: "ok", value: '{ "version": 2, "records": [] }\n' }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "ok",
        value: { text: '{"checks": {"walker-current": "walker"}}', renamed: [], listed: [] },
      }),
    };
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValue([]);
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValue({
      outcome: "stopped",
      settled: [],
      stopped: {
        effect: { kind: "create-file", path: CURRENT_PATH, text: "{}\n" },
        outcome: "already-exists",
        detail: "EEXIST",
      },
    });
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects: { apply, undo },
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "ok",
      value: { outcome: "unwritten", failure: { kind: "path-already-exists", path: CURRENT_PATH } },
    });
    expect(undo).toHaveBeenCalledExactlyOnceWith({ writes: [] });
  });

  it("names each file it could not put back", () => {
    const unrestored = [{ written: "file-removed", path: FORMER_PATH, detail: "EBUSY" }] as const;
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '{"checks": {"walker-pre": "walker"}}' })
        .mockReturnValueOnce({ outcome: "ok", value: '{ "version": 2, "records": [] }\n' }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "ok",
        value: { text: '{"checks": {"walker-current": "walker"}}', renamed: [], listed: [] },
      }),
    };
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValue({
      outcome: "stopped",
      settled: [
        {
          effect: { kind: "remove-restorable-file", path: FORMER_PATH, original: "{ }\n" },
          outcome: "applied",
        },
      ],
      stopped: {
        effect: { kind: "replace-file", path: SETTINGS_PATH, text: "{}", original: "{ }" },
        outcome: "failed",
        detail: "EACCES",
      },
    });
    const effects = { apply, undo: vi.fn<ProofEffects["undo"]>().mockReturnValue(unrestored) };
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects,
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "ok",
      value: {
        outcome: "unrestored",
        failure: { kind: "unwritable", path: SETTINGS_PATH, detail: "EACCES" },
        unrestored,
      },
    });
  });

  it("names the records folder it could not read, reading nothing else", () => {
    const failure: RecordsFolderFailure = {
      kind: "records-folder-unreadable",
      folder: repoPathOf("hone-records"),
      detail: "denied",
    };
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "failed", error: failure }),
    };
    const read = vi.fn<FileTextPort["read"]>();
    const ports = {
      source,
      recordsReader: { readEntries: vi.fn<RecordsReader["readEntries"]>() },
      fileText: { read },
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat: { renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>() },
      effects: { apply: vi.fn<ProofEffects["apply"]>(), undo: vi.fn<ProofEffects["undo"]>() },
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({ outcome: "failed", error: { kind: "records-folder", failure } });
    expect(read).not.toHaveBeenCalled();
  });

  it("returns the refusal of a current records file it could not read, applying nothing", () => {
    const refusal = { kind: "document-refused", file: CURRENT, issues: [] } as const;
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [
          { file: FORMER, document: { version: 2, records: [] } },
          { file: CURRENT, document: { records: [] } },
        ],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [] })
        .mockReturnValueOnce({ outcome: "failed", error: refusal }),
    };
    const apply = vi.fn<ProofEffects["apply"]>();
    const ports = {
      source,
      recordsReader,
      fileText: { read: vi.fn<FileTextPort["read"]>() },
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat: { renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>() },
      effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "failed",
      error: { kind: "records-documents", refusals: [refusal] },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("names the settings file it could not read, applying nothing", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "unreadable", path: SETTINGS_PATH, detail: "absent" },
      }),
    };
    const apply = vi.fn<ProofEffects["apply"]>();
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat: { renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>() },
      effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: SETTINGS_PATH, detail: "absent" },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("names the settings file it could not rename, applying nothing, so the records and the settings move together", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "[]" }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "malformed", detail: "the settings are not a JSON object" },
      }),
    };
    const apply = vi.fn<ProofEffects["apply"]>();
    const effects = { apply, undo: vi.fn<ProofEffects["undo"]>() };
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects,
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SETTINGS_PATH,
        detail: "the settings are not a JSON object",
      },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses settings that list both a check and its current name, applying nothing, so neither entry is lost", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "{}" }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "ok",
        value: {
          text: "{}",
          renamed: [{ under: "checks", from: "walker-pre#check", to: "walker#check" }],
          listed: [
            { under: "checks", checks: ["walker-pre#check", "walker#check"] },
            { under: "checkSettings", checks: [] },
          ],
        },
      }),
    };
    const apply = vi.fn<ProofEffects["apply"]>();
    const effects = { apply, undo: vi.fn<ProofEffects["undo"]>() };
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects,
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "failed",
      error: {
        kind: "listed-under-both-names",
        path: SETTINGS_PATH,
        under: "checks",
        from: "walker-pre#check",
        to: "walker#check",
      },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("renames a check whose current name another listing holds", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: [] }),
    };
    const recordsReader = { readEntries: vi.fn<RecordsReader["readEntries"]>() };
    const fileText = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "{}" }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "ok",
        value: {
          text: "{ }",
          renamed: [{ under: "checks", from: "walker-pre#check", to: "walker#check" }],
          listed: [
            { under: "checks", checks: ["walker-pre#check"] },
            { under: "checkSettings", checks: ["walker#check"] },
          ],
        },
      }),
    };
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValue({ outcome: "all-applied", settled: [] });
    const effects = { apply, undo: vi.fn<ProofEffects["undo"]>() };
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects,
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "ok",
      value: {
        outcome: "renamed",
        records: [],
        checks: [{ under: "checks", from: "walker-pre#check", to: "walker#check" }],
      },
    });
  });

  it("names the settings file where a renamed check also appears outside the listings, applying nothing", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "{}" }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "renamed-address-outside-listings", listings: ["checks", "checkSettings"] },
      }),
    };
    const apply = vi.fn<ProofEffects["apply"]>();
    const ports = {
      source,
      recordsReader: { readEntries: vi.fn<RecordsReader["readEntries"]>() },
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "failed",
      error: {
        kind: "renamed-address-outside-listings",
        path: SETTINGS_PATH,
        listings: ["checks", "checkSettings"],
      },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("names a records file it could not read before removing it, applying nothing", () => {
    const source = {
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({
        outcome: "ok",
        value: [{ file: FORMER, document: { version: 2, records: [] } }],
      }),
    };
    const recordsReader = {
      readEntries: vi
        .fn<RecordsReader["readEntries"]>()
        .mockReturnValue({ outcome: "ok", value: [] }),
    };
    const fileText = {
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '{"checks": {"walker-pre": "walker"}}' })
        .mockReturnValueOnce({
          outcome: "failed",
          error: { kind: "unreadable", path: FORMER_PATH, detail: "denied" },
        }),
    };
    const settingsFormat = {
      renameKeys: vi.fn<SettingsFileFormat["renameKeys"]>().mockReturnValue({
        outcome: "ok",
        value: { text: '{"checks": {"walker-current": "walker"}}', renamed: [], listed: [] },
      }),
    };
    const apply = vi.fn<ProofEffects["apply"]>();
    const effects = { apply, undo: vi.fn<ProofEffects["undo"]>() };
    const ports = {
      source,
      recordsReader,
      fileText,
      repoRoot: REPO,
      settingsPath: SETTINGS_PATH,
      settingsFormat,
      effects,
    };

    const upgrade = writeCurrentNames({ ports });

    expect(upgrade).toEqual({
      outcome: "failed",
      error: {
        kind: "records-folder",
        failure: { kind: "records-file-unreadable", file: FORMER, detail: "denied" },
      },
    });
    expect(apply).not.toHaveBeenCalled();
  });
});
