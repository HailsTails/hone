import { z } from "zod";

import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { createDefaultDirectoryTreePort } from "../file-system/directory-tree-port.ts";
import {
  createDefaultDirectoryPort,
  createDefaultFileTextPort,
} from "../file-system/file-system-port.ts";
import { createPackageManifestPort } from "../modules/package-manifest-port.ts";
import { createDefaultPathPort } from "../path-port.ts";
import { createDefaultExecutionPort } from "./execution-port.ts";

const path = createDefaultPathPort({});
const manifests = createPackageManifestPort({ path });
const directories = createDefaultDirectoryPort({});
const tree = createDefaultDirectoryTreePort({});
const text = createDefaultFileTextPort({});
const execution = createDefaultExecutionPort({
  policy: {
    executable: process.execPath,
    environment: ({ ambient }) => ambient,
    timeoutMilliseconds: undefined,
    maximumOutputBytes: 64 * 1024 * 1024,
    stdout: "captured",
    replyPipe: "none",
  },
});

const spanSchema = z.object({
  offset: z.number().int().nonnegative(),
  length: z.number().int().nonnegative(),
  line: z.number().int().positive(),
});

const outputSchema = z.object({
  diagnostics: z.array(
    z.object({
      filename: z.string(),
      message: z.string(),
      code: z.string().optional(),
      labels: z.array(z.object({ span: spanSchema })),
    }),
  ),
  ["number_of_files"]: z.number(),
  ["number_of_rules"]: z.number(),
});

type Diagnostic = z.output<typeof outputSchema>["diagnostics"][number];

export const OXLINT_RANGE = "^1.95.0";

export const OXLINT_RULES = [
  "typescript/no-explicit-any",
  "eslint/max-params",
  "eslint/no-param-reassign",
] as const;

export type OxlintRule = (typeof OXLINT_RULES)[number];

const RULE_CONFIG: Readonly<Record<OxlintRule, unknown>> = {
  "typescript/no-explicit-any": "error",
  "eslint/max-params": ["error", { max: 2, countThis: "always" }],
  "eslint/no-param-reassign": ["error", { props: false }],
};

export type OxlintPluginRule = {
  readonly namespace: string;
  readonly id: string;
  readonly module: string;
  readonly options: readonly ReadonlyJsonValue[];
};

export type OxlintSite = {
  readonly rule: string;
  readonly index: number;
  readonly line: number;
  readonly column: number;
};

export type RunOxlint = (request: {
  readonly resolveFrom: string;
  readonly rules: readonly OxlintRule[];
  readonly pluginRules?: readonly OxlintPluginRule[];
  readonly sources: readonly { readonly fileName: string; readonly source: string }[];
}) => Promise<Result<readonly OxlintSite[], RunnerFailure>>;

type OxlintInvocation = {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly files: readonly string[];
};

const lint = (
  request: OxlintInvocation & {
    readonly options: readonly string[];
    readonly rules: number;
  },
): readonly Diagnostic[] => {
  const executed = execution.run({
    arguments: [
      request.cli,
      "--format=json",
      "--config=.oxlintrc.json",
      "--no-ignore",
      "--disable-nested-config",
      "--threads=1",
      ...request.options,
      "--",
      "sources",
    ],
    cwd: request.folder,
  });
  if (executed.outcome === "failed") throw new Error(executed.error.detail);
  const { status, stdout, stderr } = executed.value;
  if ((status !== 0 && status !== 1) || !stdout.trimStart().startsWith("{")) {
    throw new Error(stderr.trim() || stdout.trim() || `Oxlint exited with status ${status}`);
  }
  const output = outputSchema.parse(JSON.parse(stdout));
  if (output.number_of_files !== request.files.length || output.number_of_rules !== request.rules) {
    throw new Error("Oxlint did not measure the requested files and rules");
  }
  return output.diagnostics;
};

const write = (request: {
  readonly folder: AbsolutePath;
  readonly file: string;
  readonly contents: string;
}): void => {
  const written = text.write({
    path: path.join({ segments: [request.folder, request.file] }),
    text: request.contents,
  });
  if (written.outcome === "failed") throw new Error(written.error.detail);
};

const disableMarker = /(?:oxlint|eslint)-disable/u;

const removeDisableDirective = (request: {
  readonly diagnostic: Diagnostic;
  readonly sources: ReadonlyMap<string, Buffer>;
}): void => {
  const { diagnostic } = request;
  const filename = diagnostic.filename.replaceAll("\\", "/");
  const source = request.sources.get(filename);
  const span = diagnostic.labels[0]?.span;
  if (
    !/^Unused (?:eslint|oxlint)-disable directive/u.test(diagnostic.message) ||
    source === undefined ||
    span === undefined ||
    span.offset + span.length > source.length
  )
    throw new Error(`${filename}: ${diagnostic.message}`);
  const comment = source.subarray(span.offset, span.offset + span.length).toString();
  const marker = disableMarker.exec(comment);
  if (marker === null) throw new Error(`${filename}: Oxlint reported an unknown directive`);
  const offset = span.offset + Buffer.byteLength(comment.slice(0, marker.index));
  source.fill(32, offset, offset + marker[0].length);
};

const removeDisableDirectives = (
  request: OxlintInvocation & {
    readonly sources: ReadonlyMap<string, Buffer>;
  },
): void => {
  if (![...request.sources.values()].some((source) => disableMarker.test(source.toString())))
    return;
  const diagnostics = lint({
    ...request,
    options: ["--report-unused-disable-directives"],
    rules: 0,
  });
  const directives = new Map(
    diagnostics.map((diagnostic) => [
      `${diagnostic.filename}:${diagnostic.labels[0]?.span.offset}`,
      diagnostic,
    ]),
  );
  directives.forEach((diagnostic) => removeDisableDirective({ ...request, diagnostic }));
  request.sources.forEach((source, file) =>
    write({ folder: request.folder, file, contents: source.toString() }),
  );
};

const readSites = (request: {
  readonly diagnostics: readonly Diagnostic[];
  readonly files: readonly string[];
  readonly sources: readonly { readonly fileName: string; readonly source: string }[];
  readonly rules: readonly string[];
}): readonly OxlintSite[] => {
  const indices = new Map(request.files.map((file, index) => [file, index]));
  return request.diagnostics.map((diagnostic) => {
    const index = indices.get(diagnostic.filename.replaceAll("\\", "/"));
    const rule = request.rules.find((name) => diagnostic.code === name.replace("/", "(") + ")");
    const span = diagnostic.labels[0]?.span;
    if (rule === undefined || index === undefined || span === undefined) {
      throw new Error(
        `${index === undefined ? diagnostic.filename : request.sources[index].fileName}: ${diagnostic.message}`,
      );
    }
    const prefix = Buffer.from(request.sources[index].source).subarray(0, span.offset).toString();
    const linePrefix = prefix.split(/\r\n|[\n\r\u2028\u2029]/u).at(-1) ?? "";
    return { rule, index, line: span.line, column: linePrefix.length + 1 };
  });
};

const createDirectory = (folder: AbsolutePath): void => {
  const created = directories.create({ path: folder });
  if (created.outcome === "failed") throw new Error(created.error.detail);
};

type OxlintRequest = Parameters<RunOxlint>[0];

const runInScratch = (
  request: OxlintRequest & {
    readonly cli: string;
    readonly folder: AbsolutePath;
  },
): readonly OxlintSite[] => {
  const files = request.sources.map(
    ({ fileName }, index) => `sources/${index}/${fileName.split("/").at(-1)}`,
  );
  const sources = new Map(
    files.map((file, index) => [file, Buffer.from(request.sources[index].source)]),
  );
  const configuration = { folder: request.folder, file: ".oxlintrc.json" };
  const categories = { correctness: "off" };
  const invocation = { cli: request.cli, folder: request.folder, files };
  files.forEach((file) =>
    createDirectory(
      absolutePathSchema.parse(
        path.directoryOf({
          path: path.join({ segments: [request.folder, file] }),
        }),
      ),
    ),
  );
  write({ ...configuration, contents: JSON.stringify({ categories }) });
  sources.forEach((source, file) =>
    write({ folder: request.folder, file, contents: source.toString() }),
  );
  removeDisableDirectives({ ...invocation, sources });
  const pluginRules = request.pluginRules ?? [];
  const ruleEntries = [
    ...request.rules.map((rule) => [rule, RULE_CONFIG[rule]]),
    ...pluginRules.map(({ id, options }) => [id, ["error", ...options]]),
  ];
  const rules = Object.fromEntries(ruleEntries);
  const pluginsByNamespace = new Map(
    pluginRules.map(({ namespace, module }) => [namespace, module]),
  );
  const jsPlugins = [...pluginsByNamespace].map(([name, specifier]) => ({ name, specifier }));
  write({ ...configuration, contents: JSON.stringify({ categories, rules, jsPlugins }) });
  const selected = [...request.rules, ...pluginRules.map(({ id }) => id)];
  const diagnostics = lint({ ...invocation, options: [], rules: selected.length });
  return readSites({ ...request, diagnostics, files, rules: selected });
};

const runWithOxlint = (
  request: OxlintRequest & { readonly cli: string },
): Result<readonly OxlintSite[], RunnerFailure> => {
  try {
    const root = absolutePathSchema.parse(request.resolveFrom);
    const folder = absolutePathSchema.parse(
      path.join({ segments: [root, `.hone-oxlint-${crypto.randomUUID()}`] }),
    );
    createDirectory(folder);
    try {
      return { outcome: "ok", value: runInScratch({ ...request, folder }) };
    } finally {
      const removed = tree.remove({ path: folder });
      if (removed.outcome === "failed") throw new Error(removed.error.detail);
    }
  } catch (thrown) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: failureDetailOf({ thrown }) },
    };
  }
};

export const runOxlint: RunOxlint = (request) => {
  if (request.sources.length === 0 || (request.rules.length === 0 && !request.pluginRules?.length))
    return Promise.resolve({ outcome: "ok", value: [] });
  const manifest = manifests.locateManifestFrom({
    folder: request.resolveFrom,
    packageName: "oxlint",
  });
  return Promise.resolve(
    manifest.outcome === "failed"
      ? {
          outcome: "failed",
          error: {
            kind: "toolchain-unavailable",
            peers: [
              {
                packageName: "oxlint",
                peer: "required",
                supported: OXLINT_RANGE,
                found: "missing",
              },
            ],
          },
        }
      : runWithOxlint({
          ...request,
          cli: path.join({
            segments: [path.directoryOf({ path: manifest.value }), "bin", "oxlint"],
          }),
        }),
  );
};
