import { fieldsOf, packageManifestOf } from "../../runner/pieces/dependency-files.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";

const DEPENDENCY_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];
const LOCK_FILE =
  /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/;

const directoryOf = (file: string): string => file.slice(0, file.lastIndexOf("/") + 1);

export const check: WalkerPiece = {
  prepare: ({ bindings, repository }) => {
    const lockDirectories = repository.files
      .filter((file) => LOCK_FILE.test(file))
      .map(directoryOf);
    return {
      outcome: "ok",
      value: {
        prepareFile: (file) => {
          const manifest = packageManifestOf(file);
          if (manifest.outcome === "failed") return manifest;
          const { value } = manifest;
          if (value === undefined) return { outcome: "ok", value: { kind: "skipped" } };
          const dependencies = DEPENDENCY_SECTIONS.some(
            (section) => fieldsOf(value.get(section)).length > 0,
          );
          const covered = lockDirectories.some((directory) => file.file.startsWith(directory));
          const hits =
            dependencies && !covered
              ? bindings.map(({ address }) => ({
                  check: address,
                  anchor: { line: 1, column: 0 },
                  snippet: "dependencies declared without a tracked lock file",
                }))
              : [];
          return { outcome: "ok", value: { kind: "complete", hits } };
        },
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
};
