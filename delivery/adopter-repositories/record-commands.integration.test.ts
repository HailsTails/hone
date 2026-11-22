import { afterAll, assert, describe, expect, it } from "vitest";
import type { Finding } from "../../src/domain/finding/governance.ts";
import { createDefaultDirectoryPort, createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import { createDefaultGitPort, createDefaultGitTreePort } from "../../src/infrastructure/git/git-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { answerFindings, type RaisedFinding } from "../../src/domain/records/answering/answering.ts";
import { authoriseOf, pruneDebtOf, type RecordDebtRequest, recordDebtOf } from "../../src/application/records/record-commands.ts";
import type { RunReport } from "../../src/domain/report/run-report.ts";
import type { AuthoriseRequest } from "../../src/application/ports/authorising.ts";
import { readHoneRecords } from "../../src/application/records/read-hone-records.ts";
import { createRecordsFolder } from "../../src/infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { createRecordsStore } from "../../src/infrastructure/hone-records-folder/writing/records-store.ts";
import { createSymptomCatalogueRepository } from "../../src/infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";
import type { TouchedSet } from "../../src/domain/repository/touched-set.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import type { Result } from "../../src/domain/result.ts";
import type { ReadonlyJsonValue } from "../../src/domain/settings/json-values/json-value.ts";
import type { WhyChain } from "../../src/domain/records/why-chain.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import {
  type CommandRunPort,
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
  type ScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";
import { recordsReader } from "../../src/infrastructure/hone-records-folder/reading/records-reading.ts";
import { recordsEditor } from "../../src/infrastructure/hone-records-folder/writing/records-edit.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../../src/domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../src/domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../src/domain/rule-set/clause-address.ts";

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

type ScratchRecordsFile = { readonly folder: string; readonly name: string; readonly records: readonly ReadonlyJsonValue[] };

type RecordsRepository = { readonly base: readonly ScratchRecordsFile[]; readonly working: readonly ScratchRecordsFile[] };

type ScratchPorts = {
  readonly scratch: Pick<ScratchFilesPort, "createTemporaryDirectory" | "makeDirectory">;
  readonly files: Pick<FileTextPort, "write">;
  readonly commands: CommandRunPort;
  readonly path: Pick<PathPort, "join">;
};

type ScratchFailure = { readonly kind: "scratch-failed"; readonly step: string; readonly detail: string };

type Step = Result<null, ScratchFailure>;

const SCRATCH_PREFIX = "hone-records-";

const RECORDS_VERSION = 2;

const JSON_INDENT = 2;

const GIT_IDENTITY: readonly string[] = ["-c", "user.name=hone-records", "-c", "user.email=hone-records@invalid", "-c", "commit.gpgsign=false"];

const DONE: Step = { outcome: "ok", value: null };

const failedAt = (request: { readonly step: string; readonly detail: string }): Result<never, ScratchFailure> => ({
  outcome: "failed",
  error: { kind: "scratch-failed", ...request },
});

const gitRun = (request: { readonly ports: ScratchPorts; readonly root: string; readonly gitArguments: readonly string[] }): Step => {
  const step = `git ${request.gitArguments.join(" ")}`;
  const run = request.ports.commands.run({ command: "git", arguments: request.gitArguments, directory: request.root });
  if (run.outcome === "not-exited") {
    return failedAt({ step, detail: run.detail });
  }
  return run.exitCode === 0 ? DONE : failedAt({ step, detail: run.output });
};

const documentTextOf = (request: { readonly file: ScratchRecordsFile }): string =>
  `${JSON.stringify({ version: RECORDS_VERSION, records: request.file.records }, null, JSON_INDENT)}\n`;

const writtenFile = (request: { readonly ports: ScratchPorts; readonly root: string; readonly file: ScratchRecordsFile }): Step => {
  const folder = request.ports.path.join({ segments: [request.root, request.file.folder] });
  const made = request.ports.scratch.makeDirectory({ path: folder });
  if (made.outcome === "failed") {
    return failedAt({ step: `make ${folder}`, detail: made.error.detail });
  }
  const path = request.ports.path.join({ segments: [request.root, request.file.folder, request.file.name] });
  const written = request.ports.files.write({ path, text: documentTextOf(request) });
  return written.outcome === "failed" ? failedAt({ step: `write ${path}`, detail: written.error.detail }) : DONE;
};

const writtenAll = (request: { readonly ports: ScratchPorts; readonly root: string; readonly files: readonly ScratchRecordsFile[] }): Step =>
  request.files.reduce<Step>((sofar, file) => (sofar.outcome === "failed" ? sofar : writtenFile({ ports: request.ports, root: request.root, file })), DONE);

const recordsRepositoryIn = (request: { readonly ports: ScratchPorts; readonly repository: RecordsRepository }): Result<string, ScratchFailure> => {
  const { ports, repository } = request;
  const made = ports.scratch.createTemporaryDirectory({ prefix: SCRATCH_PREFIX });
  if (made.outcome === "failed") {
    return failedAt({ step: "make the temporary directory", detail: made.error.detail });
  }
  const root = made.value;
  const steps: readonly (() => Step)[] = [
    () => gitRun({ ports, root, gitArguments: ["init", "-q"] }),
    () => writtenAll({ ports, root, files: repository.base }),
    () => gitRun({ ports, root, gitArguments: ["add", "-A"] }),
    () => gitRun({ ports, root, gitArguments: [...GIT_IDENTITY, "commit", "-q", "-m", "base"] }),
    () => writtenAll({ ports, root, files: repository.working }),
  ];
  const settled = steps.reduce<Step>((sofar, step) => (sofar.outcome === "failed" ? sofar : step()), DONE);
  return settled.outcome === "failed" ? failedAt(settled.error) : { outcome: "ok", value: root };
};

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const SHIPPED_ROOT = absolutePathSchema.parse(path.join({ segments: [`${import.meta.dirname}/..`, ".."] }));

const scratch = createDefaultScratchFilesPort({});

const holding = createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: SHIPPED_ROOT }).read({});
assert(holding.outcome === "ok", "the shipped symptom catalogue reads");
assert(holding.value.held === "catalogue", "the shipped symptom catalogue is present");

const { catalogue } = holding.value;

const made = recordsRepositoryIn({
  ports: { scratch, files: fileText, commands: createDefaultCommandRunPort({}), path },
  repository: {
    base: [{ folder: "hone-records", name: "dependency-records.json", records: [{ dependency: "zod", nativeWay: "hand-written parsing at each adapter", whyNotEnough: "Each adapter would repeat its own checks." }] }],
    working: [],
  },
});
assert(made.outcome === "ok", "the scratch repository is made and its base committed");

afterAll(() => {
  scratch.removeTree({ path: made.value });
});

const REPO_ROOT = absolutePathSchema.parse(made.value);

const source = createRecordsFolder({
  fileText,
  directory: createDefaultDirectoryPort({}),
  git: createDefaultGitPort({}),
  gitTree: createDefaultGitTreePort({}),
  repoRoot: REPO_ROOT,
});

const store = createRecordsStore({ fileText, removal: createDefaultFileRemovalPort({}), directory: createDefaultDirectoryPort({}), path, repoRoot: REPO_ROOT });

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const CAST_IN_ORDERS: Finding = {
  clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") },
  file: ORDER_FILE,
  anchor: { line: 3, column: 9 },
  snippet: "body as Event",
  mechanism: "eslint",
};

const RAISED: readonly RaisedFinding[] = [{ finding: CAST_IN_ORDERS, party: { reported: "not-reported" } }];

const NOTHING_CHANGED: TouchedSet = { measured: "yes", paths: new Set() };

const recordDebt = (run: RecordDebtRequest) => recordDebtOf({ ports: { catalogue, source, store, recordsReader, recordsEditor }, run });

const pruneDebt = (request: { readonly report: Pick<RunReport, "paid" | "stale" | "forfeited"> }) => pruneDebtOf({ ports: { source, store, recordsEditor }, report: request.report });

const authorise = (request: AuthoriseRequest) => authoriseOf({ ports: { catalogue, source, store, recordsReader, recordsEditor }, request });

const DEBT_TEXT = '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "claimed-type",\n      "file": "src/orders/charge-order.ts"\n    }\n  ]\n}\n';

const textOf = (request: { readonly file: string }): string => {
  const read = fileText.read({ path: `${made.value}/${request.file}` });
  assert(read.outcome === "ok", "the file is read");
  return read.value;
};

const answering = (request: { readonly findings: readonly RaisedFinding[] }) => {
  const reading = readHoneRecords({ recordsReader, source, catalogue, baseRevision: undefined });
  assert(reading.outcome === "ok", "the records written read back");
  return answerFindings({
    catalogue,
    records: reading.value.records,
    findings: request.findings,
    touched: NOTHING_CHANGED,
    runs: [], measurements: { runs: [], tracked: [], excluded: [] },
  });
};

describe("the version 2 record commands over a real hone-records folder, built in the test's own scratch", () => {
  it("record-debt writes debt the records reader reads and that answers the finding; run again it writes nothing; prune-debt removes it once the finding is fixed", () => {
    expect(recordDebt({ findings: [CAST_IN_ORDERS], unrecorded: [], runs: [], touched: NOTHING_CHANGED, leave: [] })).toMatchObject({ outcome: "ok", value: [{ effect: "recorded" }] });
    expect(textOf({ file: DEBT_FILE })).toBe(DEBT_TEXT);
    expect(answering({ findings: RAISED })).toMatchObject({ findings: [], answered: [{ finding: CAST_IN_ORDERS, by: [{ place: { file: DEBT_FILE, index: 0 } }] }], stale: [] });

    expect(recordDebt({ findings: [CAST_IN_ORDERS], unrecorded: [], runs: [], touched: NOTHING_CHANGED, leave: [] })).toMatchObject({ outcome: "ok", value: [{ effect: "already-recorded" }] });
    expect(textOf({ file: DEBT_FILE })).toBe(DEBT_TEXT);

    const fixed = answering({ findings: [] });
    expect(fixed.stale).toHaveLength(1);
    expect(pruneDebt({ report: fixed })).toMatchObject({ outcome: "ok", value: [{ reason: "credited-nothing" }] });
    expect(fileText.exists({ path: `${made.value}/${DEBT_FILE}` })).toBe("absent");
  });

  it("authorise writes the record the reader reads; the debt it now answers in place of is paid, and prune-debt removes exactly that", () => {
    recordDebt({ findings: [CAST_IN_ORDERS], unrecorded: [], runs: [], touched: NOTHING_CHANGED, leave: [] });
    const authorised = authorise({
      answers: "claimed-type",
      file: ORDER_FILE,
      case: "gives-a-value-its-type",
      owes: "declared-not-asserted",
      whys: CAUSAL_WHY_CHAIN.whys,
      rootCause: CAUSAL_WHY_CHAIN.rootCause,
      rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
      readback: CAUSAL_WHY_CHAIN.readback,
      owner: CAUSAL_WHY_CHAIN.owner,
    });
    expect(authorised).toMatchObject({ outcome: "ok", value: { judged: "accepted" } });

    const answered = answering({ findings: RAISED });
    expect(answered).toMatchObject({ findings: [], answered: [{ by: [{ place: { file: AUTHORISED_FILE, index: 0 } }] }], paid: [{ debt: { place: { file: DEBT_FILE, index: 0 } } }], stale: [] });

    expect(pruneDebt({ report: answered })).toMatchObject({ outcome: "ok", value: [{ reason: "paid" }] });
    expect(fileText.exists({ path: `${made.value}/${DEBT_FILE}` })).toBe("absent");
    expect(answering({ findings: RAISED })).toMatchObject({ findings: [], answered: [{ by: [{ place: { file: AUTHORISED_FILE, index: 0 } }] }], paid: [], stale: [] });
  });
});
