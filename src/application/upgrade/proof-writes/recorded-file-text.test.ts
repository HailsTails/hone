import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import { createRecordedFileText } from "./recorded-file-text.ts";

const FILE = absoluteRootOf("/repo/disciplines.eslint.mjs");

const WRITTEN = { outcome: "ok", value: undefined } as const;

const DISK_FULL = {
  outcome: "failed",
  error: { kind: "unwritable", path: FILE, detail: "disk full" },
} as const;

describe("createRecordedFileText", () => {
  it("records a write to a file that exists with the text it held", () => {
    const write = vi.fn<FileTextPort["write"]>().mockReturnValueOnce(WRITTEN);
    const recorded = createRecordedFileText({
      fileText: {
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
        read: vi
          .fn<FileTextPort["read"]>()
          .mockReturnValueOnce({ outcome: "ok", value: "drifted" }),
        write,
      },
    });

    const answered = recorded.fileText.write({ path: FILE, text: "regenerated" });

    expect(answered).toEqual(WRITTEN);
    expect(recorded.writes()).toEqual([{ kind: "file-replaced", path: FILE, original: "drifted" }]);
    expect(write.mock.calls).toEqual([[{ path: FILE, text: "regenerated" }]]);
  });

  it("records a write to an absent file as a file created", () => {
    const recorded = createRecordedFileText({
      fileText: {
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent"),
        read: vi.fn<FileTextPort["read"]>(),
        write: vi.fn<FileTextPort["write"]>().mockReturnValueOnce(WRITTEN),
      },
    });

    const answered = recorded.fileText.write({ path: FILE, text: "regenerated" });

    expect(answered).toEqual(WRITTEN);
    expect(recorded.writes()).toEqual([{ kind: "file-created", path: FILE }]);
  });

  it("records a failed write to a file that exists, since it may have changed part of it", () => {
    const recorded = createRecordedFileText({
      fileText: {
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
        read: vi
          .fn<FileTextPort["read"]>()
          .mockReturnValueOnce({ outcome: "ok", value: "drifted" }),
        write: vi.fn<FileTextPort["write"]>().mockReturnValueOnce(DISK_FULL),
      },
    });

    const answered = recorded.fileText.write({ path: FILE, text: "regenerated" });

    expect(answered).toEqual(DISK_FULL);
    expect(recorded.writes()).toEqual([{ kind: "file-replaced", path: FILE, original: "drifted" }]);
  });

  it("records a failed write to an absent file only when it left a file there", () => {
    const recorded = createRecordedFileText({
      fileText: {
        exists: vi
          .fn<FileTextPort["exists"]>()
          .mockReturnValueOnce("absent")
          .mockReturnValueOnce("absent")
          .mockReturnValueOnce("absent")
          .mockReturnValueOnce("present"),
        read: vi.fn<FileTextPort["read"]>(),
        write: vi
          .fn<FileTextPort["write"]>()
          .mockReturnValueOnce(DISK_FULL)
          .mockReturnValueOnce(DISK_FULL),
      },
    });

    const leftNothing = recorded.fileText.write({ path: FILE, text: "regenerated" });
    const afterNothing = recorded.writes();
    const leftPart = recorded.fileText.write({ path: FILE, text: "regenerated" });
    const afterPart = recorded.writes();

    expect([leftNothing, afterNothing, leftPart, afterPart]).toEqual([
      DISK_FULL,
      [],
      DISK_FULL,
      [{ kind: "file-created", path: FILE }],
    ]);
  });

  it.each([
    {
      name: "a file it cannot read to put back",
      path: FILE,
      read: {
        outcome: "failed",
        error: { kind: "unreadable", path: FILE, detail: "EACCES" },
      },
      detail: "EACCES",
    },
    {
      name: "a path that is not absolute",
      path: "disciplines.eslint.mjs",
      read: { outcome: "ok", value: "drifted" },
      detail: "disciplines.eslint.mjs is not an absolute path",
    },
  ] as const)("refuses to write $name, writing and recording nothing", ({ path, read, detail }) => {
    const write = vi.fn<FileTextPort["write"]>();
    const recorded = createRecordedFileText({
      fileText: {
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        read: vi.fn<FileTextPort["read"]>().mockReturnValue(read),
        write,
      },
    });

    const answered = recorded.fileText.write({ path, text: "regenerated" });

    expect(answered).toEqual({ outcome: "failed", error: { kind: "unwritable", path, detail } });
    expect([recorded.writes(), write.mock.calls]).toEqual([[], []]);
  });
});
