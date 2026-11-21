import { describe, expect, it, vi } from "vitest";
import type { ExceptionRepository } from "../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import type { LoadFailure } from "../../infrastructure/command-line/load-failure.ts";
import { type PruneCheck, paidDebtRemoved, type RunSettingsReader } from "./run-prune-debt-command.ts";

const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");
const ESLINT = mechanismIdSchema.parse("eslint");
const LEGACY = repoPathSchema.parse("src/legacy.ts");

const PAID_PAIR = { clause: CLASS_SYNTAX, file: LEGACY };

const NOTHING_PAID = { paidDebt: [] };

const LEGACY_PAID = { paidDebt: [PAID_PAIR] };

const SETTINGS_UNREADABLE: Result<never, LoadFailure> = {
  outcome: "failed",
  error: { kind: "file-unreadable", path: "/repo/disciplines.json", detail: "EACCES" },
};

const CHECK_FAILED: Result<never, LoadFailure> = { outcome: "failed", error: { kind: "runner-missing", mechanism: ESLINT } };

const settingsConfiguring = (forfeiture: "this-run" | "elsewhere"): RunSettingsReader => ({
  read: vi.fn<RunSettingsReader["read"]>().mockReturnValue({ outcome: "ok", value: { reportOutput: "full", assessment: { forfeiture } } }),
});

const checkReporting = (answer: Awaited<ReturnType<PruneCheck>>) => vi.fn<PruneCheck>().mockResolvedValue(answer);

const recordsRemoving = (answer: ReturnType<ExceptionRepository["remove"]>) => ({
  remove: vi.fn<ExceptionRepository["remove"]>().mockReturnValue(answer),
});

const NO_ARGUMENTS = { baseRevision: undefined, forfeiture: undefined };

describe("paidDebtRemoved removing what the check reports paid", () => {
  it("removes the paid pairs from the records and passes on the pairs the records removed", async () => {
    const exceptionRepository = recordsRemoving({ outcome: "ok", value: [PAID_PAIR] });
    const removed = await paidDebtRemoved({
      runSettings: settingsConfiguring("this-run"),
      check: checkReporting({ outcome: "ok", value: LEGACY_PAID }),
      exceptionRepository,
      arguments: NO_ARGUMENTS,
    });
    expect(removed).toEqual({ outcome: "ok", value: [PAID_PAIR] });
    expect(exceptionRepository.remove).toHaveBeenCalledExactlyOnceWith({ pairs: [PAID_PAIR] });
  });
});

describe("paidDebtRemoved asking the check", () => {
  it("asks at the --base-revision it is given, with the --forfeiture it is given over the configured one", async () => {
    const check = checkReporting({ outcome: "ok", value: NOTHING_PAID });
    await paidDebtRemoved({
      runSettings: settingsConfiguring("this-run"),
      check,
      exceptionRepository: recordsRemoving({ outcome: "ok", value: [] }),
      arguments: { baseRevision: "origin/main", forfeiture: "elsewhere" },
    });
    expect(check).toHaveBeenCalledExactlyOnceWith({ baseRevision: "origin/main", assessment: { forfeiture: "elsewhere" } });
  });

  it("asks with the configured forfeiture when no --forfeiture is given", async () => {
    const check = checkReporting({ outcome: "ok", value: NOTHING_PAID });
    await paidDebtRemoved({
      runSettings: settingsConfiguring("elsewhere"),
      check,
      exceptionRepository: recordsRemoving({ outcome: "ok", value: [] }),
      arguments: NO_ARGUMENTS,
    });
    expect(check).toHaveBeenCalledExactlyOnceWith({ baseRevision: undefined, assessment: { forfeiture: "elsewhere" } });
  });
});

describe("paidDebtRemoved failing", () => {
  it("passes on the check's failure and removes nothing", async () => {
    const exceptionRepository = { remove: vi.fn<ExceptionRepository["remove"]>() };
    await expect(
      paidDebtRemoved({ runSettings: settingsConfiguring("this-run"), check: checkReporting(CHECK_FAILED), exceptionRepository, arguments: NO_ARGUMENTS }),
    ).resolves.toEqual(CHECK_FAILED);
    expect(exceptionRepository.remove).not.toHaveBeenCalled();
  });

  it("passes on settings it cannot read and runs no check", async () => {
    const check = vi.fn<PruneCheck>();
    await expect(
      paidDebtRemoved({
        runSettings: { read: vi.fn<RunSettingsReader["read"]>().mockReturnValue(SETTINGS_UNREADABLE) },
        check,
        exceptionRepository: { remove: vi.fn<ExceptionRepository["remove"]>() },
        arguments: NO_ARGUMENTS,
      }),
    ).resolves.toEqual(SETTINGS_UNREADABLE);
    expect(check).not.toHaveBeenCalled();
  });

  it("passes on the records' failure to remove", async () => {
    const unwritable: Result<never, LoadFailure> = {
      outcome: "failed",
      error: { kind: "file-unwritable", path: "/repo/discipline-exceptions/file-carve-outs/cd-14.json", detail: "EACCES" },
    };
    await expect(
      paidDebtRemoved({
        runSettings: settingsConfiguring("this-run"),
        check: checkReporting({ outcome: "ok", value: LEGACY_PAID }),
        exceptionRepository: recordsRemoving(unwritable),
        arguments: NO_ARGUMENTS,
      }),
    ).resolves.toEqual(unwritable);
  });
});
