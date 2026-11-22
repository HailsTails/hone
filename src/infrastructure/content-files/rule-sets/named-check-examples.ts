import { z } from "zod";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { NamedCheckExamples, NamedCheckExamplesRepository } from "../../../application/ports/rule-set/named-check-examples.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import { checkNamesOf } from "../../../domain/language-layer/check-address-text.ts";
import type { Result } from "../../../domain/result.ts";
import { readNamedPiece } from "../../engines/named-piece.ts";
import { parsedJson } from "../parsed-json.ts";
import { readInstalledNames } from "./installed-pieces.ts";
import { clauseCasesSchema, sourceCaseSchema } from "./rule-set-reader.ts";

type FilePorts = { readonly fileText: FileTextPort; readonly path: Pick<PathPort, "join"> };

type Lookup = Parameters<NamedCheckExamplesRepository["read"]>[0];

const taggedExampleSchema = sourceCaseSchema.extend({
  check: z.string().refine((text) => checkNamesOf({ text }) !== undefined).optional(),
});

const examplesSchema = z.strictObject({ flag: z.array(taggedExampleSchema), allow: z.array(taggedExampleSchema) });

const malformed = (request: { readonly path: string; readonly detail: string }): { readonly outcome: "failed"; readonly error: VersionTwoLoadFailure } =>
  ({ outcome: "failed", error: { kind: "file-malformed", ...request } });

const readExamples = (request: FilePorts & Lookup): Result<NamedCheckExamples, VersionTwoLoadFailure> => {
  const names = checkNamesOf({ text: request.check });
  if (names === undefined) {
    return { outcome: "failed", error: { kind: "unknown-clause", address: request.check } };
  }
  const piece = readNamedPiece({ ...request, ...names, ruleSetRoot: request.installRoot, mechanism: request.engine });
  if (piece.outcome === "failed") {
    return piece;
  }
  const path = piece.value.examplesPath;
  const read = request.fileText.read({ path });
  if (read.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-unreadable", path, detail: read.error.detail } };
  }
  const document = parsedJson({ text: read.value });
  if (document.outcome === "failed") {
    return malformed({ path, detail: document.error });
  }
  const parsed = examplesSchema.safeParse(document.value);
  if (!parsed.success) {
    return malformed({ path, detail: z.prettifyError(parsed.error) });
  }
  const fromCheck = ({ check }: { readonly check?: string | undefined }) => check === undefined || check === request.check;
  const examples = clauseCasesSchema.safeParse({ flag: parsed.data.flag.filter(fromCheck), allow: parsed.data.allow.filter(fromCheck) });
  if (!examples.success) {
    return malformed({ path, detail: z.prettifyError(examples.error) });
  }
  const selected = [...examples.data.flag, ...examples.data.allow];
  const { declared } = piece.value.editions;
  const unsupported = selected.find(({ edition }) => edition !== undefined && !declared.includes(edition));
  return unsupported === undefined
    ? { outcome: "ok", value: { piece: piece.value, examples: selected } }
    : malformed({ path, detail: `example ${unsupported.name} selects edition ${unsupported.edition} outside the declaration` });
};

export const createNamedCheckExamplesRepository = (ports: FilePorts): NamedCheckExamplesRepository => ({
  read: (request) => readExamples({ ...ports, ...request }),
  runnerAddress: ({ installRoot, check }) => {
    const legacy = readInstalledNames({ ...ports, installRoot });
    if (legacy.outcome === "failed") {
      return legacy;
    }
    const address = legacy.value.clauseOfCheck.get(check);
    return address === undefined ? { outcome: "failed", error: { kind: "unknown-clause", address: check } } : { outcome: "ok", value: address };
  },
});
