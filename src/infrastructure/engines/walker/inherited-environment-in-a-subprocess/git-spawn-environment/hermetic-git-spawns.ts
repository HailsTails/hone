import {
  javaScriptTestEligibility,
  testFileEligibility,
} from "../../runner/pieces/source-scope.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";

const GIT_SPAWN_PATTERN =
  /\b(?:spawnSync|spawn|execFileSync|execFile|execSync|exec|execa|execaSync)\s*\(\s*(?:"git"|'git'|`git`)/;
const HERMETIC_ENVIRONMENT_PATTERN =
  /\benv\s*:\s*[^,\n]*\b(?:hermeticGitEnvironment|withoutInheritedGitBindings|environment)\b/;
const AMBIENT_ENVIRONMENT_PATTERN = /\benv\s*:\s*[^,\n]*\bprocess\.env\b/;

export const check: WalkerPiece = {
  prepare: ({ bindings }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file, readText }) => {
        if (
          testFileEligibility({ file }) === "skipped" &&
          javaScriptTestEligibility({ file }) === "skipped"
        ) {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        const text = readText();
        if (text.outcome === "failed") return text;
        const lines = text.value.split("\n");
        const hits = lines.flatMap((line, index) => {
          if (!GIT_SPAWN_PATTERN.test(line)) return [];
          const span = lines.slice(index, index + 8);
          if (
            !span.some((nearby) => AMBIENT_ENVIRONMENT_PATTERN.test(nearby)) &&
            span.some((nearby) => HERMETIC_ENVIRONMENT_PATTERN.test(nearby))
          )
            return [];
          return bindings.map((binding) => ({
            check: binding.address,
            anchor: { line: index + 1, column: 0 },
            snippet: line.trim(),
          }));
        });
        return { outcome: "ok", value: { kind: "complete", hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
