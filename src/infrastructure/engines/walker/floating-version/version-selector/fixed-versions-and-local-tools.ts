import { createDefaultJsoncParsePort } from "../../runner/pieces/jsonc-parse.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";

type ObservationKind = "floating-version" | "missing-lock-file" | "fetched-tool";
type Observation = {
  readonly kind: ObservationKind;
  readonly line: number;
  readonly snippet: string;
};
type Entry = readonly [string, unknown];

const DEPENDENCY_SECTIONS = new Set([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]);
const LOCK_FILE =
  /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/;
const MANIFEST = /(?:^|\/)package\.json$/;
const WORKFLOW = /^(?:\.github\/workflows\/.*\.ya?ml|\.gitlab-ci\.ya?ml|azure-pipelines\.ya?ml)$/;
const SHELL_FILE = /\.(?:sh|bash|zsh|ps1|cmd|bat)$/;
const EXACT_VERSION =
  /^[=v]?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i;
const LOCAL_SPECIFIER = /^(?:file|link|workspace):/;
const GIT_COMMIT = /#[\da-f]{40}$/i;
const ACTION_COMMIT = /@[\da-f]{40}$/i;
const DOCKER_DIGEST = /@sha256:[\da-f]{64}$/i;
const WORKFLOW_VERSION =
  /^\s*(?:-\s+)?(uses|(?:node|python|go|ruby|java|dotnet|bun|pnpm)-version)\s*:\s*(\S.*?)\s*$/;
const COMMAND_START =
  /(?:^|[;&|])\s*(?:exec\s+|call\s+)?(?:corepack\s+)?(?:npx|bunx|bun\s+x|pnpm\s+dlx|yarn\s+dlx|npm\s+exec)\b/i;
const DOWNLOAD_PIPE =
  /(?:^|[;&|])\s*(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|\r\n]*\|\s*(?:sh|bash|zsh|pwsh|powershell|iex|Invoke-Expression)\b/i;

const entriesOf = (value: unknown): readonly Entry[] =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? Object.entries(value) : [];

const pinnedSpecifier = (text: string): "pinned" | "floating" => {
  const specifier = text.trim();
  if (LOCAL_SPECIFIER.test(specifier) || GIT_COMMIT.test(specifier)) return "pinned";
  const version = specifier.startsWith("npm:")
    ? specifier.slice(specifier.lastIndexOf("@") + 1)
    : specifier;
  return EXACT_VERSION.test(version) ? "pinned" : "floating";
};

const versionInWorkflow = (line: string): string | undefined => {
  const match = WORKFLOW_VERSION.exec(line.replace(/\s+#.*$/, ""));
  const value = match?.[2]?.replace(/^(?:'|")|(?:'|")$/g, "");
  if (value === undefined || value.includes("${{")) return undefined;
  if (match?.[1] === "uses") {
    if (value.startsWith("./") || ACTION_COMMIT.test(value) || DOCKER_DIGEST.test(value))
      return undefined;
    return value;
  }
  return EXACT_VERSION.test(value) ? undefined : value;
};

const fetchedTool = (command: string): "fetched" | "local" =>
  COMMAND_START.test(command) || DOWNLOAD_PIPE.test(command) ? "fetched" : "local";

const toolObservation = (request: {
  readonly command: string;
  readonly line: number;
  readonly snippet: string;
}): readonly Observation[] =>
  fetchedTool(request.command) === "fetched"
    ? [{ kind: "fetched-tool", line: request.line, snippet: request.snippet }]
    : [];

const shellObservations = (request: {
  readonly source: string;
  readonly kind: "workflow" | "shell";
}): readonly Observation[] =>
  request.source.split(/\r?\n/).flatMap((sourceLine, index): readonly Observation[] => {
    const snippet = sourceLine.trim();
    const line = index + 1;
    if (snippet.startsWith("#") || snippet.startsWith("::")) return [];
    if (request.kind === "shell") return toolObservation({ command: snippet, line, snippet });
    const version = versionInWorkflow(sourceLine);
    const command = snippet
      .replace(/^(?:-\s+)?(?:run|script)\s*:\s*/, "")
      .replace(/^(?:'|")|(?:'|")$/g, "");
    const versionHits: readonly Observation[] =
      version === undefined ? [] : [{ kind: "floating-version", line, snippet }];
    return [...versionHits, ...toolObservation({ command, line, snippet })];
  });

const directoryOf = (file: string): string => file.slice(0, file.lastIndexOf("/") + 1);

const manifestObservations = (request: {
  readonly content: unknown;
  readonly file: string;
  readonly lockDirectories: readonly string[];
}): readonly Observation[] => {
  const manifest = entriesOf(request.content);
  const dependencies = manifest.flatMap(([name, value]) =>
    DEPENDENCY_SECTIONS.has(name) ? entriesOf(value) : [],
  );
  const floating = dependencies.flatMap(([name, version]): readonly Observation[] =>
    typeof version === "string" && pinnedSpecifier(version) === "floating"
      ? [{ kind: "floating-version", line: 1, snippet: `${name}: ${version}` }]
      : [],
  );
  const packageManager = manifest.find(([name]) => name === "packageManager")?.[1];
  const runtime: readonly Observation[] =
    typeof packageManager === "string" &&
    pinnedSpecifier(packageManager.slice(packageManager.lastIndexOf("@") + 1)) === "floating"
      ? [{ kind: "floating-version", line: 1, snippet: `packageManager: ${packageManager}` }]
      : [];
  const lock: readonly Observation[] =
    dependencies.length === 0 ||
    request.lockDirectories.some((directory) => request.file.startsWith(directory))
      ? []
      : [
          {
            kind: "missing-lock-file",
            line: 1,
            snippet: "dependencies declared without a tracked lock file",
          },
        ];
  const scripts = entriesOf(manifest.find(([name]) => name === "scripts")?.[1]);
  const fetched = scripts.flatMap(([name, command]) =>
    typeof command === "string"
      ? toolObservation({ command, line: 1, snippet: `${name}: ${command}` })
      : [],
  );
  return [...floating, ...runtime, ...lock, ...fetched];
};

const declaredObservationOf = (settings: unknown): unknown =>
  typeof settings === "object" && settings !== null && "observation" in settings
    ? settings.observation
    : undefined;

export const check: WalkerPiece = {
  prepare: ({ bindings, repository }) => {
    const lockDirectories = repository.files
      .filter((file) => LOCK_FILE.test(file))
      .map(directoryOf);
    const parse = createDefaultJsoncParsePort({ trailingCommas: "refused" });
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file, readText }) => {
          if (folderScope({ file }) === "generated")
            return { outcome: "ok", value: { kind: "skipped" } };
          const kind = MANIFEST.test(file)
            ? "manifest"
            : WORKFLOW.test(file)
              ? "workflow"
              : SHELL_FILE.test(file)
                ? "shell"
                : undefined;
          if (kind === undefined) return { outcome: "ok", value: { kind: "skipped" } };
          const source = readText();
          if (source.outcome === "failed") return source;
          const parsed = kind === "manifest" ? parse.parse({ source: source.value }) : undefined;
          if (parsed?.outcome === "failed") {
            return {
              outcome: "failed",
              error: { kind: "file-unparseable", file, detail: parsed.error.detail },
            };
          }
          const observations =
            kind === "manifest"
              ? manifestObservations({ file, lockDirectories, content: parsed?.value })
              : shellObservations({ source: source.value, kind });
          const hits = observations.flatMap(({ kind, line, snippet }) =>
            bindings
              .filter(({ settings }) => declaredObservationOf(settings) === kind)
              .map((selected) => ({
                check: selected.address,
                anchor: { line, column: 0 },
                snippet,
              })),
          );
          return { outcome: "ok", value: { kind: "complete", hits } };
        },
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
};
