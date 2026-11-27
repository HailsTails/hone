import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { createDefaultPathPort } from "../path-port.ts";

const path = createDefaultPathPort({});

export const withTemporaryDirectory = <Value>(request: {
  readonly outside: AbsolutePath;
  readonly use: (folder: string) => Value;
}): Value => {
  const temporaryRoot = realpathSync(tmpdir());
  const location = path.relative({ from: realpathSync(request.outside), to: temporaryRoot });
  if (
    location.relation === "within-root" &&
    location.path !== ".." &&
    !location.path.startsWith("../")
  ) {
    throw new Error("The system temporary directory must be outside the checked repository");
  }
  const folder = mkdtempSync(path.join({ segments: [temporaryRoot, "hone-"] }));
  try {
    return request.use(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};
