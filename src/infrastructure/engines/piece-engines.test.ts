import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
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
    forms: [],
    clause: {
      ruleSet: { name: ruleSetNameOf("team") },
      discipline: disciplineIdOf("CD-17"),
      clause: clauseIdOf("timers"),
    },
  },
];

const CLOCK_WALKER =
  "/repo/team-rules/mechanisms/walker/date-used-directly/clock-sources/piece.json";
const TIMERS_WALKER = "/repo/team-rules/mechanisms/walker/date-used-directly/timers/piece.json";
const CLOCK_ESLINT =
  "/repo/team-rules/mechanisms/eslint/date-used-directly/clock-sources/piece.json";
const PIECE = '{ "version": 2, "anchor": { "kind": "file" }, "settings": {} }';

const readBindings = (request: {
  readonly files: ReadonlyMap<string, ReturnType<FileTextPort["read"]>>;
  readonly checkFiles?: (fileText: FileTextPort) => void;
}) => {
  const fileText: FileTextPort = {
    exists: vi.fn<FileTextPort["exists"]>(({ path }) =>
      request.files.has(path) ? "present" : "absent",
    ),
    read: vi.fn<FileTextPort["read"]>(
      ({ path }) =>
        request.files.get(path) ?? {
          outcome: "failed",
          error: { kind: "unreadable", path, detail: "ENOENT" },
        },
    ),
    write: vi.fn<FileTextPort["write"]>(),
  };
  const directory: DirectoryPort = {
    list: vi.fn<DirectoryPort["list"]>(),
    create: vi.fn<DirectoryPort["create"]>(),
  };
  const result = createEngineBindingsRepository({
    fileText,
    directory,
    path: PATH,
    ruleSetRoot: TEAM,
    installRoot: INSTALL,
  }).read({ checks: TEAM_CHECKS });
  request.checkFiles?.(fileText);
  expect(directory.list).not.toHaveBeenCalled();
  return result;
};

const found = (text: string): ReturnType<FileTextPort["read"]> => ({ outcome: "ok", value: text });

describe("createEngineBindingsRepository", () => {
  it("gives each named check the engines with pieces in registry order, passing over missing pieces", () => {
    expect(
      readBindings({
        files: new Map([
          [CLOCK_WALKER, found(PIECE)],
          [TIMERS_WALKER, found(PIECE)],
          [CLOCK_ESLINT, found(PIECE)],
        ]),
      }),
    ).toEqual({
      outcome: "ok",
      value: new Map([
        ["date-used-directly#clock-sources", [{ name: "walker" }, { name: "eslint" }]],
        ["date-used-directly#timers", [{ name: "walker" }]],
      ]),
    });
  });

  it("locates a team's pieces under the team's own rule-set root", () => {
    expect(
      readBindings({
        files: new Map([[CLOCK_ESLINT, found(PIECE)]]),
        checkFiles: ({ exists, read }) => {
          expect(exists).toHaveBeenCalledWith({ path: CLOCK_WALKER });
          expect(read).toHaveBeenCalledExactlyOnceWith({ path: CLOCK_ESLINT });
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: new Map([["date-used-directly#clock-sources", [{ name: "eslint" }]]]),
    });
  });

  it("gives no bindings and reads no pieces when no named declarations exist", () => {
    expect(
      readBindings({
        files: new Map(),
        checkFiles: ({ read }) => expect(read).not.toHaveBeenCalled(),
      }),
    ).toEqual({ outcome: "ok", value: new Map() });
  });

  it("fails file-malformed naming a piece whose file is not a named declaration", () => {
    expect(
      readBindings({ files: new Map([[CLOCK_WALKER, found('{ "version": 2 }')]]) }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: CLOCK_WALKER },
    });
  });

  it("fails file-unreadable with the named declaration path and the read failure", () => {
    expect(
      readBindings({
        files: new Map([
          [
            CLOCK_WALKER,
            {
              outcome: "failed",
              error: { kind: "unreadable", path: CLOCK_WALKER, detail: "EACCES" },
            },
          ],
        ]),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        path: CLOCK_WALKER,
        detail: "date-used-directly#clock-sources: EACCES",
      },
    });
  });
});
