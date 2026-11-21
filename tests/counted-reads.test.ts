import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { countedReadsOver } from "./counted-reads.ts";

const underlying = (): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "text" }),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
});

describe("countedReadsOver", () => {
  it("counts each read of a path, and none of a path never read", () => {
    const counted = countedReadsOver({ fileText: underlying() });
    counted.fileText.read({ path: "/repo/a.json" });
    counted.fileText.read({ path: "/repo/a.json" });
    counted.fileText.read({ path: "/repo/b.json" });
    expect({ a: counted.readsOf({ path: "/repo/a.json" }), b: counted.readsOf({ path: "/repo/b.json" }), c: counted.readsOf({ path: "/repo/c.json" }) }).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("gives the underlying port's answer to each read", () => {
    const counted = countedReadsOver({ fileText: underlying() });
    expect(counted.fileText.read({ path: "/repo/a.json" })).toEqual({ outcome: "ok", value: "text" });
  });
});
