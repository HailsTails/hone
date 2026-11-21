import { describe, expect, it } from "vitest";
import { mechanismIdSchema } from "../src/infrastructure/hone-config-file/identifiers.ts";
import { conformanceRows, foldersUnder } from "./conformance-rows.ts";

const TABLE = {
  "./rules/XX-1/discipline.json": JSON.stringify({
    version: 1,
    id: "XX-1",
    clauses: [
      {
        kind: "mechanical",
        id: "first-check",
        summary: "first",
        mechanisms: ["audit"],
        anchor: { kind: "file" },
        cases: {
          flag: [{ name: "flagged", fileName: "a.ts", source: "x\n", expectedLines: [1] }],
          allow: [{ name: "allowed", fileName: "b.ts", source: "y\n", expectedLines: [] }],
        },
      },
      { kind: "judgement", id: "second-check", summary: "second", enforcedBy: "review" },
    ],
  }),
  "./src/infrastructure/engines/audit/XX-1/piece.json": JSON.stringify({
    version: 1,
    discipline: "XX-1",
    mechanism: "audit",
    clauses: [{ clause: "first-check", settings: { module: "first.ts" } }],
  }),
  "./src/infrastructure/engines/audit/XX-2/piece.json": "{}",
};

const EDITIONED_TABLE = {
  "./rules/XX-1/discipline.json": JSON.stringify({
    version: 1,
    id: "XX-1",
    clauses: [
      {
        kind: "mechanical",
        id: "first-check",
        summary: "first",
        mechanisms: ["audit"],
        anchor: { kind: "file" },
        cases: {
          flag: [{ name: "flagged", fileName: "a.ts", source: "x\n", expectedLines: [1], edition: "2" }],
          allow: [{ name: "allowed", fileName: "b.ts", source: "y\n", expectedLines: [] }],
        },
      },
    ],
  }),
  "./src/infrastructure/engines/audit/XX-1/piece.json": JSON.stringify({
    version: 1,
    discipline: "XX-1",
    mechanism: "audit",
    clauses: [{ clause: "first-check", settings: { module: "first.ts" }, editions: ["1", "2"] }],
  }),
};

describe("foldersUnder", () => {
  it("lists each folder holding a key under the prefix once, in order", () => {
    expect(foldersUnder({ table: TABLE, prefix: "./src/infrastructure/engines/audit/" })).toEqual(["XX-1", "XX-2"]);
  });
});

describe("conformanceRows", () => {
  it("builds one row per piece clause with its address, anchor, piece root, settings and flag then allow cases", () => {
    expect(
      conformanceRows({
        table: TABLE,
        disciplines: ["XX-1"],
        mechanism: mechanismIdSchema.parse("audit"),
        mechanismRoot: "/install/src/infrastructure/engines/audit",
      }),
    ).toEqual([
      {
        name: "XX-1#first-check",
        clause: {
          address: { ruleSet: "hone", discipline: "XX-1", clause: "first-check" },
          anchor: { kind: "file" },
          pieceRoot: "/install/src/infrastructure/engines/audit/XX-1",
          settings: { module: "first.ts" },
          clauseSettings: {},
          edition: "1",
        },
        cases: [
          { name: "flagged", fileName: "a.ts", source: "x\n", expectedLines: [1] },
          { name: "allowed", fileName: "b.ts", source: "y\n", expectedLines: [] },
        ],
      },
    ]);
  });

  it("builds one row per edition its cases run under, naming each later edition", () => {
    expect(
      conformanceRows({ table: EDITIONED_TABLE, disciplines: ["XX-1"], mechanism: mechanismIdSchema.parse("audit"), mechanismRoot: "/install/src/infrastructure/engines/audit" }),
    ).toMatchObject([
      { name: "XX-1#first-check", clause: { edition: "1" }, cases: [{ name: "allowed" }] },
      { name: "XX-1#first-check edition 2", clause: { edition: "2" }, cases: [{ name: "flagged", edition: "2" }] },
    ]);
  });
});
