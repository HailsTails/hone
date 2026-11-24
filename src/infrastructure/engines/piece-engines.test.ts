import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { CheckContent, Symptom } from "../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import { createPathPort } from "../node/path-port.ts";
import { createEngineBindingsRepository } from "./piece-engines.ts";

const INSTALL = absoluteRootOf("/install");

const TEAM = absoluteRootOf("/repo/team-rules");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => INSTALL });

const DATE_USED_DIRECTLY: Symptom = {
  ruleSet: "hone",
  name: "date-used-directly",
  title: "Date used directly",
  seen: "A date read.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const TEAM_CHECKS: readonly CheckContent[] = [
  {
    name: "clock-sources",
    symptom: DATE_USED_DIRECTLY,
    page: "date-used-directly/clock-sources.md",
    forms: [],
    clause: {
      ruleSet: { name: ruleSetNameOf("team") },
      discipline: disciplineIdOf("CD-17"),
      clause: clauseIdOf("clock-sources"),
    },
  },
  {
    name: "timers",
    symptom: DATE_USED_DIRECTLY,
    page: "date-used-directly/timers.md",
    forms: [],
    clause: {
      ruleSet: { name: ruleSetNameOf("team") },
      discipline: disciplineIdOf("CD-17"),
      clause: clauseIdOf("timers"),
    },
  },
];

const CLOCK_WALKER = "/repo/team-rules/engines/walker/date-used-directly/clock-sources/piece.json";
const TIMERS_WALKER = "/repo/team-rules/engines/walker/date-used-directly/timers/piece.json";
const CLOCK_ESLINT = "/repo/team-rules/engines/eslint/date-used-directly/clock-sources/piece.json";
const PIECE = '{ "version": 2, "anchor": { "kind": "file" }, "settings": {} }';

const PIECE_READ: ReturnType<FileTextPort["read"]> = { outcome: "ok", value: PIECE };

describe("createEngineBindingsRepository", () => {
  it("gives each named check the engines with pieces in registry order, passing over missing pieces", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("present")
        .mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue(PIECE_READ),
      write: vi.fn<FileTextPort["write"]>(),
    };

    const repository = createEngineBindingsRepository({
      fileText,
      path: PATH,
      ruleSetRoot: TEAM,
      installRoot: INSTALL,
    });

    const bindings = repository.read({ checks: TEAM_CHECKS });

    expect(bindings).toEqual({
      outcome: "ok",
      value: new Map([
        ["date-used-directly#clock-sources", [{ name: "walker" }, { name: "eslint" }]],
        ["date-used-directly#timers", [{ name: "walker" }]],
      ]),
    });
    expect(fileText.read).toHaveBeenNthCalledWith(1, { path: CLOCK_WALKER });
    expect(fileText.read).toHaveBeenNthCalledWith(2, { path: TIMERS_WALKER });
    expect(fileText.read).toHaveBeenNthCalledWith(3, { path: CLOCK_ESLINT });
  });

  it("locates a team's pieces under the team's own rule-set root", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("absent")
        .mockReturnValueOnce("absent")
        .mockReturnValueOnce("present")
        .mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue(PIECE_READ),
      write: vi.fn<FileTextPort["write"]>(),
    };

    const repository = createEngineBindingsRepository({
      fileText,
      path: PATH,
      ruleSetRoot: TEAM,
      installRoot: INSTALL,
    });

    const bindings = repository.read({ checks: TEAM_CHECKS });

    expect(bindings).toEqual({
      outcome: "ok",
      value: new Map([["date-used-directly#clock-sources", [{ name: "eslint" }]]]),
    });
    expect(fileText.exists).toHaveBeenNthCalledWith(1, { path: CLOCK_WALKER });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: CLOCK_ESLINT });
  });

  it("gives no bindings and reads no pieces when no named declarations exist", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };

    const repository = createEngineBindingsRepository({
      fileText,
      path: PATH,
      ruleSetRoot: TEAM,
      installRoot: INSTALL,
    });

    const bindings = repository.read({ checks: TEAM_CHECKS });

    expect(bindings).toEqual({ outcome: "ok", value: new Map() });
    expect(fileText.read).not.toHaveBeenCalled();
  });

  it("fails file-malformed naming a piece whose file is not a named declaration", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValue("absent"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValue({ outcome: "ok", value: '{ "version": 2 }' }),
      write: vi.fn<FileTextPort["write"]>(),
    };

    const repository = createEngineBindingsRepository({
      fileText,
      path: PATH,
      ruleSetRoot: TEAM,
      installRoot: INSTALL,
    });

    const bindings = repository.read({ checks: TEAM_CHECKS });

    expect(bindings).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: CLOCK_WALKER },
    });
  });

  it("fails file-unreadable with the named declaration path and the read failure", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "unreadable", path: CLOCK_WALKER, detail: "EACCES" },
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };

    const repository = createEngineBindingsRepository({
      fileText,
      path: PATH,
      ruleSetRoot: TEAM,
      installRoot: INSTALL,
    });

    const bindings = repository.read({ checks: TEAM_CHECKS });

    expect(bindings).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        path: CLOCK_WALKER,
        detail: "date-used-directly#clock-sources: EACCES",
      },
    });
  });
});
