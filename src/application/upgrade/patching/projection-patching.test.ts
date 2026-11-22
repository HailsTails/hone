import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../../ports/file-system/directory-removal-port.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileCreationPort } from "../../ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ProofWritePorts } from "../proof-writes/proof-writes.ts";
import { patchedProjectionsOf, restoredOriginalProjections } from "./projection-patching.ts";

const REPO = absoluteRootOf("/repo");

const VERSION_ONE_IMPORT =
  'import piece0 from "@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";\n';

const VERSION_TWO_IMPORT =
  'import piece0 from "@hailstails/hone/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.js";\n';

const BODY = 'export default [{ rules: { "hone/no-class-authoring": "error" } }];\n';

const ok = { outcome: "ok", value: undefined } as const;

const portsHolding = (files: Record<string, string>): ProofWritePorts => ({
  fileText: {
    read: ({ path }) => {
      const text = files[path];
      return text === undefined
        ? { outcome: "failed", error: { detail: "ENOENT" } }
        : { outcome: "ok", value: text };
    },
    exists: vi.fn<FileTextPort["exists"]>(),
    write: ({ path, text }) => {
      files[path] = text;
      return ok;
    },
  },
  fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>() },
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
  directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
  entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
  path: {
    join: ({ segments }) => segments.join("/"),
    joinRepository: vi.fn<PathPort["joinRepository"]>(),
    relative: vi.fn<PathPort["relative"]>(),
    directoryOf: vi.fn<PathPort["directoryOf"]>(),
    repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
    resolve: vi.fn<PathPort["resolve"]>(),
    fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
  },
});

const PROJECTION = repoPathOf("disciplines.eslint.mjs");

describe("patchedProjectionsOf", () => {
  it("rewrites the version 1 plugin import of a tracked version 1 projection and leaves every other file alone", () => {
    const files = {
      "/repo/disciplines.eslint.mjs": `${VERSION_ONE_IMPORT}${BODY}`,
      "/repo/eslint.config.mjs": VERSION_ONE_IMPORT,
    };
    const patched = patchedProjectionsOf({
      ports: portsHolding(files),
      repoRoot: REPO,
      trackedPaths: [PROJECTION, repoPathOf("eslint.config.mjs")],
    });
    expect(patched.outcome).toBe("ok");
    expect(files).toEqual({
      "/repo/disciplines.eslint.mjs": `${VERSION_TWO_IMPORT}${BODY}`,
      "/repo/eslint.config.mjs": VERSION_ONE_IMPORT,
    });
  });

  it("refuses naming a tracked projection it cannot read", () => {
    expect(
      patchedProjectionsOf({
        ports: portsHolding({}),
        repoRoot: REPO,
        trackedPaths: [PROJECTION],
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "plan-refused",
        refusal: { kind: "config-candidate-unreadable", file: PROJECTION, detail: "ENOENT" },
        removedByVersionOne: [],
      },
    });
  });
});

describe("restoredOriginalProjections", () => {
  const original = `${VERSION_ONE_IMPORT}${BODY}`;

  const refusalOver = (request: { readonly files: Record<string, string> }) => {
    const ports = portsHolding(request.files);
    const patched = patchedProjectionsOf({ ports, repoRoot: REPO, trackedPaths: [PROJECTION] });
    return { ports, patched };
  };

  it("puts the original bytes of the projection back when the upgrade refuses", () => {
    const files = { "/repo/disciplines.eslint.mjs": original };
    const { ports, patched } = refusalOver({ files });
    const refusal = {
      kind: "version-one-uncovered",
      clauses: [],
      removedByVersionOne: [],
    } as const;
    expect(
      restoredOriginalProjections({
        ports,
        repoRoot: REPO,
        patches: patched.outcome === "ok" ? patched.value : [],
        refusal,
      }),
    ).toEqual(refusal);
    expect(files["/repo/disciplines.eslint.mjs"]).toBe(original);
  });

  it("leaves a projection that version 1's own project rewrote as that project left it", () => {
    const files = { "/repo/disciplines.eslint.mjs": original };
    const { ports, patched } = refusalOver({ files });
    files["/repo/disciplines.eslint.mjs"] = "rewritten by project";
    restoredOriginalProjections({
      ports,
      repoRoot: REPO,
      patches: patched.outcome === "ok" ? patched.value : [],
      refusal: {
        kind: "version-one-project-rewrote",
        files: [PROJECTION],
        removedByVersionOne: [],
      },
    });
    expect(files["/repo/disciplines.eslint.mjs"]).toBe("rewritten by project");
  });
});
