import { describe, expect, it, vi } from "vitest";
import { LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../../tests/settings-catalogue.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { editionSchema } from "../../../infrastructure/content-files/edition.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { DEFAULT_CONVENTIONS } from "../../../infrastructure/hone-config-file/conventions.ts";
import { type PieceClause, type SettingsReading, type SettingsSources, readSettings, settingsNoteText } from "./read-settings.ts";

const INSTALL_ROOT = absolutePathSchema.parse("/install");

const SETTINGS_PATH = "/repo/hone.config.json";

const AUDIT = mechanismIdSchema.parse("audit");

const FIRST = editionSchema.parse("1");

const SECOND = editionSchema.parse("2");

const LOOPS_PIECE: PieceClause = {
  exceptions: "allowed",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-15",
  settings: { keywords: ["for", "while"] },
  declarations: {},
  editions: { declared: [FIRST, SECOND], default: FIRST, latest: SECOND },
};

const DOCUMENT = {
  version: 2,
  ruleSets: {},
  checks: { "loop-keyword#loops": "walker", "loop-keyword#test-body": "not-adopted", "rebinding#test-body": "not-adopted" },
  checkSettings: { "loop-keyword#loops": { edition: "2" } },
  forfeiture: "elsewhere",
};

const sourcesHolding = (request: { readonly document: unknown; readonly piece: ReturnType<SettingsSources["pieceClause"]> }): SettingsSources => ({
  settingsFile: vi.fn<SettingsSources["settingsFile"]>().mockReturnValue({ outcome: "ok", value: { path: SETTINGS_PATH, document: request.document } }),
  ruleSetRoot: vi.fn<SettingsSources["ruleSetRoot"]>().mockReturnValue({ outcome: "ok", value: INSTALL_ROOT }),
  catalogue: vi.fn<SettingsSources["catalogue"]>().mockReturnValue({ outcome: "ok", value: { held: "catalogue", catalogue: SETTINGS_CATALOGUE } }),
  pieceClause: vi.fn<SettingsSources["pieceClause"]>().mockReturnValue(request.piece),
});

describe("readSettings", () => {
  it("gives the reading version 1 gives for the same choices, with every record's why-chain required", () => {
    expect(readSettings({ sources: sourcesHolding({ document: DOCUMENT, piece: { outcome: "ok", value: LOOPS_PIECE } }) })).toEqual<{
      readonly outcome: "ok";
      readonly value: SettingsReading;
    }>({
      outcome: "ok",
      value: {
        selection: {
          selection: {
            selected: [{ address: LOOPS_CLAUSE, mechanism: AUDIT, exceptions: "allowed" }],
            uncovered: [],
            notAdopted: [TEST_BODY_CLAUSE],
            notRun: [],
            editions: [{ address: LOOPS_CLAUSE, mechanism: AUDIT, edition: SECOND, latest: SECOND }],
          },
          bindings: [
            {
              mechanism: AUDIT,
              clause: {
                address: LOOPS_CLAUSE,
                anchor: { kind: "file" },
                pieceRoot: "/install/mechanisms/audit/CD-15",
                settings: { keywords: ["for", "while"] },
                clauseSettings: {},
                edition: SECOND,
              },
            },
          ],
          clauseRoots: [{ clause: LOOPS_CLAUSE, ruleSetRoot: INSTALL_ROOT }],
          excluded: [],
          eslintConfigRoots: [],
          fileExceptionWhyChains: "required",
        },
        runSettings: { reportOutput: "full", assessment: { forfeiture: "elsewhere" } },
        eslintConfigLookup: { lookup: "detected" },
        conventions: DEFAULT_CONVENTIONS,
        notes: [],
      },
    });
  });

  it("asks for the piece of each run clause from the root of its rule set", () => {
    const sources = sourcesHolding({ document: DOCUMENT, piece: { outcome: "ok", value: LOOPS_PIECE } });
    readSettings({ sources });
    expect(sources.pieceClause).toHaveBeenCalledWith({ ruleSetRoot: INSTALL_ROOT, clause: LOOPS_CLAUSE, mechanism: AUDIT });
  });

  it("notes each declared convention no check reads yet", () => {
    expect(
      readSettings({
        sources: sourcesHolding({
          document: { ...DOCUMENT, generated: [{ files: ["src/generated/**"], outsideParty: "@graphql-codegen/cli" }], layers: { domain: ["src/domain"] } },
          piece: { outcome: "ok", value: LOOPS_PIECE },
        }),
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        notes: [
          { kind: "declared-not-read", key: "generated" },
          { kind: "declared-not-read", key: "layers" },
        ],
      },
    });
  });

  it("refuses a file its wire refuses, naming the file", () => {
    expect(
      readSettings({ sources: sourcesHolding({ document: { ...DOCUMENT, fileExceptionWhyChains: "optional" }, piece: { outcome: "ok", value: LOOPS_PIECE } }) }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SETTINGS_PATH,
        detail: "✖ removed: \"fileExceptionWhyChains\"; every record shows its why-chain in version 2\n  → at fileExceptionWhyChains",
      },
    });
  });

  it("refuses a check the catalogue does not hold, in the new words", () => {
    expect(
      readSettings({
        sources: sourcesHolding({ document: { ...DOCUMENT, checks: { "loop-keyword#nowhere": "walker" }, checkSettings: {} }, piece: { outcome: "ok", value: LOOPS_PIECE } }),
      }),
    ).toEqual({ outcome: "failed", error: { kind: "unknown-check", address: "loop-keyword#nowhere" } });
  });

  it("refuses an edition the piece does not declare, naming the check it was given on", () => {
    expect(
      readSettings({
        sources: sourcesHolding({ document: { ...DOCUMENT, checkSettings: { "loop-keyword#loops": { edition: "3" } } }, piece: { outcome: "ok", value: LOOPS_PIECE } }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: SETTINGS_PATH, detail: "checkSettings for loop-keyword#loops: edition must be one of \"1\", \"2\"" },
    });
  });

  it("passes on the failure of a piece it cannot read", () => {
    expect(
      readSettings({
        sources: sourcesHolding({ document: DOCUMENT, piece: { outcome: "failed", error: { kind: "piece-missing", address: "CD-15#loops", mechanism: AUDIT } } }),
      }),
    ).toEqual({ outcome: "failed", error: { kind: "piece-missing", address: "CD-15#loops", mechanism: AUDIT } });
  });
});

describe("settingsNoteText", () => {
  it.each<{ readonly key: "generated" | "layers"; readonly text: string }>([
    { key: "generated", text: "generated is declared; no check reads it yet" },
    { key: "layers", text: "layers is declared; no check reads it yet" },
  ])("writes $text", ({ key, text }) => {
    expect(settingsNoteText({ note: { kind: "declared-not-read", key } })).toBe(text);
  });
});
