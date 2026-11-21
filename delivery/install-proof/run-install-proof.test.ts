import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import type { ProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import type { Result } from "../../src/domain/result.ts";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { ProofCase, StepRun } from "./install-proof-plan.ts";
import type { CommandRunPort, EffectFailure, ListedEntry, ScratchFilesPort } from "./install-proof-ports.ts";
import type { TarballPackerPort } from "../packaging/packing/package-commands.ts";
import { type InstallProofRequest, runInstallProof } from "./run-install-proof.ts";

const ENTRY_URL = "file:///package/delivery/install-proof/install-proof.ts";

const PACKAGE_MANIFEST =
  '{ "packageManager": "pnpm@10.34.9", "dependencies": { "zod": "^4.4.3" }, "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": { "typescript-floor": "npm:typescript@4.8.4" } }';

const consumerManifestPinning = (request: { readonly tarball: string }): string => `${JSON.stringify(
  {
    private: true,
    type: "commonjs",
    packageManager: "pnpm@10.34.9",
    scripts: {
      "hone:check": "hone check --repo .",
      "hone:project": "hone project --repo .",
    },
    devDependencies: { typescript: "4.8.4", "@hailstails/hone": request.tarball },
  },
  null,
  2,
)}\n`;

const CONSUMER_MANIFEST = consumerManifestPinning({ tarball: "file:../package-tarball/hailstails-hone-0.0.0.tgz" });

const CONSUMER_MANIFEST_PINNING_GIVEN_TARBALL = consumerManifestPinning({ tarball: "file:../given-tarball/hailstails-hone.tgz" });

const CONSUMER = "/scratch/audit";

const SECOND_REPO = "/scratch/second";

const STORED_PACKAGE = "/node_modules/.pnpm/hone/node_modules/@hailstails/hone";

const INSTALLED_ZOD = `${CONSUMER}/node_modules/.pnpm/hone/node_modules/zod`;

const installedZodManifest = (request: { readonly version: string }): string => `{ "name": "zod", "version": "${request.version}" }`;

const TARBALL = "/scratch/package-tarball/hailstails-hone-0.0.0.tgz";

const PROJECTION = 'import piece0 from "@hailstails/hone/src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.js";\n';

const PACKAGE_FILES: Readonly<Record<string, string>> = {
  "/package/package.json": PACKAGE_MANIFEST,
  "/package/pnpm-workspace.yaml": "minimumReleaseAge: 4320\n",
  [`${CONSUMER}/disciplines.eslint.mjs`]: PROJECTION,
  [`${INSTALLED_ZOD}/package.json`]: installedZodManifest({ version: "4.4.3" }),
  [`${SECOND_REPO}/node_modules/.pnpm/hone/node_modules/zod/package.json`]: installedZodManifest({ version: "4.4.3" }),
  "/scratch/typed/node_modules/.pnpm/hone/node_modules/zod/package.json": installedZodManifest({ version: "4.4.3" }),
};

const EXPECTING_PASS: ProofCase = {
  consumer: "audit",
  fixture: "audit",
  toolchain: "typescript-floor",
  typeStripping: "disabled",
  actions: [
    { kind: "check", expectation: { exitCode: 0, output: "verdict: pass\n" } },
    { kind: "project", expectation: { exitCode: 0, output: "verdict: pass\n" } },
    { kind: "read", path: "disciplines.eslint.mjs", text: PROJECTION },
  ],
};

const EXPECTING_FAIL: ProofCase = {
  ...EXPECTING_PASS,
  actions: [{ kind: "check", expectation: { exitCode: 1, output: "verdict: fail\n" } }],
};

const REPORT_OF_FINDINGS = "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n";

const EXPECTING_FINDINGS: ProofCase = {
  ...EXPECTING_PASS,
  actions: [{ kind: "check", expectation: { exitCode: 1, output: REPORT_OF_FINDINGS } }],
};

const SECOND_CONSUMER: ProofCase = { ...EXPECTING_PASS, consumer: "second", actions: [] };

const INSTALLED_PACKAGE: readonly ListedEntry[] = [
  { path: "src", name: "src", entryKind: "folder" },
  { path: "src/hone.js", name: "hone.js", entryKind: "file" },
];

const INSTALLED_PACKAGE_WITH_DECLARATIONS: readonly ListedEntry[] = [
  ...INSTALLED_PACKAGE,
  { path: "api/audit.d.ts", name: "audit.d.ts", entryKind: "file" },
  { path: "api/audit.js", name: "audit.js", entryKind: "file" },
];

const EXPECTING_TYPES: ProofCase = {
  consumer: "typed",
  fixture: "team",
  toolchain: "typescript-floor",
  typeStripping: "disabled",
  actions: [{ kind: "typecheck", project: "tsconfig.nodenext.json", expectation: { exitCode: 0, output: "" } }],
};

const INSTALLED_PACKAGE_WITH_SOURCE: readonly ListedEntry[] = [
  ...INSTALLED_PACKAGE,
  { path: "core/check/run-check.ts", name: "run-check.ts", entryKind: "file" },
];

const EXITED_PASSING: StepRun = { outcome: "exited", exitCode: 0, output: "verdict: pass\n" };

const EXITED_INSTALL_ERROR: StepRun = { outcome: "exited", exitCode: 1, output: "ERR_PNPM_FETCH_404" };

const SCRATCH_FAILURE: { readonly outcome: "failed"; readonly error: EffectFailure } = {
  outcome: "failed",
  error: { kind: "effect-failed", detail: "EBUSY: resource busy" },
};

const processPort = (scriptArguments: readonly string[] = []): ProcessPort => ({
  arguments: scriptArguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const fileTextPort = (overrides: Readonly<Record<string, string>> = {}): FileTextPort => ({
  read: ({ path }) => ({ outcome: "ok", value: requiredEntry({ table: { ...PACKAGE_FILES, ...overrides }, key: path }) }),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const LINKED_PACKAGE = "/node_modules/@hailstails/hone";

const realPathsOf = (request: { readonly consumer: string; readonly installed: string }): ScratchFilesPort["realPathOf"] =>
  vi
    .fn<ScratchFilesPort["realPathOf"]>()
    .mockReturnValueOnce({ outcome: "ok", value: request.consumer })
    .mockReturnValue({ outcome: "ok", value: request.installed });

const realPathsOfTwoConsumers = (): ScratchFilesPort["realPathOf"] =>
  vi
    .fn<ScratchFilesPort["realPathOf"]>()
    .mockReturnValueOnce({ outcome: "ok", value: CONSUMER })
    .mockReturnValueOnce({ outcome: "ok", value: `${CONSUMER}${STORED_PACKAGE}` })
    .mockReturnValueOnce({ outcome: "ok", value: SECOND_REPO })
    .mockReturnValue({ outcome: "ok", value: `${SECOND_REPO}${STORED_PACKAGE}` });

const scratchPort = (overrides: Partial<ScratchFilesPort>): ScratchFilesPort => ({
  createTemporaryDirectory: vi.fn<ScratchFilesPort["createTemporaryDirectory"]>().mockReturnValue({ outcome: "ok", value: "/scratch" }),
  removeTree: vi.fn<ScratchFilesPort["removeTree"]>().mockReturnValue({ outcome: "ok", value: null }),
  makeDirectory: vi.fn<ScratchFilesPort["makeDirectory"]>().mockReturnValue({ outcome: "ok", value: null }),
  copyTree: vi.fn<ScratchFilesPort["copyTree"]>().mockReturnValue({ outcome: "ok", value: null }),
  listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE }),
  digestOf: vi.fn<ScratchFilesPort["digestOf"]>().mockReturnValue({ outcome: "ok", value: "digest" }),
  realPathOf: realPathsOf({ consumer: CONSUMER, installed: `${CONSUMER}${STORED_PACKAGE}` }),
  ...overrides,
});

const packerReturning = (tarball: Result<string, string>): TarballPackerPort => ({
  pack: vi.fn<TarballPackerPort["pack"]>().mockResolvedValue(tarball),
});

const commandsReturning = (run: StepRun): CommandRunPort => ({
  run: vi.fn<CommandRunPort["run"]>().mockReturnValue(run),
});

const proofRequest = (overrides: Partial<InstallProofRequest>): InstallProofRequest => ({
  process: processPort(),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
  fileText: fileTextPort(),
  scratch: scratchPort({}),
  commands: commandsReturning(EXITED_PASSING),
  packer: packerReturning({ outcome: "ok", value: TARBALL }),
  moduleUrl: ENTRY_URL,
  proofCases: [EXPECTING_PASS],
  ...overrides,
});

const reportOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("runInstallProof, finding where pnpm put the package", () => {
  it("measures the package's real path from the consumer's own real path, so a temporary root spelled two ways names one place", async () => {
    const proofProcess = processPort();
    const realPathOf = realPathsOf({ consumer: "/long-scratch/audit", installed: `/long-scratch/audit${STORED_PACKAGE}` });

    await runInstallProof(proofRequest({ process: proofProcess, scratch: scratchPort({ realPathOf }) }));

    expect({ asked: vi.mocked(realPathOf).mock.calls, located: reportOf({ process: proofProcess }).writes[1] }).toEqual({
      asked: [[{ path: CONSUMER }], [{ path: `${CONSUMER}${LINKED_PACKAGE}` }]],
      located: [{ text: "ok: audit runs the package from node_modules/.pnpm/hone/node_modules/@hailstails/hone\n" }],
    });
  });

  it("exits 1 naming both real paths when the package lands outside its consumer, running nothing after it", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands,
        scratch: scratchPort({ realPathOf: realPathsOf({ consumer: CONSUMER, installed: "/scratch/store/hone" }) }),
      }),
    );

    expect({ report: reportOf({ process: proofProcess }), runs: vi.mocked(commands.run).mock.calls.length }).toEqual({
      report: {
        writes: [
          [{ text: "ok: audit installed package holds no TypeScript source to strip\n" }],
          [{ text: "FAIL: audit runs the package from where pnpm put it: /scratch/store/hone lies outside /scratch/audit\n" }],
        ],
        exits: [[{ code: 1 }]],
      },
      runs: 1,
    });
  });
});

describe("runInstallProof", () => {
  it("exits 0 printing that the installed package holds no TypeScript source, each command's ok line, the projection's package import and the pass line", async () => {
    const proofProcess = processPort();

    await runInstallProof(proofRequest({ process: proofProcess }));

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit installed package holds no TypeScript source to strip\n" }],
        [{ text: "ok: audit runs the package from node_modules/.pnpm/hone/node_modules/@hailstails/hone\n" }],
        [{ text: "ok: audit resolves zod 4.4.3 beside the package, within each published range, where pnpm installed it\n" }],
        [{ text: "ok: audit check -> exit 0, output exactly as expected\n" }],
        [{ text: "ok: audit project -> exit 0, output exactly as expected\n" }],
        [{ text: "ok: audit disciplines.eslint.mjs reads exactly as expected\n" }],
        [{ text: "install proof: pass\n" }],
      ],
      exits: [[{ code: 0 }]],
    });
  });

  it("accepts a dependency pnpm installed beside the package at a newer release inside the published range", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({ process: proofProcess, fileText: fileTextPort({ [`${INSTALLED_ZOD}/package.json`]: installedZodManifest({ version: "4.9.1" }) }) }),
    );

    expect(reportOf({ process: proofProcess })).toMatchObject({
      writes: expect.arrayContaining([[{ text: "ok: audit resolves zod 4.9.1 beside the package, within each published range, where pnpm installed it\n" }]]),
      exits: [[{ code: 0 }]],
    });
  });

  it("exits 1 naming a dependency pnpm installed beside the package outside the published range, running nothing after the install", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands,
        fileText: fileTextPort({ [`${INSTALLED_ZOD}/package.json`]: installedZodManifest({ version: "5.0.0" }) }),
      }),
    );

    expect(proofProcess.writeOut).toHaveBeenLastCalledWith({
      text: `FAIL: audit resolves each dependency beside the package: zod is 5.0.0 at ${INSTALLED_ZOD}, outside the published ^4.4.3\n`,
    });
    expect(commands.run).toHaveBeenCalledTimes(1);
  });

  it("exits 1 naming a dependency the package pins that pnpm did not install beside it", async () => {
    const proofProcess = processPort();
    const missingZod = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: PACKAGE_MANIFEST })
      .mockReturnValueOnce({ outcome: "ok", value: "minimumReleaseAge: 4320\n" })
      .mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: `${INSTALLED_ZOD}/package.json`, detail: "ENOENT" } });

    await runInstallProof(proofRequest({ process: proofProcess, fileText: { ...fileTextPort(), read: missingZod } }));

    expect(proofProcess.writeOut).toHaveBeenLastCalledWith({
      text: `FAIL: audit resolves each dependency beside the package: zod is not installed at ${INSTALLED_ZOD}: ENOENT\n`,
    });
  });

  it("packs the package once inside the temporary root, from the package root", async () => {
    const packer = packerReturning({ outcome: "ok", value: TARBALL });

    await runInstallProof(
      proofRequest({ packer, scratch: scratchPort({ realPathOf: realPathsOfTwoConsumers() }), proofCases: [EXPECTING_PASS, SECOND_CONSUMER] }),
    );

    expect(vi.mocked(packer.pack).mock.calls).toEqual([[{ packageRoot: "/package", workRoot: "/scratch" }]]);
  });

  it("writes the consumer's manifest pinning this package's pnpm, every peer of its toolchain and the packed tarball, its ignore file, and pnpm settings waiting this repository's release age with type stripping off", async () => {
    const fileText = fileTextPort();

    await runInstallProof(proofRequest({ fileText }));

    expect(vi.mocked(fileText.write).mock.calls).toEqual([
      [{ path: `${CONSUMER}/package.json`, text: CONSUMER_MANIFEST }],
      [{ path: `${CONSUMER}/.gitignore`, text: "node_modules/\n" }],
      [{ path: `${CONSUMER}/.npmrc`, text: "minimum-release-age=4320\nnode-options=--no-experimental-strip-types\n" }],
    ]);
  });

  it("leaves type stripping on for a consumer that runs its own TypeScript through it", async () => {
    const fileText = fileTextPort();

    await runInstallProof(proofRequest({ fileText, proofCases: [{ ...EXPECTING_PASS, typeStripping: "enabled" }] }));

    expect(vi.mocked(fileText.write).mock.calls[2]).toEqual([{ path: `${CONSUMER}/.npmrc`, text: "minimum-release-age=4320\n" }]);
  });

  it("installs the consumer with pnpm, then runs git and both commands through its pnpm scripts, passing check's options after --", async () => {
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(proofRequest({ commands }));

    expect(vi.mocked(commands.run).mock.calls).toEqual([
      [{ command: "pnpm", arguments: ["install", "--ignore-scripts", "--prefer-offline", "--no-frozen-lockfile"], directory: CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["init", "-q"]), directory: CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["add", "-A"]), directory: CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["commit", "-q", "-m", "consumer"]), directory: CONSUMER }],
      [{ command: "pnpm", arguments: ["run", "--silent", "hone:check", "--", "--base-revision", "HEAD"], directory: CONSUMER }],
      [{ command: "pnpm", arguments: ["run", "--silent", "hone:project"], directory: CONSUMER }],
    ]);
  });

  it("installs each consumer by itself, in its own folder under the temporary root", async () => {
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      proofRequest({ commands, scratch: scratchPort({ realPathOf: realPathsOfTwoConsumers() }), proofCases: [EXPECTING_PASS, SECOND_CONSUMER] }),
    );

    expect(commands.run).toHaveBeenNthCalledWith(7, {
      command: "pnpm",
      arguments: ["install", "--ignore-scripts", "--prefer-offline", "--no-frozen-lockfile"],
      directory: "/scratch/second",
    });
  });

  it.each([
    { printed: "node_modules/@hailstails/hone/ADOPTING.md", exit: 0 },
    { printed: "node_modules/.pnpm/hone/node_modules/@hailstails/hone/ADOPTING.md", exit: 1 },
  ])("expects the package's own pages through the consumer's node_modules link, not where pnpm put the package, given $printed", async ({ printed, exit }) => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands: commandsReturning({ outcome: "exited", exitCode: 0, output: `read ${printed}\n` }),
        proofCases: [
          { ...EXPECTING_PASS, actions: [{ kind: "check", expectation: { exitCode: 0, output: "read node_modules/@hailstails/hone/ADOPTING.md\n" } }] },
        ],
      }),
    );

    expect(reportOf({ process: proofProcess }).exits).toEqual([[{ code: exit }]]);
  });

  it("copies only the consumer fixture: the package manager installs core", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(vi.mocked(scratch.copyTree).mock.calls).toEqual([
      [expect.objectContaining({ from: "/package/delivery/install-proof/consumer-proof/audit", to: CONSUMER })],
    ]);
  });

  it("creates its temporary directory under the package's file stem, which holds no path separator", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(vi.mocked(scratch.createTemporaryDirectory).mock.calls).toEqual([[{ prefix: "hailstails-hone-install-proof-" }]]);
  });

  it("lists the installed package under the consumer's node_modules for the source check", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(vi.mocked(scratch.listTree).mock.calls).toEqual([[{ path: `${CONSUMER}/node_modules/@hailstails/hone` }]]);
  });

  it("passes the source check when the installed package ships declaration files beside its modules", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        scratch: scratchPort({
          listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE_WITH_DECLARATIONS }),
        }),
      }),
    );

    expect(reportOf({ process: proofProcess }).exits).toEqual([[{ code: 0 }]]);
  });

  it("type-checks a consumer project with the consumer's own installed tsc, judging its exit and output like a command", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning({ outcome: "exited", exitCode: 0, output: "" });

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands,
        proofCases: [EXPECTING_TYPES],
      }),
    );

    expect(commands.run).toHaveBeenLastCalledWith({
      command: "node",
      arguments: ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.nodenext.json"],
      directory: "/scratch/typed",
    });
    expect(reportOf({ process: proofProcess }).writes).toContainEqual([{ text: "ok: typed tsc -p tsconfig.nodenext.json -> exit 0, output exactly as expected\n" }]);
  });

  it("runs a workspace package's own lint script from the package folder, judging its exit and output like a command", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands,
        proofCases: [
          {
            ...EXPECTING_PASS,
            actions: [
              { kind: "lint", directory: "packages/web", expectation: { exitCode: 0, output: "verdict: pass\n" } },
            ],
          },
        ],
      }),
    );

    expect(commands.run).toHaveBeenLastCalledWith({
      command: "pnpm",
      arguments: ["run", "--silent", "lint"],
      directory: `${CONSUMER}/packages/web`,
    });
    expect(reportOf({ process: proofProcess }).writes).toContainEqual([
      { text: "ok: audit lint in packages/web -> exit 0, output exactly as expected\n" },
    ]);
  });

  it("runs a consumer's own script with node from the consumer repo, judging its exit and output like a command", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning({ outcome: "exited", exitCode: 0, output: "" });

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands,
        proofCases: [{ ...EXPECTING_TYPES, actions: [{ kind: "run", script: "tools/proof.ts", expectation: { exitCode: 0, output: "" } }] }],
      }),
    );

    expect(commands.run).toHaveBeenLastCalledWith({ command: "node", arguments: ["tools/proof.ts"], directory: "/scratch/typed" });
    expect(reportOf({ process: proofProcess }).writes).toContainEqual([{ text: "ok: typed node tools/proof.ts -> exit 0, output exactly as expected\n" }]);
  });

  it("judges a consumer script's report with the platform's carriage returns read as plain line feeds", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands: commandsReturning({ outcome: "exited", exitCode: 0, output: "proved\r\n" }),
        proofCases: [{ ...EXPECTING_TYPES, actions: [{ kind: "run", script: "tools/proof.ts", expectation: { exitCode: 0, output: "proved\n" } }] }],
      }),
    );

    expect(reportOf({ process: proofProcess }).writes).toContainEqual([{ text: "ok: typed node tools/proof.ts -> exit 0, output exactly as expected\n" }]);
  });
  it("judges the compiler's report with the platform's carriage returns read as plain line feeds", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands: commandsReturning({ outcome: "exited", exitCode: 0, output: "src/team.mts: reported\r\n  detail\r\n" }),
        proofCases: [
          {
            ...EXPECTING_TYPES,
            actions: [{ kind: "typecheck", project: "tsconfig.wrong.json", expectation: { exitCode: 0, output: "src/team.mts: reported\n  detail\n" } }],
          },
        ],
      }),
    );

    expect(reportOf({ process: proofProcess }).writes).toContainEqual([{ text: "ok: typed tsc -p tsconfig.wrong.json -> exit 0, output exactly as expected\n" }]);
  });

  it("exits 1 naming the count when the installed package holds a .ts file", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        scratch: scratchPort({
          listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE_WITH_SOURCE }),
        }),
      }),
    );

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [
          {
            text: `FAIL: audit installed package holds no TypeScript source to strip: found 1 .ts and 1 .js files under ${CONSUMER}/node_modules/@hailstails/hone\n`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 1 showing both texts when the projection differs from the expected text", async () => {
    const proofProcess = processPort();
    const expected = 'import piece0 from "./node_modules/@hailstails/hone/x.js";\n';

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        proofCases: [{ ...EXPECTING_PASS, actions: [{ kind: "read", path: "disciplines.eslint.mjs", text: expected }] }],
      }),
    );

    expect(proofProcess.writeOut).toHaveBeenLastCalledWith({
      text: `FAIL: audit disciplines.eslint.mjs: expected ${JSON.stringify(expected)}, but it reads ${JSON.stringify(PROJECTION)}\n`,
    });
  });

  it("exits 1 when the built package prints a report whose finding line differs, though its exit and verdict match", async () => {
    const proofProcess = processPort();
    const altered = "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:1 missing co-located *.test.ts(x) sibling\nverdict: fail\n";

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands: {
          run: vi
            .fn<CommandRunPort["run"]>()
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValue({ outcome: "exited", exitCode: 1, output: altered }),
        },
        proofCases: [EXPECTING_FINDINGS],
      }),
    );

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit installed package holds no TypeScript source to strip\n" }],
        [{ text: "ok: audit runs the package from node_modules/.pnpm/hone/node_modules/@hailstails/hone\n" }],
        [{ text: "ok: audit resolves zod 4.4.3 beside the package, within each published range, where pnpm installed it\n" }],
        [
          {
            text: `FAIL: audit check: expected exit 1 and output ${JSON.stringify(REPORT_OF_FINDINGS)}, got exit 1 and output ${JSON.stringify(altered)}\n`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 1 with the FAIL line when a step's exit code does not meet its expectation", async () => {
    const proofProcess = processPort();

    await runInstallProof(proofRequest({ process: proofProcess, proofCases: [EXPECTING_FAIL] }));

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit installed package holds no TypeScript source to strip\n" }],
        [{ text: "ok: audit runs the package from node_modules/.pnpm/hone/node_modules/@hailstails/hone\n" }],
        [{ text: "ok: audit resolves zod 4.4.3 beside the package, within each published range, where pnpm installed it\n" }],
        [{ text: 'FAIL: audit check: expected exit 1 and output "verdict: fail\\n", got exit 0 and output "verdict: pass\\n"\n' }],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("removes the temporary consumer root when a step fails", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch, proofCases: [EXPECTING_FAIL] }));

    expect(vi.mocked(scratch.removeTree).mock.calls).toEqual([[{ path: "/scratch" }]]);
  });

  it("exits 1 with pnpm's output when the consumer install fails, running nothing after it", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_INSTALL_ERROR);

    await runInstallProof(proofRequest({ process: proofProcess, commands }));

    expect({ report: reportOf({ process: proofProcess }), runs: vi.mocked(commands.run).mock.calls.length }).toEqual({
      report: {
        writes: [[{ text: "FAIL: pnpm install the packed tarball into audit: exit 1\nERR_PNPM_FETCH_404\n" }]],
        exits: [[{ code: 1 }]],
      },
      runs: 1,
    });
  });

  it("exits 1 with the packer's failure, running no consumer and removing the temporary root", async () => {
    const proofProcess = processPort();
    const scratch = scratchPort({});
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      proofRequest({ process: proofProcess, scratch, commands, packer: packerReturning({ outcome: "failed", error: "FAIL: bundle: Could not resolve" }) }),
    );

    expect({
      report: reportOf({ process: proofProcess }),
      runs: vi.mocked(commands.run).mock.calls,
      removed: vi.mocked(scratch.removeTree).mock.calls,
    }).toEqual({
      report: { writes: [[{ text: "FAIL: bundle: Could not resolve\n" }]], exits: [[{ code: 1 }]] },
      runs: [],
      removed: [[{ path: "/scratch" }]],
    });
  });

  it("exits 1 when the temporary consumer root cannot be removed after the steps pass", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        scratch: scratchPort({ removeTree: vi.fn<ScratchFilesPort["removeTree"]>().mockReturnValue(SCRATCH_FAILURE) }),
      }),
    );

    expect(reportOf({ process: proofProcess }).exits).toEqual([[{ code: 1 }]]);
  });

  it("exits 1 creating nothing further when the temporary consumer root cannot be created", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands,
        scratch: scratchPort({
          createTemporaryDirectory: vi.fn<ScratchFilesPort["createTemporaryDirectory"]>().mockReturnValue(SCRATCH_FAILURE),
        }),
      }),
    );

    expect({ report: reportOf({ process: proofProcess }), runs: vi.mocked(commands.run).mock.calls }).toEqual({
      report: {
        writes: [[{ text: "FAIL: create the temporary consumer root: EBUSY: resource busy\n" }]],
        exits: [[{ code: 1 }]],
      },
      runs: [],
    });
  });

  it("exits 1 naming the package root it cannot locate from a module URL that is not a file", async () => {
    const proofProcess = processPort();

    await runInstallProof(proofRequest({ process: proofProcess, moduleUrl: "https://example.com/install-proof.ts" }));

    expect(reportOf({ process: proofProcess }).exits).toEqual([[{ code: 1 }]]);
  });
});

const GIVEN_TARBALL = "/artefacts/hailstails-hone-1.0.0.tgz";

const COPIED_TARBALL = "/scratch/given-tarball/hailstails-hone.tgz";

describe("runInstallProof, given a tarball to prove", () => {
  it("copies the given tarball into the temporary root and installs that copy, packing nothing", async () => {
    const proofProcess = processPort(["--tarball", GIVEN_TARBALL]);
    const packer = packerReturning({ outcome: "ok", value: TARBALL });
    const scratch = scratchPort({});
    const fileText = fileTextPort();

    await runInstallProof(proofRequest({ process: proofProcess, packer, scratch, fileText }));

    expect({
      packed: vi.mocked(packer.pack).mock.calls,
      copied: vi.mocked(scratch.copyTree).mock.calls[0],
      manifest: vi.mocked(fileText.write).mock.calls[0],
      exits: reportOf({ process: proofProcess }).exits,
    }).toEqual({
      packed: [],
      copied: [expect.objectContaining({ from: GIVEN_TARBALL, to: COPIED_TARBALL })],
      manifest: [
        {
          path: `${CONSUMER}/package.json`,
          text: CONSUMER_MANIFEST_PINNING_GIVEN_TARBALL,
        },
      ],
      exits: [[{ code: 0 }]],
    });
  });

  it("resolves a relative tarball path against the working directory", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ process: processPort(["--tarball", "artefacts/hailstails-hone-1.0.0.tgz"]), scratch }));

    expect(vi.mocked(scratch.copyTree).mock.calls[0]).toEqual([expect.objectContaining({ from: GIVEN_TARBALL, to: COPIED_TARBALL })]);
  });
});

describe("runInstallProof, failing to take the given tarball", () => {
  it("exits 1 naming a relative tarball path it cannot resolve when the working directory is unusable, creating nothing", async () => {
    const proofProcess = processPort(["--tarball", "artefacts/hailstails-hone-1.0.0.tgz"]);
    const scratch = scratchPort({});

    await runInstallProof(
      proofRequest({ process: proofProcess, scratch, path: createPathPort({ flavour: "posix", workingDirectory: () => "unusable" }) }),
    );

    expect({ report: reportOf({ process: proofProcess }), created: vi.mocked(scratch.createTemporaryDirectory).mock.calls }).toEqual({
      report: {
        writes: [[{ text: "FAIL: resolve artefacts/hailstails-hone-1.0.0.tgz: the working directory is unusable\n" }]],
        exits: [[{ code: 1 }]],
      },
      created: [],
    });
  });

  it("exits 1 naming the copy that failed, running no consumer and removing the temporary root", async () => {
    const proofProcess = processPort(["--tarball", GIVEN_TARBALL]);
    const commands = commandsReturning(EXITED_PASSING);
    const scratch = scratchPort({ copyTree: vi.fn<ScratchFilesPort["copyTree"]>().mockReturnValue(SCRATCH_FAILURE) });

    await runInstallProof(proofRequest({ process: proofProcess, commands, scratch }));

    expect({
      report: reportOf({ process: proofProcess }),
      runs: vi.mocked(commands.run).mock.calls,
      removed: vi.mocked(scratch.removeTree).mock.calls,
    }).toEqual({
      report: {
        writes: [[{ text: `FAIL: copy ${GIVEN_TARBALL} into the temporary consumer root: EBUSY: resource busy\n` }]],
        exits: [[{ code: 1 }]],
      },
      runs: [],
      removed: [[{ path: "/scratch" }]],
    });
  });
});

describe("runInstallProof, taking its arguments", () => {
  it.each([[["--tarball"]], [["--tarball", GIVEN_TARBALL, "--tarball", GIVEN_TARBALL]], [["--pack"]]])(
    "exits 1 naming the arguments it takes, creating nothing, given %j",
    async (scriptArguments) => {
      const proofProcess = processPort(scriptArguments);
      const scratch = scratchPort({});

      await runInstallProof(proofRequest({ process: proofProcess, scratch }));

      expect({ report: reportOf({ process: proofProcess }), created: vi.mocked(scratch.createTemporaryDirectory).mock.calls }).toEqual({
        report: {
          writes: [
            [
              {
                text: `FAIL: install-proof takes no arguments, to pack the package itself, or --tarball <path>, to prove a packed tarball; got ${JSON.stringify(scriptArguments)}\n`,
              },
            ],
          ],
          exits: [[{ code: 1 }]],
        },
        created: [],
      });
    },
  );
});
