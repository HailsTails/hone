import { z } from "zod";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type {
  NamedCheckExamples,
  NamedCheckExamplesRepository,
} from "../../../application/ports/rule-set/named-check-examples.ts";
import {
  checkAddressOfNames,
  checkNamesOf,
} from "../../../domain/language-layer/check-address-text.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { Result } from "../../../domain/result.ts";
import { readNamedPiece, type NamedPiece } from "../../engines/named-piece.ts";
import { parsedJson } from "../parsed-json.ts";
import { readInstalledNames } from "./installed-pieces.ts";
import { clauseCasesSchema, sourceCaseSchema } from "./rule-set-reader.ts";

type FilePorts = { readonly fileText: FileTextPort; readonly path: Pick<PathPort, "join"> };

type Lookup = Parameters<NamedCheckExamplesRepository["read"]>[0];

const taggedExampleSchema = sourceCaseSchema.extend({
  check: z
    .string()
    .refine((text) => checkNamesOf({ text }) !== undefined)
    .optional(),
});

const examplesSchema = z.strictObject({
  flag: z.array(taggedExampleSchema),
  allow: z.array(taggedExampleSchema),
});

type ExamplesDocument = z.output<typeof examplesSchema>;

const malformed = (request: {
  readonly path: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: VersionTwoLoadFailure } => ({
  outcome: "failed",
  error: { kind: "file-malformed", ...request },
});

const readExamplesDocument = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Result<ExamplesDocument, VersionTwoLoadFailure> => {
  const { path } = request;
  const read = request.fileText.read({ path });
  if (read.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path, detail: read.error.detail },
    };
  }
  const document = parsedJson({ text: read.value });
  if (document.outcome === "failed") {
    return malformed({ path, detail: document.error });
  }
  const parsed = examplesSchema.safeParse(document.value);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : malformed({ path, detail: z.prettifyError(parsed.error) });
};

const exampleChecksOf = (
  request: FilePorts & Lookup & { readonly piece: NamedPiece },
): Result<ReadonlySet<string>, VersionTwoLoadFailure> => {
  const owner = request.piece.exampleOwner;
  const ownerAddress = checkAddressOfNames(owner);
  const declaredOwner: Result<NamedPiece, VersionTwoLoadFailure> =
    ownerAddress === request.check
      ? { outcome: "ok", value: request.piece }
      : readNamedPiece({
          ...request,
          ...owner,
          ruleSetRoot: request.installRoot,
          mechanism: request.engine,
        });
  if (declaredOwner.outcome === "failed") {
    return declaredOwner;
  }
  const addresses = new Set<string>([
    ownerAddress,
    ...Object.values(declaredOwner.value.forms).map(checkAddressOfNames),
  ]);
  if (!addresses.has(request.check)) {
    return malformed({
      path: request.piece.declarationPath,
      detail: `${request.check} shares examples without a form on ${ownerAddress}`,
    });
  }
  return { outcome: "ok", value: addresses };
};

const tagProblemIn = (request: {
  readonly document: ExamplesDocument;
  readonly checks: ReadonlySet<string>;
}): string | undefined => {
  const rows = [...request.document.flag, ...request.document.allow];
  const unknown = rows.find(({ check }) => check !== undefined && !request.checks.has(check));
  if (unknown !== undefined) {
    return `example ${unknown.name} names unknown check ${unknown.check}`;
  }
  const untagged =
    request.checks.size > 1 ? rows.find(({ check }) => check === undefined) : undefined;
  return untagged === undefined
    ? undefined
    : `shared example ${untagged.name} requires a check tag`;
};

const examplesForCheck = (request: {
  readonly check: string;
  readonly piece: NamedPiece;
  readonly document: ExamplesDocument;
  readonly checks: ReadonlySet<string>;
}): Result<NamedCheckExamples, VersionTwoLoadFailure> => {
  const path = request.piece.examplesPath;
  const problem = tagProblemIn(request);
  if (problem !== undefined) {
    return malformed({ path, detail: problem });
  }
  const fromCheck = ({ check }: { readonly check?: string | undefined }) =>
    check === undefined || check === request.check;
  const examples = clauseCasesSchema.safeParse({
    flag: request.document.flag.filter(fromCheck),
    allow: request.document.allow.filter(fromCheck),
  });
  if (!examples.success) {
    return malformed({ path, detail: z.prettifyError(examples.error) });
  }
  const selected = [...examples.data.flag, ...examples.data.allow];
  const { declared } = request.piece.editions;
  const unsupported = selected.find(
    ({ edition }) => edition !== undefined && !declared.includes(edition),
  );
  return unsupported === undefined
    ? { outcome: "ok", value: { piece: request.piece, examples: selected } }
    : malformed({
        path,
        detail: `example ${unsupported.name} selects edition ${unsupported.edition} outside the declaration`,
      });
};

const readExamples = (
  request: FilePorts & Lookup,
): Result<NamedCheckExamples, VersionTwoLoadFailure> => {
  const names = checkNamesOf({ text: request.check });
  if (names === undefined) {
    return { outcome: "failed", error: { kind: "unknown-clause", address: request.check } };
  }
  const piece = readNamedPiece({
    ...request,
    ...names,
    ruleSetRoot: request.installRoot,
    mechanism: request.engine,
  });
  if (piece.outcome === "failed") {
    return piece;
  }
  const checks = exampleChecksOf({ ...request, piece: piece.value });
  if (checks.outcome === "failed") {
    return checks;
  }
  const document = readExamplesDocument({
    fileText: request.fileText,
    path: piece.value.examplesPath,
  });
  return document.outcome === "failed"
    ? document
    : examplesForCheck({
        check: request.check,
        piece: piece.value,
        document: document.value,
        checks: checks.value,
      });
};

export const createNamedCheckExamplesRepository = (
  ports: FilePorts,
): NamedCheckExamplesRepository => ({
  read: (request) => readExamples({ ...ports, ...request }),
  runnerAddress: ({ installRoot, check }) => {
    const legacy = readInstalledNames({ ...ports, installRoot });
    if (legacy.outcome === "failed") {
      return legacy;
    }
    const address = legacy.value.clauseOfCheck.get(check);
    return address === undefined
      ? { outcome: "failed", error: { kind: "unknown-clause", address: check } }
      : { outcome: "ok", value: address };
  },
});
