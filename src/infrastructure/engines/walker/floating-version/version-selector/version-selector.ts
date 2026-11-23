import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import {
  dependencySourceOf,
  locatedPackageManifestOf,
  PACKAGE_MANIFEST,
  WORKFLOW,
} from "../../runner/pieces/dependency-files.ts";
import type { WalkerFile, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

type Version = { readonly anchor: Anchor; readonly snippet: string };
type Versions = Result<readonly Version[] | undefined, PieceFailure>;

const EXACT_VERSION =
  /^[=v]?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i;
const LOCAL_SPECIFIER = /^(?:file|link|workspace):/;
const GIT_COMMIT = /#[\da-f]{40}$/i;
const ACTION_COMMIT = /@[\da-f]{40}$/i;
const DOCKER_DIGEST = /@sha256:[\da-f]{64}$/i;
const WORKFLOW_VERSION =
  /^\s*(?:-\s+)?(uses|(?:node|python|go|ruby|java|dotnet|bun|pnpm)-version)\s*:\s*(\S.*?)\s*$/;

const floatingSpecifier = (text: string): boolean => {
  const specifier = text.trim();
  if (LOCAL_SPECIFIER.test(specifier) || GIT_COMMIT.test(specifier)) return false;
  const version = specifier.startsWith("npm:")
    ? specifier.slice(specifier.lastIndexOf("@") + 1)
    : specifier;
  return !EXACT_VERSION.test(version);
};

const floatingWorkflowVersion = (line: string): boolean => {
  const match = WORKFLOW_VERSION.exec(line.replace(/\s+#.*$/, ""));
  const value = match?.[2]?.replace(/^(?:'|")|(?:'|")$/g, "");
  if (value === undefined || value.includes("${{")) return false;
  return match?.[1] === "uses"
    ? !value.startsWith("./") && !ACTION_COMMIT.test(value) && !DOCKER_DIGEST.test(value)
    : !EXACT_VERSION.test(value);
};

const manifestVersionsOf = (file: WalkerFile): Versions => {
  const manifest = locatedPackageManifestOf(file);
  if (manifest.outcome === "failed") return manifest;
  const { value } = manifest;
  if (value === undefined) return { outcome: "ok", value: undefined };
  const sections =
    value.get("private")?.value === true
      ? ["dependencies", "devDependencies", "optionalDependencies"]
      : ["devDependencies"];
  const floating = sections.flatMap((section) =>
    Array.from(value.get(section)?.fields.values() ?? []).filter(
      ({ value: version }) => typeof version === "string" && floatingSpecifier(version),
    ),
  );
  const packageManager = value.get("packageManager");
  if (
    typeof packageManager?.value === "string" &&
    floatingSpecifier(packageManager.value.slice(packageManager.value.lastIndexOf("@") + 1))
  ) {
    floating.push(packageManager);
  }
  return { outcome: "ok", value: floating };
};

const workflowVersionsOf = (file: WalkerFile): Versions => {
  const source = dependencySourceOf({ ...file, accepts: WORKFLOW });
  return source.outcome === "failed"
    ? source
    : {
        outcome: "ok",
        value: source.value
          ?.split(/\r?\n/)
          .flatMap((line, index) =>
            floatingWorkflowVersion(line)
              ? [{ anchor: { line: index + 1, column: 0 }, snippet: line.trim() }]
              : [],
          ),
      };
};

export const check: WalkerPiece = {
  prepare: ({ bindings }) => ({
    outcome: "ok",
    value: {
      prepareFile: (file) => {
        const versions = PACKAGE_MANIFEST.test(file.file)
          ? manifestVersionsOf(file)
          : workflowVersionsOf(file);
        if (versions.outcome === "failed") return versions;
        if (versions.value === undefined) return { outcome: "ok", value: { kind: "skipped" } };
        const hits = versions.value.flatMap(({ anchor, snippet }) =>
          bindings.map(({ address }) => ({ check: address, anchor, snippet })),
        );
        return { outcome: "ok", value: { kind: "complete", hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
