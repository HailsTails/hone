import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../src/infrastructure/node/file-system/file-text-port.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import type { ListedEntry, ScratchFilesPort } from "../../install-proof/install-proof-ports.ts";
import { shippedPagesAt } from "./shipped-pages.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/pkg" });

const UNREAD: ReturnType<FileTextPort["read"]> = { outcome: "failed", error: { kind: "unreadable", path: "", detail: "missing" } };

const RULES_LISTING: readonly ListedEntry[] = [
  { path: "README.md", name: "README.md", entryKind: "file" },
  { path: "CD-14", name: "CD-14", entryKind: "folder" },
  { path: "CD-14/discipline.json", name: "discipline.json", entryKind: "file" },
  { path: "typescript/tests/fixture.md", name: "fixture.md", entryKind: "file" },
];

const DOCS_LISTING: readonly ListedEntry[] = [{ path: "extending.md", name: "extending.md", entryKind: "file" }];

const listedFolders = () =>
  vi
    .fn<ScratchFilesPort["listTree"]>()
    .mockReturnValueOnce({ outcome: "ok", value: [] })
    .mockReturnValueOnce({ outcome: "ok", value: RULES_LISTING })
    .mockReturnValueOnce({ outcome: "ok", value: [] })
    .mockReturnValueOnce({ outcome: "ok", value: DOCS_LISTING });

const presentReadme = () => vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValue("absent");

const readPages = () =>
  vi
    .fn<FileTextPort["read"]>()
    .mockReturnValueOnce({ outcome: "ok", value: "# Hone\n" })
    .mockReturnValueOnce({ outcome: "ok", value: "# Rules\n" })
    .mockReturnValueOnce({ outcome: "ok", value: "# Extending\n" });

describe("shippedPagesAt", () => {
  it("reads each page the package ships: the root pages present, then the pages under each shipped folder, leaving out test folders and other files", () => {
    expect(
      shippedPagesAt({
        listTree: listedFolders(),
        read: readPages(),
        exists: presentReadme(),
        join: PATH.join,
        packageRoot: "/pkg",
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { path: "README.md", text: "# Hone\n" },
        { path: "rules/README.md", text: "# Rules\n" },
        { path: "docs/extending.md", text: "# Extending\n" },
      ],
    });
  });

  it("lists each shipped folder under the package root", () => {
    const listTree = listedFolders();
    shippedPagesAt({ listTree, read: readPages(), exists: presentReadme(), join: PATH.join, packageRoot: "/pkg" });
    expect(listTree.mock.calls).toEqual([[{ path: "/pkg/src" }], [{ path: "/pkg/rules" }], [{ path: "/pkg/methods" }], [{ path: "/pkg/docs" }]]);
  });

  it("fails naming a shipped folder it cannot list", () => {
    expect(
      shippedPagesAt({
        listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "failed", error: { kind: "effect-failed", detail: "denied" } }),
        read: readPages(),
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
        join: PATH.join,
        packageRoot: "/pkg",
      }),
    ).toEqual({ outcome: "failed", error: "list src: denied" });
  });

  it("fails naming a page it cannot read", () => {
    expect(
      shippedPagesAt({
        listTree: listedFolders(),
        read: vi.fn<FileTextPort["read"]>().mockReturnValue(UNREAD),
        exists: presentReadme(),
        join: PATH.join,
        packageRoot: "/pkg",
      }),
    ).toEqual({ outcome: "failed", error: "read README.md: missing" });
  });
});
