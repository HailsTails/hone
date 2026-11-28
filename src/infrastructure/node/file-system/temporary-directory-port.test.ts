import { assert, expect, it } from "vitest";

import { createDefaultPathPort } from "../path-port.ts";
import { createDefaultFileTextPort } from "./file-system-port.ts";
import { withTemporaryDirectory } from "./temporary-directory-port.ts";

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
