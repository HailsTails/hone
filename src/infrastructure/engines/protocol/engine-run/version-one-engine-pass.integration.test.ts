import { afterAll, assert, describe, expect, it, vi } from "vitest";
import { createSelectionRepository } from "../../../disciplines-file/consumer-selection.ts";
import { createDefaultFileRemovalPort } from "../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import type { GitPort } from "../../../git/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import type { Finding } from "../../../command-line/governance.ts";
import { createSymptomCatalogueRepository } from "../../../content-files/symptom-catalogues/read-symptom-catalogue.ts";
import type { Check } from "../../../../domain/language-layer/symptom-catalogue.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../../../hone-config-file/assessment.ts";
import { clauseAddressSchema, TOOL_RULE_SET } from "../../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../hone-config-file/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { runProject } from "../../../../application/projection/run-project.ts";
import { createEslintRunner } from "../../eslint/runner/embedded-runner/create-eslint-runner.ts";
import { repositoryRootOf } from "../../../../../tests/allowed-forms-proof.ts";
import { defaultEslintPort } from "../../../../../tests/eslint-toolchains.ts";
import { withSingleFileRecords } from "../../../../../tests/records-disk.ts";
import { createDefaultScratchFilesPort } from "../../../../../delivery/install-proof/install-proof-ports.ts";
import { shippedCheckOf } from "../../../../../tests/shipped-check.ts";
import { repositoryWithSubfolder } from "../../../../../tests/subfolder-scratch-repository.ts";
import { scratchRepositoriesUnder } from "../../../../../tests/scratch-repositories.ts";
import { createAnsweringOracle } from "../../../../application/upgrade/record-answers/answering-oracle.ts";
import type { FileCarveOutRecord } from "../../../../application/upgrade/record-answers/record-answer-oracle.ts";
import { createVersionOneEnginePass } from "./version-one-engine-pass.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const INSTALL_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: `${import.meta.dirname}/../../../../../tests` }));

const SCRATCH = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch: SCRATCH });

afterAll(() => {
  repositories.removeAll();
});

const SELECTION = '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const EXCEPTIONS = '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "src/kept.ts", "reason": "legacy class" }] }\n';

const TEAM_CONFIG = 'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];\n';

const UNPROJECTING_CONFIG = 'export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }];\n';

const KEPT_SOURCE = "export class Kept {}\n";

const resolvedRunner = path.resolve({ path: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/runner/runner.ts` });
assert(resolvedRunner.outcome === "ok", "the ESLint runner path resolves");

const ESLINT_RUNNER = resolvedRunner.value;

type CheckPorts = {
  readonly modules: ModuleLoaderPort;
  readonly ports: {
    readonly repoRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
    readonly moduleExtension: ".ts";
    readonly fileText: typeof fileText;
    readonly path: typeof path;
    readonly git: GitPort;
  };
};

const checkPortsOver = (request: { readonly repoRoot: AbsolutePath; readonly tracked: readonly RepoPath[] }): CheckPorts => {
  const pieceModules: ModuleLoaderPort = { load: createDefaultModuleLoaderPort({}).load };
  const runners: Readonly<Record<string, unknown>> = {
    [ESLINT_RUNNER]: { runner: createEslintRunner({ fileText, fileRemoval: createDefaultFileRemovalPort({}), modules: pieceModules, path, eslint: defaultEslintPort, moduleExtension: ".ts" }) },
  };
  const modules: ModuleLoaderPort = { load: ({ path: loaded }) => Promise.resolve({ outcome: "ok", value: runners[loaded] }) };
  return { modules, ports: { repoRoot: request.repoRoot, installRoot: INSTALL_ROOT, moduleExtension: ".ts" as const, fileText, path, git: trackedIn({ files: request.tracked }) } };
};

const repositoryOf = (request: { readonly files: Readonly<Record<string, string>> }): AbsolutePath =>
  repositoryWithSubfolder({ repositories, scratch: SCRATCH, fileText, files: request.files, subfolder: "src", subfolderFiles: { "kept.ts": KEPT_SOURCE } });

const carvedRepository = async (): Promise<AbsolutePath> => {
  const repoRoot = repositoryOf({ files: { "disciplines.json": SELECTION, "discipline-exceptions.json": EXCEPTIONS, "eslint.config.mjs": TEAM_CONFIG } });
  const { modules, ports } = checkPortsOver({ repoRoot, tracked: [] });
  const projected = await runProject({ ...withSingleFileRecords({ ...ports, modules }), modules });
  assert(projected.outcome === "ok", "the carved repository's projection is written by hone project");
  return repoRoot;
};

const unprojectedRepository = (): AbsolutePath =>
  repositoryOf({ files: { "disciplines.json": SELECTION, "discipline-exceptions.json": EXCEPTIONS, "eslint.config.mjs": UNPROJECTING_CONFIG } });

const KEPT = repoPathSchema.parse("src/kept.ts");

const CARVE_OUT: FileCarveOutRecord = {
  kind: "file-carve-out",
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  mechanism: mechanismIdSchema.parse("eslint"),
  file: KEPT,
  reason: "legacy class",
};

const CLASS_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  file: KEPT,
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
  mechanism: mechanismIdSchema.parse("eslint"),
};

const catalogues = () => {
  const holding = createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: INSTALL_ROOT }).read({});
  assert(holding.outcome === "ok", "the shipped symptom catalogue reads");
  assert(holding.value.held === "catalogue", "the shipped symptom catalogue is present");
  return [{ ruleSet: TOOL_RULE_SET, catalogue: holding.value.catalogue }];
};

const classKeywordCheck = (): Check => shippedCheckOf({ catalogues: catalogues(), discipline: "CD-14", name: "class-keyword" });

const trackedIn =(request: { readonly files: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.files }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const enginePassOver = (request: { readonly repoRoot: AbsolutePath; readonly tracked: readonly RepoPath[] }) => {
  const { modules, ports } = checkPortsOver(request);
  return createVersionOneEnginePass({
    check: { ...withSingleFileRecords({ ...ports, modules }), modules, baseRevision: undefined, assessment: DEFAULT_ASSESSMENT, selectionRepository: createSelectionRepository(ports) },
  });
};

const CARVED_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("disciplines.eslint.mjs"),
  repoPathSchema.parse("eslint.config.mjs"),
  repoPathSchema.parse("discipline-exceptions.json"),
  repoPathSchema.parse("src/kept.ts"),
];

const UNPROJECTED_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("eslint.config.mjs"),
  repoPathSchema.parse("discipline-exceptions.json"),
  repoPathSchema.parse("src/kept.ts"),
];

describe("the version 1 engine pass over a real ESLint run of a repository that carves out src/kept.ts", () => {
  it("returns the class finding raw, though the projection it ran under carries the carve-out as a config override", async () => {
    const pass = enginePassOver({ repoRoot: await carvedRepository(), tracked: CARVED_TRACKED });
    const withCarveOut = await pass.findingsFor({ records: [CARVE_OUT] });
    assert(withCarveOut.outcome === "ok", "the pass runs");
    expect(withCarveOut.value.findings).toEqual([CLASS_FINDING]);
  });

  it("refuses the same projection when given no records, since the records are what its override was projected from", async () => {
    const pass = enginePassOver({ repoRoot: await carvedRepository(), tracked: CARVED_TRACKED });
    await expect(pass.findingsFor({ records: [] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.eslint.mjs", state: "out-of-date" },
    });
  });

  it("lets the oracle credit the carve-out with the findings it holds", async () => {
    const oracle = createAnsweringOracle({ enginePass: enginePassOver({ repoRoot: await carvedRepository(), tracked: CARVED_TRACKED }), catalogues: catalogues() });
    const answered = await oracle.answer({ records: [CARVE_OUT] });
    expect(answered).toEqual({ outcome: "ok", value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "findings", checks: [classKeywordCheck()] } }] });
  });
});

describe("the version 1 engine pass over a real ESLint run of a repository whose config does not include the projection", () => {
  it("fails the pass, since the run was not made", async () => {
    const pass = enginePassOver({ repoRoot: unprojectedRepository(), tracked: UNPROJECTED_TRACKED });
    await expect(pass.findingsFor({ records: [CARVE_OUT] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.eslint.mjs", state: "missing" },
    });
  });
});
