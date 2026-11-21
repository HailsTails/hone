import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { inMemoryOverlay, overlaidFileText } from "./overlaid-file-text.ts";

const base: FileTextPort = {
  read: ({ path }) => ({ outcome: "ok", value: `base text of ${path}` }),
  exists: () => "absent",
  write: vi.fn<FileTextPort["write"]>(),
};

const overlay = overlaidFileText({ base, files: { "/repo/package.json": "overlaid text" } });

describe("overlaidFileText", () => {
  it("reads an overlaid file's text", () => {
    expect(overlay.read({ path: "/repo/package.json" })).toEqual({ outcome: "ok", value: "overlaid text" });
  });

  it("reads an overlaid file named with backslashes", () => {
    expect(overlay.read({ path: "\\repo\\package.json" })).toEqual({ outcome: "ok", value: "overlaid text" });
  });

  it("reads any other file through the base", () => {
    expect(overlay.read({ path: "/repo/README.md" })).toEqual({ outcome: "ok", value: "base text of /repo/README.md" });
  });

  it("finds an overlaid file present", () => {
    expect(overlay.exists({ path: "/repo/package.json" })).toBe("present");
  });

  it("asks the base whether any other file exists", () => {
    expect(overlay.exists({ path: "/repo/README.md" })).toBe("absent");
  });

  it("writes through the base", () => {
    expect(overlay.write).toBe(base.write);
  });
});

describe("inMemoryOverlay", () => {
  it("reads back the text written to an overlaid file, without writing to the base", () => {
    const base = { read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>(), write: vi.fn<FileTextPort["write"]>() };
    const overlay = inMemoryOverlay({ base, files: { "/repo/records.json": "before" } });
    overlay.write({ path: "\\repo\\records.json", text: "after" });
    expect({ read: overlay.read({ path: "/repo/records.json" }), baseWrites: base.write.mock.calls }).toEqual({
      read: { outcome: "ok", value: "after" },
      baseWrites: [],
    });
  });

  it("refuses a write to any file it does not overlay, leaving the base unwritten", () => {
    const base = { read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>(), write: vi.fn<FileTextPort["write"]>() };
    const overlay = inMemoryOverlay({ base, files: {} });
    expect({ written: overlay.write({ path: "/repo/README.md", text: "x" }), baseWrites: base.write.mock.calls }).toEqual({
      written: { outcome: "failed", error: { kind: "unwritable", path: "/repo/README.md", detail: "the in-memory overlay writes only the files it overlays" } },
      baseWrites: [],
    });
  });

  it("reads any other file through the base", () => {
    const overlay = inMemoryOverlay({ base, files: {} });
    expect(overlay.read({ path: "/repo/README.md" })).toEqual({ outcome: "ok", value: "base text of /repo/README.md" });
  });
});
