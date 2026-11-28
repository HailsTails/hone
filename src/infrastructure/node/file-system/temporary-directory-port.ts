import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import type { CreateTemporaryDirectoryOutside } from "../../../application/ports/file-system/temporary-directory-port.ts";
import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { createDefaultPathPort } from "../path-port.ts";

const path = createDefaultPathPort({});

const allocateTemporaryDirectory = (request: { readonly outside: AbsolutePath }): string => {
  const temporaryRoot = realpathSync(tmpdir());
  const location = path.relative({ from: realpathSync(request.outside), to: temporaryRoot });
  if (
    location.relation === "within-root" &&
    location.path !== ".." &&
    !location.path.startsWith("../")
  ) {
    throw new Error("The system temporary directory must be outside the checked repository");
  }
  return mkdtempSync(path.join({ segments: [temporaryRoot, "hone-"] }));
};

export const createTemporaryDirectoryOutside: CreateTemporaryDirectoryOutside = (request) => {
  try {
    const folder = allocateTemporaryDirectory(request);
    const resolved = path.resolve({ path: folder });
    if (resolved.outcome === "ok") return resolved;
    rmSync(folder, { recursive: true, force: true });
    throw new Error(`${folder} is not a usable absolute path`);
  } catch (thrown) {
    return {
      outcome: "failed",
      error: { kind: "temporary-directory-uncreatable", detail: failureDetailOf({ thrown }) },
    };
  }
};

export const withTemporaryDirectory = <Value>(request: {
  readonly outside: AbsolutePath;
  readonly use: (folder: string) => Value;
}): Value => {
  const folder = allocateTemporaryDirectory(request);
  try {
    return request.use(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};
