import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { absoluteWithin } from "../../../domain/repository/absolute-within.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort, RelativeLocation } from "../../ports/host/path-port.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import {
  filesStillPresentOf,
  projectionDeclarationsOf,
  removalEffectsOf,
  removalOutcomeOf,
  removedVersionOneFiles,
  type VersionOneRemoval,
} from "./version-one-removal.ts";

const ROOT = absoluteRootOf("/repo/discipline-exceptions");

const AUTHORISED_FOLDER = absoluteRootOf("/repo/discipline-exceptions/authorised-locations");

const CARVE_OUT_FILE = absoluteRootOf("/repo/discipline-exceptions/file-carve-outs/cd-15.json");

const CARVE_OUT_FOLDER = absoluteRootOf("/repo/discipline-exceptions/file-carve-outs");

const AUTHORISED_FILE = absoluteRootOf(
  "/repo/discipline-exceptions/authorised-locations/cd-15.json",
);

const PROJECTION = absoluteRootOf("/repo/disciplines.eslint.mjs");

const SETTINGS = absoluteRootOf("/repo/disciplines.json");

const REMOVAL: VersionOneRemoval = {
  recordsFiles: [CARVE_OUT_FILE, AUTHORISED_FILE],
  recordsFolders: [],
  recordsRoot: { kind: "folder", path: ROOT },
  projections: [PROJECTION],
  declarations: [],
  settings: SETTINGS,
  ruleSetFiles: [],
  ruleSetFolders: [],
};

const TEAM_RULE = absoluteRootOf("/repo/tools/acme/rules/ACME-1/discipline.json");

const TEAM_MODULE = absoluteRootOf("/repo/tools/acme/mechanisms/audit/ACME-1/scratch.ts");

const TEAM_RULE_FOLDER = absoluteRootOf("/repo/tools/acme/rules/ACME-1");

const TEAM_MECHANISMS_FOLDER = absoluteRootOf("/repo/tools/acme/mechanisms");

const DECLARATION = absoluteRootOf("/repo/disciplines.eslint.d.mts");

const SLICE_DECLARATION = absoluteRootOf("/repo/packages/a/disciplines.eslint.d.mts");

const SLICE = absoluteRootOf("/repo/packages/a/disciplines.eslint.mjs");

const DIRECT = absoluteRootOf("/repo/discipline-exceptions/records.json");

const SINGLE = absoluteRootOf("/repo/discipline-exceptions.json");

const REPOSITORY = absoluteRootOf("/repo");

const OUTSIDE = absoluteRootOf("/repo/tools/x.json");

const OTHER_CASE = absoluteRootOf("/repo/Discipline-Exceptions/file-carve-outs/cd-15.json");

const IN_CARVE_OUT_FOLDER: RelativeLocation = {
  relation: "within-root",
  path: "file-carve-outs/cd-15.json",
};

const IN_AUTHORISED_FOLDER: RelativeLocation = {
  relation: "within-root",
  path: "authorised-locations/cd-15.json",
};

describe("removalEffectsOf", () => {
  it("removes the records files, then tries the folders deepest first, the records folder last of them, then the projection, and the settings file last", () => {
    const path = {
      join: vi
        .fn<PathPort["join"]>()
        .mockReturnValueOnce(CARVE_OUT_FOLDER)
        .mockReturnValueOnce(AUTHORISED_FOLDER),
      relative: vi
        .fn<PathPort["relative"]>()
        .mockReturnValueOnce(IN_CARVE_OUT_FOLDER)
        .mockReturnValueOnce(IN_AUTHORISED_FOLDER),
    };

    const effects = removalEffectsOf({
      path,
      removal: REMOVAL,
    });

    expect(effects).toEqual([
      { kind: "remove-file", path: CARVE_OUT_FILE },
      { kind: "remove-file", path: AUTHORISED_FILE },
      { kind: "remove-directory-if-empty", path: AUTHORISED_FOLDER },
      { kind: "remove-directory-if-empty", path: CARVE_OUT_FOLDER },
      { kind: "remove-directory-if-empty", path: ROOT },
      { kind: "remove-file", path: PROJECTION },
      { kind: "remove-file", path: SETTINGS },
    ]);
  });

  it("tries the folders listed with no records file, deepest first, the records folder last", () => {
    const effects = removalEffectsOf({
      path: { join: vi.fn<PathPort["join"]>(), relative: vi.fn<PathPort["relative"]>() },
      removal: { ...REMOVAL, recordsFiles: [], recordsFolders: [ROOT, CARVE_OUT_FOLDER] },
    });

    expect(effects).toEqual([
      { kind: "remove-directory-if-empty", path: CARVE_OUT_FOLDER },
      { kind: "remove-directory-if-empty", path: ROOT },
      { kind: "remove-file", path: PROJECTION },
      { kind: "remove-file", path: SETTINGS },
    ]);
  });

  it("tries only the records folder for a records file directly under it", () => {
    const path = {
      join: vi.fn<PathPort["join"]>(),
      relative: vi
        .fn<PathPort["relative"]>()
        .mockReturnValue({ relation: "within-root", path: "records.json" }),
    };

    const effects = removalEffectsOf({
      path,
      removal: { ...REMOVAL, recordsFiles: [DIRECT], projections: [] },
    });

    expect(effects).toEqual([
      { kind: "remove-file", path: DIRECT },
      { kind: "remove-directory-if-empty", path: ROOT },
      { kind: "remove-file", path: SETTINGS },
    ]);
  });

  it("tries no folder for a records file at the repository root, since the root is not a records folder", () => {
    const path = {
      join: vi.fn<PathPort["join"]>(),
      relative: vi
        .fn<PathPort["relative"]>()
        .mockReturnValue({ relation: "within-root", path: "discipline-exceptions.json" }),
    };

    const effects = removalEffectsOf({
      path,
      removal: {
        ...REMOVAL,
        recordsFiles: [SINGLE],
        recordsRoot: { kind: "repository", path: REPOSITORY },
      },
    });

    expect(effects).toEqual([
      { kind: "remove-file", path: SINGLE },
      { kind: "remove-file", path: PROJECTION },
      { kind: "remove-file", path: SETTINGS },
    ]);
  });

  it("removes every projection, then each declaration file, after the records and before the settings file", () => {
    const effects = removalEffectsOf({
      path: { join: vi.fn<PathPort["join"]>(), relative: vi.fn<PathPort["relative"]>() },
      removal: {
        ...REMOVAL,
        recordsFiles: [],
        projections: [PROJECTION, SLICE],
        declarations: [DECLARATION],
      },
    });

    expect(effects).toEqual([
      { kind: "remove-file", path: PROJECTION },
      { kind: "remove-file", path: SLICE },
      { kind: "remove-file", path: DECLARATION },
      { kind: "remove-file", path: SETTINGS },
    ]);
  });

  it("removes a records file given with backslashes under a Windows records folder, and tries its folder", () => {
    const windowsRoot = absoluteRootOf("C:\\repo\\discipline-exceptions");
    const windowsFolder = absoluteWithin({
      root: windowsRoot,
      file: repoPathOf("file-carve-outs"),
    });
    const windowsFile = absoluteWithin({
      root: windowsRoot,
      file: repoPathOf("file-carve-outs/cd-15.json"),
    });
    const path = {
      join: vi.fn<PathPort["join"]>().mockReturnValueOnce(windowsFolder),
      relative: vi
        .fn<PathPort["relative"]>()
        .mockReturnValueOnce({ relation: "within-root", path: "file-carve-outs\\cd-15.json" }),
    };

    const effects = removalEffectsOf({
      path,
      removal: {
        ...REMOVAL,
        recordsFiles: [windowsFile],
        recordsRoot: { kind: "folder", path: windowsRoot },
        projections: [],
      },
    });

    expect(effects).toEqual([
      { kind: "remove-file", path: windowsFile },
      { kind: "remove-directory-if-empty", path: windowsFolder },
      { kind: "remove-directory-if-empty", path: windowsRoot },
      { kind: "remove-file", path: SETTINGS },
    ]);
  });

  it("removes a team rule set's version 1 files after the settings file, then tries each listed folder in the order given", () => {
    const effects = removalEffectsOf({
      path: { join: vi.fn<PathPort["join"]>(), relative: vi.fn<PathPort["relative"]>() },
      removal: {
        ...REMOVAL,
        recordsFiles: [],
        ruleSetFiles: [TEAM_RULE, TEAM_MODULE],
        ruleSetFolders: [TEAM_RULE_FOLDER, TEAM_MECHANISMS_FOLDER],
      },
    });

    expect(effects).toEqual([
      { kind: "remove-file", path: PROJECTION },
      { kind: "remove-file", path: SETTINGS },
      { kind: "remove-file", path: TEAM_RULE },
      { kind: "remove-file", path: TEAM_MODULE },
      { kind: "remove-directory-if-empty", path: TEAM_RULE_FOLDER },
      { kind: "remove-directory-if-empty", path: TEAM_MECHANISMS_FOLDER },
    ]);
  });
});

describe("removalOutcomeOf", () => {
  it("names each file and folder it removed, leaving out a folder it kept", () => {
    expect(
      removalOutcomeOf({
        applied: {
          outcome: "all-applied",
          settled: [
            {
              effect: { kind: "remove-file", path: CARVE_OUT_FILE },
              outcome: "applied",
            },
            {
              effect: { kind: "remove-directory-if-empty", path: CARVE_OUT_FOLDER },
              outcome: "kept",
            },
            { effect: { kind: "remove-directory-if-empty", path: ROOT }, outcome: "applied" },
          ],
        },
      }),
    ).toEqual({ outcome: "ok", value: { files: [CARVE_OUT_FILE], folders: [ROOT] } });
  });

  it("names the effect it stopped at, with its own detail, and what it had removed before it", () => {
    expect(
      removalOutcomeOf({
        applied: {
          outcome: "stopped",
          settled: [
            {
              effect: { kind: "remove-file", path: CARVE_OUT_FILE },
              outcome: "applied",
            },
          ],
          stopped: {
            effect: { kind: "remove-directory-if-empty", path: AUTHORISED_FOLDER },
            outcome: "failed",
            detail: "EACCES",
          },
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "unremovable",
        path: AUTHORISED_FOLDER,
        detail: "EACCES",
        removed: { files: [CARVE_OUT_FILE], folders: [] },
      },
    });
  });
});

describe("removedVersionOneFiles", () => {
  it("applies the removal and names what it removed", () => {
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce({
      outcome: "all-applied",
      settled: [
        { effect: { kind: "remove-file", path: DIRECT }, outcome: "applied" },
        { effect: { kind: "remove-directory-if-empty", path: ROOT }, outcome: "applied" },
        { effect: { kind: "remove-file", path: SETTINGS }, outcome: "applied" },
      ],
    });
    const path = {
      join: vi.fn<PathPort["join"]>(),
      relative: vi
        .fn<PathPort["relative"]>()
        .mockReturnValue({ relation: "within-root", path: "records.json" }),
    };

    const removed = removedVersionOneFiles({
      path,
      effects: { apply },
      removal: { ...REMOVAL, recordsFiles: [DIRECT], projections: [] },
    });

    expect(removed).toEqual({
      outcome: "ok",
      value: { files: [DIRECT, SETTINGS], folders: [ROOT] },
    });
    expect(apply.mock.calls).toEqual([
      [
        {
          effects: [
            { kind: "remove-file", path: DIRECT },
            { kind: "remove-directory-if-empty", path: ROOT },
            { kind: "remove-file", path: SETTINGS },
          ],
        },
      ],
    ]);
  });

  it("refuses, before removing anything, a records file that is not under the records folder", () => {
    const apply = vi.fn<ProofEffects["apply"]>();
    const path = {
      join: vi.fn<PathPort["join"]>(),
      relative: vi
        .fn<PathPort["relative"]>()
        .mockReturnValueOnce(IN_CARVE_OUT_FOLDER)
        .mockReturnValueOnce({ relation: "within-root", path: "../tools/x.json" }),
    };

    const removed = removedVersionOneFiles({
      path,
      effects: { apply },
      removal: { ...REMOVAL, recordsFiles: [CARVE_OUT_FILE, OUTSIDE] },
    });

    expect(removed).toEqual({
      outcome: "failed",
      error: { kind: "records-file-outside-root", path: OUTSIDE, root: ROOT },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses a records file whose path differs from the records folder's only in case", () => {
    const apply = vi.fn<ProofEffects["apply"]>();
    const path = {
      join: vi.fn<PathPort["join"]>(),
      relative: vi.fn<PathPort["relative"]>().mockReturnValue({
        relation: "within-root",
        path: "../Discipline-Exceptions/file-carve-outs/cd-15.json",
      }),
    };

    const removed = removedVersionOneFiles({
      path,
      effects: { apply },
      removal: { ...REMOVAL, recordsFiles: [OTHER_CASE] },
    });

    expect(removed).toEqual({
      outcome: "failed",
      error: { kind: "records-file-outside-root", path: OTHER_CASE, root: ROOT },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses the records folder itself listed as a records file", () => {
    const apply = vi.fn<ProofEffects["apply"]>();
    const path = {
      join: vi.fn<PathPort["join"]>(),
      relative: vi
        .fn<PathPort["relative"]>()
        .mockReturnValue({ relation: "within-root", path: "" }),
    };

    const removed = removedVersionOneFiles({
      path,
      effects: { apply },
      removal: { ...REMOVAL, recordsFiles: [ROOT] },
    });

    expect(removed).toEqual({
      outcome: "failed",
      error: { kind: "records-file-outside-root", path: ROOT, root: ROOT },
    });
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("projectionDeclarationsOf", () => {
  it("names the declaration file beside each projection that has one, and skips those that do not", () => {
    const exists = vi
      .fn<FileTextPort["exists"]>()
      .mockReturnValueOnce("present")
      .mockReturnValueOnce("absent");

    expect(
      projectionDeclarationsOf({ projections: [PROJECTION, SLICE], fileText: { exists } }),
    ).toEqual([DECLARATION]);
    expect(exists.mock.calls).toEqual([[{ path: DECLARATION }], [{ path: SLICE_DECLARATION }]]);
  });

  it("looks for no declaration beside a projection that is not an .mjs module", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValue("present");

    expect(
      projectionDeclarationsOf({
        projections: [absoluteRootOf("/repo/disciplines.eslint.js")],
        fileText: { exists },
      }),
    ).toEqual([]);
    expect(exists).not.toHaveBeenCalled();
  });
});

describe("filesStillPresentOf", () => {
  it("names a declaration file the removal stopped before", () => {
    expect(
      filesStillPresentOf({
        removal: { ...REMOVAL, recordsFiles: [], declarations: [DECLARATION] },
        failure: {
          kind: "unremovable",
          path: DECLARATION,
          detail: "EBUSY",
          removed: { files: [PROJECTION], folders: [] },
        },
      }),
    ).toEqual([DECLARATION, SETTINGS]);
  });

  it("names a team rule set file the removal stopped before", () => {
    expect(
      filesStillPresentOf({
        removal: { ...REMOVAL, recordsFiles: [], ruleSetFiles: [TEAM_RULE, TEAM_MODULE] },
        failure: {
          kind: "unremovable",
          path: TEAM_MODULE,
          detail: "EBUSY",
          removed: { files: [PROJECTION, SETTINGS, TEAM_RULE], folders: [] },
        },
      }),
    ).toEqual([TEAM_MODULE]);
  });
});
