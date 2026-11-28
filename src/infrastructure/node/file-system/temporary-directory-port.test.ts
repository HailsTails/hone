import { assert, expect, it, onTestFinished } from "vitest";

import { createDefaultPathPort } from "../path-port.ts";
import { createDefaultDirectoryTreePort } from "./directory-tree-port.ts";
import { createDefaultFileTextPort } from "./file-system-port.ts";
import { temporaryDirectoryPort, withTemporaryDirectory } from "./temporary-directory-port.ts";

it("leaves an allocated directory for its caller to remove", () => {
  const root = createDefaultPathPort({}).resolve({ path: import.meta.dirname });
  assert(root.outcome === "ok");
  const text = createDefaultFileTextPort({});
  const directories = createDefaultDirectoryTreePort({});

  const allocated = temporaryDirectoryPort.write({ outside: root.value });

  assert(allocated.outcome === "ok");
  onTestFinished(() => {
    directories.remove({ path: allocated.value });
  });
  expect(text.exists({ path: allocated.value })).toBe("present");
});

it("removes the temporary directory after use", () => {
  const root = createDefaultPathPort({}).resolve({ path: import.meta.dirname });
  assert(root.outcome === "ok");
  const text = createDefaultFileTextPort({});
  const temporary = withTemporaryDirectory({
    outside: root.value,
    use: (folder) => ({ folder, during: text.exists({ path: folder }) }),
  });

  expect(temporary.during).toBe("present");
  expect(text.exists({ path: temporary.folder })).toBe("absent");
});
