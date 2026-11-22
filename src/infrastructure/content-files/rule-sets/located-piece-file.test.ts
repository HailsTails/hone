import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { readLocatedPieceFile } from "./located-piece-file.ts";

describe("readLocatedPieceFile", () => {
  it("attaches the named implementation root to a legacy installed clause", () => {
    const installRoot = absoluteRootOf("/install");
    const path = createPathPort({ flavour: "posix", workingDirectory: () => installRoot });
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value:
            '{"version":1,"clauses":[{"clause":"CD-17#clock-sources","sight":{"kind":"one-symptom","symptom":"date-used-directly"},"checks":["date-used-directly#clock-sources"],"anchor":{"kind":"file"}}],"recordKinds":{}}',
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value:
            '{"version":2,"anchor":{"kind":"file"},"settings":{"module":"clock-sources.ts"},"editions":["1","2"]}',
        }),
      write: vi.fn<FileTextPort["write"]>(),
    };

    expect(
      readLocatedPieceFile({
        installRoot,
        ruleSetRoot: installRoot,
        path,
        fileText,
        mechanism: "walker",
        discipline: {
          version: 1,
          id: disciplineIdOf("CD-17"),
          clauses: [
            {
              kind: "mechanical",
              id: clauseIdOf("clock-sources"),
              mechanisms: ["walker"],
              anchor: { kind: "file" },
              exceptions: "allowed",
              cases: { flag: [], allow: [] },
            },
          ],
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        version: 1,
        discipline: "CD-17",
        mechanism: "walker",
        clauses: [
          {
            clause: "clock-sources",
            pieceRoot:
              "/install/src/infrastructure/engines/walker/date-used-directly/clock-sources",
            settings: { module: "clock-sources.ts" },
            editions: { declared: ["1", "2"], default: "1", latest: "2" },
            clauseSettings: {},
          },
        ],
      },
    });
  });
});
