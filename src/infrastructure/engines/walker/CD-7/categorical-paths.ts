import type { WalkerPiece } from "../runner/pieces/walker-piece.ts";
import { folderScope } from "../runner/pieces/source-scope.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

const FORBIDDEN_FILENAMES: readonly string[] = [
  "types.ts", "interfaces.ts", "models.ts", "enums.ts", "utils.ts", "util.ts",
  "helpers.ts", "helper.ts", "common.ts", "lib.ts", "misc.ts", "shared.ts",
];

const FORBIDDEN_FOLDERS: readonly string[] = ["utils", "helpers", "common", "lib", "misc", "shared", "scripts", "values", "tests", "test", "__tests__"];

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (sourceEligibility({ file }) === "excluded") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        const segments = file.split("/");
        const fileName = segments.at(-1) ?? "";
        const folder = segments.find((segment) => FORBIDDEN_FOLDERS.includes(segment));
        const snippets = [
          ...(FORBIDDEN_FILENAMES.includes(fileName) ? [`forbidden categorical filename: ${fileName}`] : []),
          ...(folder === undefined ? [] : [`forbidden categorical folder: ${folder}`]),
        ];
        const hits = snippets.flatMap((snippet) => clauses.map((clause) => ({
          clause: clause.address,
          anchor: { line: 1, column: 0 },
          snippet,
        })));
        return { outcome: "ok", value: { kind: "complete", hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
