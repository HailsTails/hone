import type { DirectoryRemovalPort } from "../../../infrastructure/node/file-system/directory-removal-port.ts";
import type { FileCreationPort } from "../../../infrastructure/node/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../../infrastructure/node/file-system/file-removal-port.ts";
import type { DirectoryPort, EntryKindPort, FileTextPort } from "../../../infrastructure/node/file-system/file-system-port.ts";
import type { PathPort } from "../../../infrastructure/node/path-port.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type PlannedFile = { readonly path: AbsolutePath; readonly text: string };

export type ProofWritePorts = {
  readonly fileText: FileTextPort;
  readonly fileCreation: FileCreationPort;
  readonly fileRemoval: FileRemovalPort;
  readonly directory: DirectoryPort;
  readonly directoryRemoval: DirectoryRemovalPort;
  readonly entryKind: EntryKindPort;
  readonly path: PathPort;
};

export type ProofWrite =
  | { readonly kind: "directory-created"; readonly path: AbsolutePath }
  | { readonly kind: "file-created"; readonly path: AbsolutePath }
  | { readonly kind: "file-replaced"; readonly path: AbsolutePath; readonly original: string };

export type ProofWrites = readonly ProofWrite[];

export type ProofWriteFailure =
  | { readonly kind: "path-already-exists"; readonly path: AbsolutePath }
  | { readonly kind: "replaced-file-unreadable"; readonly path: AbsolutePath; readonly detail: string }
  | { readonly kind: "directory-uncreatable"; readonly path: AbsolutePath; readonly detail: string }
  | { readonly kind: "unwritable"; readonly path: AbsolutePath; readonly detail: string };

export type Unrestored = { readonly written: ProofWrite["kind"]; readonly path: AbsolutePath; readonly detail: string };

export type ProofWriteRefusal = { readonly failure: ProofWriteFailure; readonly unrestored: readonly Unrestored[] };

export type ProofWriteRequest = {
  readonly ports: ProofWritePorts;
  readonly files: readonly PlannedFile[];
  readonly replacements: readonly PlannedFile[];
};

type Replacement = { readonly file: PlannedFile; readonly original: string };

type Step =
  | { readonly kind: "directory"; readonly path: AbsolutePath }
  | { readonly kind: "file"; readonly file: PlannedFile }
  | { readonly kind: "replacement"; readonly file: PlannedFile; readonly original: string };

const parentOf = (request: { readonly ports: ProofWritePorts; readonly path: AbsolutePath }): AbsolutePath => {
  const parent = request.ports.path.directoryOf({ path: request.path });
  return isAbsolutePath(parent) ? parent : request.path;
};

const missingDirectoriesOf = (request: { readonly ports: ProofWritePorts; readonly path: AbsolutePath }): readonly AbsolutePath[] => {
  const parent = parentOf(request);
  return parent === request.path || request.ports.entryKind.kindOf({ path: parent }) !== "absent"
    ? []
    : [...missingDirectoriesOf({ ports: request.ports, path: parent }), parent];
};

const uniquePaths = (request: { readonly paths: readonly AbsolutePath[] }): readonly AbsolutePath[] => [...new Set(request.paths)];

const alreadyExisting = (request: { readonly ports: ProofWritePorts; readonly files: readonly PlannedFile[] }): ProofWriteFailure | undefined => {
  const existing = request.files.find((file) => request.ports.entryKind.kindOf({ path: file.path }) !== "absent");
  return existing === undefined ? undefined : { kind: "path-already-exists", path: existing.path };
};

const stepsOf = (request: {
  readonly ports: ProofWritePorts;
  readonly files: readonly PlannedFile[];
  readonly replacements: readonly Replacement[];
}): readonly Step[] => {
  const directories = uniquePaths({ paths: request.files.flatMap((file) => missingDirectoriesOf({ ports: request.ports, path: file.path })) }).toSorted(
    (left, right) => left.length - right.length,
  );
  return [
    ...directories.map((path): Step => ({ kind: "directory", path })),
    ...request.files.map((file): Step => ({ kind: "file", file })),
    ...request.replacements.map(({ file, original }): Step => ({ kind: "replacement", file, original })),
  ];
};

const performed = (request: { readonly ports: ProofWritePorts; readonly step: Step }): Result<ProofWrite, ProofWriteFailure> => {
  const { ports, step } = request;
  switch (step.kind) {
    case "directory": {
      const created = ports.directory.create({ path: step.path });
      return created.outcome === "ok"
        ? { outcome: "ok", value: { kind: "directory-created", path: step.path } }
        : { outcome: "failed", error: { kind: "directory-uncreatable", path: step.path, detail: created.error.detail } };
    }
    case "file": {
      const created = ports.fileCreation.createNew({ path: step.file.path, text: step.file.text });
      if (created.outcome === "ok") {
        return { outcome: "ok", value: { kind: "file-created", path: step.file.path } };
      }
      return {
        outcome: "failed",
        error:
          created.error.kind === "already-exists"
            ? { kind: "path-already-exists", path: step.file.path }
            : { kind: "unwritable", path: step.file.path, detail: created.error.detail },
      };
    }
    case "replacement": {
      const written = ports.fileText.write({ path: step.file.path, text: step.file.text });
      return written.outcome === "ok"
        ? { outcome: "ok", value: { kind: "file-replaced", path: step.file.path, original: step.original } }
        : { outcome: "failed", error: { kind: "unwritable", path: step.file.path, detail: written.error.detail } };
    }
  }
};

const undoneOf = (request: { readonly ports: ProofWritePorts; readonly write: ProofWrite }): Unrestored | undefined => {
  const { ports, write } = request;
  switch (write.kind) {
    case "directory-created": {
      const removed = ports.directoryRemoval.removeEmpty({ path: write.path });
      return removed.outcome === "ok" ? undefined : { written: write.kind, path: write.path, detail: removed.error.detail };
    }
    case "file-created": {
      const removed = ports.fileRemoval.remove({ path: write.path });
      return removed.outcome === "ok" ? undefined : { written: write.kind, path: write.path, detail: removed.error.detail };
    }
    case "file-replaced": {
      const restored = ports.fileText.write({ path: write.path, text: write.original });
      return restored.outcome === "ok" ? undefined : { written: write.kind, path: write.path, detail: restored.error.detail };
    }
  }
};

export const rolledBackProofWrites = (request: { readonly ports: ProofWritePorts; readonly writes: ProofWrites }): readonly Unrestored[] =>
  request.writes.toReversed().flatMap((write) => {
    const unrestored = undoneOf({ ports: request.ports, write });
    return unrestored === undefined ? [] : [unrestored];
  });

const performedAll = (request: {
  readonly ports: ProofWritePorts;
  readonly steps: readonly Step[];
  readonly done: ProofWrites;
}): Result<ProofWrites, ProofWriteRefusal> => {
  const [step, ...rest] = request.steps;
  if (step === undefined) {
    return { outcome: "ok", value: request.done };
  }
  const stepOutcome = performed({ ports: request.ports, step });
  if (stepOutcome.outcome === "failed") {
    const attempted: ProofWrites =
      step.kind === "replacement" ? [...request.done, { kind: "file-replaced", path: step.file.path, original: step.original }] : request.done;
    return { outcome: "failed", error: { failure: stepOutcome.error, unrestored: rolledBackProofWrites({ ports: request.ports, writes: attempted }) } };
  }
  return performedAll({ ports: request.ports, steps: rest, done: [...request.done, stepOutcome.value] });
};

const replacementOf = (request: { readonly ports: ProofWritePorts; readonly file: PlannedFile }): Result<Replacement, ProofWriteFailure> => {
  const read = request.ports.fileText.read({ path: request.file.path });
  return read.outcome === "ok"
    ? { outcome: "ok", value: { file: request.file, original: read.value } }
    : { outcome: "failed", error: { kind: "replaced-file-unreadable", path: request.file.path, detail: read.error.detail } };
};

const replacementsOf = (request: { readonly ports: ProofWritePorts; readonly files: readonly PlannedFile[] }): Result<readonly Replacement[], ProofWriteFailure> => {
  const read = request.files.map((file) => replacementOf({ ports: request.ports, file }));
  const unreadable = read.find((each) => each.outcome === "failed");
  return unreadable ?? { outcome: "ok", value: read.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])) };
};

const refusedBeforeWriting = (request: { readonly failure: ProofWriteFailure }): Result<ProofWrites, ProofWriteRefusal> => ({
  outcome: "failed",
  error: { failure: request.failure, unrestored: [] },
});

export const writeProofFiles = (request: ProofWriteRequest): Result<ProofWrites, ProofWriteRefusal> => {
  const existing = alreadyExisting({ ports: request.ports, files: request.files });
  if (existing !== undefined) {
    return refusedBeforeWriting({ failure: existing });
  }
  const replacements = replacementsOf({ ports: request.ports, files: request.replacements });
  if (replacements.outcome === "failed") {
    return refusedBeforeWriting({ failure: replacements.error });
  }
  return performedAll({
    ports: request.ports,
    steps: stepsOf({ ports: request.ports, files: request.files, replacements: replacements.value }),
    done: [],
  });
};
