import { describe, expect, it, vi } from "vitest";
import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import { createPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import type { HeldBesideItems } from "./item-document.ts";
import { createItemFolderCatalogueRepository } from "./read-item-folder-catalogue.ts";

const ROOT = absolutePathSchema.parse("/content");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => ROOT });

const CLOCK_SOURCES = clauseAddressSchema.parse("XX-1#clock-sources");

const BESIDE: HeldBesideItems = {
  engines: [{ name: "walker", mechanism: mechanismIdSchema.parse("checker") }],
  clauses: [{ clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: "date-used-directly" } }],
  clauseOfCheck: new Map([["date-used-directly#clock-sources", CLOCK_SOURCES]]),
};

const NOTHING_BESIDE: HeldBesideItems = { engines: [], clauses: [], clauseOfCheck: new Map() };

const DOES_ONE_JOB = '# Does one job\n\n```json\n{ "standing": "accepted", "owes": [{ "rule": "written-out-answers" }] }\n```\n';

const TESTS_ARE_OURS = "# Tests are ours\n\n```json\n{}\n```\n\nWhy tests are ours, which the tool never reads.\n";

const AUTHORISED_LOCATION = '# Authorised location\n\n```json\n{ "phrase": "an authorised location", "todaysFormat": "authorised-location" }\n```\n';

const DEBT = '# Debt\n\n```json\n{ "phrase": "debt", "todaysFormat": "none-yet" }\n```\n';

const WRITTEN_OUT_ANSWERS = '# Written-out answers\n\n```json\n{ "principle": "tests-are-ours", "standing": "accepted" }\n```\n';

const WORLD_VALUES = '# World values through a port\n\n```json\n{ "standing": "accepted", "reason": { "text": "the world is passed in", "standing": "accepted" } }\n```\n';

const DATE_USED_DIRECTLY =
  '# Date used directly\n\n```json\n{ "seen": "Any use of Date.", "mayIndicate": [{ "case": "does-one-job", "points": [{ "rule": "written-out-answers" }] }], "breachUsuallySits": "in the unit", "recipes": ["world-values-through-a-port"], "correctUses": [{ "situation": "correct use", "kind": "debt" }] }\n```\n';

const CLOCK_SOURCES_CHECK = '# Clock sources\n\n```json\n{ "engines": ["walker"] }\n```\n';

const fileTextReading = (read: FileTextPort["read"]): FileTextPort => ({
  read,
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const FULL_LISTING = vi
  .fn<DirectoryPort["list"]>()
  .mockReturnValueOnce({
    outcome: "ok",
    value: [
      { name: "README.md", kind: "file" },
      { name: "cases", kind: "directory" },
      { name: "principles", kind: "directory" },
      { name: "record-kinds", kind: "directory" },
      { name: "rules", kind: "directory" },
      { name: "typescript", kind: "directory" },
    ],
  })
  .mockReturnValueOnce({ outcome: "ok", value: [{ name: "does-one-job.md", kind: "file" }] })
  .mockReturnValueOnce({ outcome: "ok", value: [{ name: "tests-are-ours.md", kind: "file" }] })
  .mockReturnValueOnce({
    outcome: "ok",
    value: [
      { name: "authorised-location.md", kind: "file" },
      { name: "debt.md", kind: "file" },
    ],
  })
  .mockReturnValueOnce({ outcome: "ok", value: [{ name: "written-out-answers.md", kind: "file" }] })
  .mockReturnValueOnce({
    outcome: "ok",
    value: [
      { name: "checks.md", kind: "file" },
      { name: "recipes", kind: "directory" },
      { name: "symptoms", kind: "directory" },
    ],
  })
  .mockReturnValueOnce({ outcome: "ok", value: [{ name: "world-values-through-a-port.md", kind: "file" }] })
  .mockReturnValueOnce({
    outcome: "ok",
    value: [
      { name: "date-used-directly", kind: "directory" },
      { name: "date-used-directly.md", kind: "file" },
    ],
  })
  .mockReturnValueOnce({ outcome: "ok", value: [{ name: "clock-sources.md", kind: "file" }] });

describe("createItemFolderCatalogueRepository", () => {
  it("assembles a catalogue from the item files under its kind folders, each named by its file and titled by its heading, reading no other file", () => {
    const fileText = fileTextReading(
      vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: DOES_ONE_JOB })
        .mockReturnValueOnce({ outcome: "ok", value: TESTS_ARE_OURS })
        .mockReturnValueOnce({ outcome: "ok", value: AUTHORISED_LOCATION })
        .mockReturnValueOnce({ outcome: "ok", value: DEBT })
        .mockReturnValueOnce({ outcome: "ok", value: WRITTEN_OUT_ANSWERS })
        .mockReturnValueOnce({ outcome: "ok", value: WORLD_VALUES })
        .mockReturnValueOnce({ outcome: "ok", value: DATE_USED_DIRECTLY })
        .mockReturnValueOnce({ outcome: "ok", value: CLOCK_SOURCES_CHECK }),
    );
    const directory: DirectoryPort = { list: FULL_LISTING, create: vi.fn<DirectoryPort["create"]>() };
    expect(createItemFolderCatalogueRepository({ fileText, directory, path: PATH, root: ROOT, beside: BESIDE }).read({})).toMatchObject({
      outcome: "ok",
      value: {
        held: "catalogue",
        catalogue: {
          principles: [{ name: "tests-are-ours", title: "Tests are ours" }],
          rules: [{ name: "written-out-answers", title: "Written-out answers", principle: { name: "tests-are-ours" }, standing: "accepted" }],
          cases: [{ name: "does-one-job", title: "Does one job" }],
          recipes: [{ name: "world-values-through-a-port", title: "World values through a port" }],
          recordKinds: [{ name: "authorised-location" }, { name: "debt" }],
          engines: [{ name: "walker", mechanism: "checker" }],
          symptoms: [{ name: "date-used-directly", title: "Date used directly", recipes: [{ name: "world-values-through-a-port" }] }],
          checks: [{ name: "clock-sources", symptom: { name: "date-used-directly" }, clause: CLOCK_SOURCES, engines: [{ name: "walker" }] }],
        },
      },
    });
    expect(fileText.read).toHaveBeenNthCalledWith(1, { path: "/content/cases/does-one-job.md" });
    expect(fileText.read).toHaveBeenNthCalledWith(8, { path: "/content/typescript/symptoms/date-used-directly/clock-sources.md" });
    expect(fileText.read).toHaveBeenCalledTimes(8);
  });

  it("holds none, listing nothing, when the root is absent", () => {
    const fileText: FileTextPort = { ...fileTextReading(vi.fn<FileTextPort["read"]>()), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    const directory: DirectoryPort = { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() };
    expect(createItemFolderCatalogueRepository({ fileText, directory, path: PATH, root: ROOT, beside: NOTHING_BESIDE }).read({})).toEqual({ outcome: "ok", value: { held: "none" } });
    expect(directory.list).not.toHaveBeenCalled();
  });

  it("holds none when the root holds no item", () => {
    const directory: DirectoryPort = {
      list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "ok", value: [{ name: "SPIRIT.md", kind: "file" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(createItemFolderCatalogueRepository({ fileText: fileTextReading(vi.fn<FileTextPort["read"]>()), directory, path: PATH, root: ROOT, beside: NOTHING_BESIDE }).read({})).toEqual({
      outcome: "ok",
      value: { held: "none" },
    });
  });

  it("fails naming the folder it could not list", () => {
    const directory: DirectoryPort = {
      list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unreadable", path: ROOT, detail: "EACCES" } }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(createItemFolderCatalogueRepository({ fileText: fileTextReading(vi.fn<FileTextPort["read"]>()), directory, path: PATH, root: ROOT, beside: NOTHING_BESIDE }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/content", detail: "EACCES" },
    });
  });

  it("fails naming a file inside a kind folder that sits where no item is kept", () => {
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "typescript", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "symptoms", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "a", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "b", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "c.md", kind: "file" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(createItemFolderCatalogueRepository({ fileText: fileTextReading(vi.fn<FileTextPort["read"]>()), directory, path: PATH, root: ROOT, beside: NOTHING_BESIDE }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/content/typescript/symptoms/a/b/c.md", detail: "sits where no kind of item is kept" },
    });
  });

  it("fails naming a file with no json block", () => {
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "principles", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "tests-are-ours.md", kind: "file" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(
      createItemFolderCatalogueRepository({ fileText: fileTextReading(vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: "# Tests are ours\n\nOnly prose.\n" })), directory, path: PATH, root: ROOT, beside: NOTHING_BESIDE }).read({}),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/content/principles/tests-are-ours.md", detail: "holds no fenced json block of facts" },
    });
  });

  it("fails naming a file it cannot read", () => {
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "principles", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "tests-are-ours.md", kind: "file" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    const fileText = fileTextReading(
      vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/content/principles/tests-are-ours.md", detail: "EACCES" } }),
    );
    expect(createItemFolderCatalogueRepository({ fileText, directory, path: PATH, root: ROOT, beside: NOTHING_BESIDE }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/content/principles/tests-are-ours.md", detail: "EACCES" },
    });
  });

  it("fails naming the root when the items name what the folder does not hold", () => {
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "rules", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "written-out-answers.md", kind: "file" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(createItemFolderCatalogueRepository({ fileText: fileTextReading(vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: WRITTEN_OUT_ANSWERS })), directory, path: PATH, root: ROOT, beside: NOTHING_BESIDE }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/content", detail: expect.stringContaining("names tests-are-ours, which the catalogue does not hold") },
    });
  });
});
