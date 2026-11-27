import { z } from "zod";

import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { createDefaultExecutionPort } from "../../../../node/process/execution-port.ts";

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

export type Diagnostic = z.output<typeof outputSchema>["diagnostics"][number];

export type OxlintSite = {
  readonly rule: string;
  readonly index: number;
  readonly line: number;
  readonly column: number;
};

export type OxlintInvocation = {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly files: readonly string[];
};

export const runOxlintCommand = (request: {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly arguments: readonly string[];
  readonly loader?: string;
  readonly input?: string;
}): string => {
  const executed = execution.run({
    arguments: [
      ...(request.loader === undefined ? [] : ["--loader", request.loader]),
      request.cli,
      ...request.arguments,
    ],
    cwd: request.folder,
    ...(request.input === undefined ? {} : { input: request.input }),
  });
  if (executed.outcome === "failed") throw new Error(executed.error.detail);
  const { status, stdout, stderr } = executed.value;
  if (status !== 0 && (status !== 1 || stdout.trim() === "")) {
    throw new Error(stderr.trim() || stdout.trim() || `Oxlint exited with status ${status}`);
  }
  return stdout;
};

export const readOxlintDiagnostics = (text: string): z.output<typeof outputSchema> =>
  outputSchema.parse(JSON.parse(text));

export const runOxlintProcess = (
  request: OxlintInvocation & {
    readonly options: readonly string[];
    readonly rules: number;
    readonly config?: string;
    readonly targets?: readonly string[];
  },
): readonly Diagnostic[] => {
  const output = readOxlintDiagnostics(
    runOxlintCommand({
      ...request,
      arguments: [
        "--format=json",
        "--config",
        request.config ?? ".oxlintrc.json",
        "--no-ignore",
        "--disable-nested-config",
        "--threads=1",
        ...request.options,
        "--",
        ...(request.targets ?? ["sources"]),
      ],
    }),
  );
  if (output.number_of_files !== request.files.length || output.number_of_rules !== request.rules) {
    throw new Error("Oxlint did not measure the requested files and rules");
  }
  return output.diagnostics;
};

export const mapDiagnosticsToSites = (request: {
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
