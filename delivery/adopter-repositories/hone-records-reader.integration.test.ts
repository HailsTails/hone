import { afterAll, assert, describe, expect, it } from "vitest";

import { readHoneRecords } from "../../src/application/records/read-hone-records.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { readBoundCatalogue } from "../../src/infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import {
  createDefaultGitPort,
  createDefaultGitTreePort,
} from "../../src/infrastructure/git/git-port.ts";
import { createRecordsFolder } from "../../src/infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { recordsReader } from "../../src/infrastructure/hone-records-folder/reading/records-reading.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const directory = createDefaultDirectoryPort({});

const scratch = createDefaultScratchFilesPort({});

const commands = createDefaultCommandRunPort({});

const INSTALL_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", ".."] }),
);

const AUTHORISED_IMPORTS = repoPathOf(
  "hone-records/authorised-locations/outside-import-past-a-boundary.json",
);

const GIT_INIT = ["init", "-q"];

const GIT_ADD = ["add", "-A"];

const GIT_COMMIT = [
  "-c",
  "user.name=hone-records",
  "-c",
  "user.email=hone-records@invalid",
  "-c",
  "commit.gpgsign=false",
  "commit",
  "-q",
  "-m",
  "base",
];

const DONE = { outcome: "ok", value: null };

const WRITTEN = { outcome: "ok", value: undefined };

const SUCCEEDED = expect.objectContaining({ outcome: "exited", exitCode: 0 });

const BASE_AUTHORISED_IMPORTS_TEXT = `{
  "version": 2,
  "records": [
    {
      "answers": "outside-import-past-a-boundary",
      "file": "src/adapters/ids.ts",
      "carried": {
        "kind": "authorised-location",
        "clause": "CD-19#import-boundaries",
        "file": "src/adapters/ids.ts",
        "reason": "uuid stays at the ids adapter.",
        "provenance": {
          "kind": "existing-authorisation",
          "source": "docs/decisions/0003-ids.md"
        }
      }
    },
    {
      "answers": "outside-import-past-a-boundary",
      "file": "src/adapters/clock-source.ts",
      "carried": {
        "kind": "authorised-location",
        "clause": "CD-19#import-boundaries",
        "file": "src/adapters/clock-source.ts",
        "reason": "date-fns stays at the clock source.",
        "provenance": {
          "kind": "existing-authorisation",
          "source": "docs/decisions/0004-dates.md"
        }
      }
    }
  ]
}
`;

const WORKING_AUTHORISED_IMPORTS_TEXT = `{
  "version": 2,
  "records": [
    {
      "answers": "outside-import-past-a-boundary",
      "file": "src/adapters/ids.ts",
      "carried": {
        "kind": "authorised-location",
        "clause": "CD-19#import-boundaries",
        "file": "src/adapters/ids.ts",
        "reason": "uuid stays at the ids adapter.",
        "provenance": {
          "kind": "existing-authorisation",
          "source": "docs/decisions/0003-ids.md"
        }
      }
    },
    {
      "answers": "outside-import-past-a-boundary",
      "file": "src/adapters/clock-source.ts",
      "carried": {
        "kind": "authorised-location",
        "clause": "CD-19#import-boundaries",
        "file": "src/adapters/clock-source.ts",
        "reason": "Reworded since the base.",
        "provenance": {
          "kind": "existing-authorisation",
          "source": "docs/decisions/0004-dates.md"
        }
      }
    }
  ]
}
`;

const BASE_JUDGED_READING = {
  outcome: "ok",
  value: {
    records: [
      {
        place: { file: AUTHORISED_IMPORTS, index: 0 },
        record: {
          kind: "authorised-location",
          file: "src/adapters/ids.ts",
          holding: { held: "carried", standing: "established" },
        },
      },
    ],
    refused: [
      {
        place: { file: AUTHORISED_IMPORTS, index: 1 },
        refusals: [{ kind: "carried-changed-since-base" }],
      },
    ],
    base: { measured: "yes" },
  },
};

const BASE_JUDGED = absolutePathSchema.parse(
  path.join({ segments: [INSTALL_ROOT, "artefacts", "hone-records-reader-base-judged"] }),
);

afterAll(() => {
  scratch.removeTree({ path: BASE_JUDGED });
});

describe("Hone's records over a real hone-records folder with a real git base", () => {
  it("holds the carried record the base revision holds and refuses the one reworded since", () => {
    const repo = BASE_JUDGED;
    const recordsFile = `${repo}/${AUTHORISED_IMPORTS}`;
    expect([
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/hone-records/authorised-locations` }),
      commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      fileText.write({ path: recordsFile, text: BASE_AUTHORISED_IMPORTS_TEXT }),
      commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
      fileText.write({ path: recordsFile, text: WORKING_AUTHORISED_IMPORTS_TEXT }),
    ]).toEqual([DONE, DONE, SUCCEEDED, WRITTEN, SUCCEEDED, SUCCEEDED, WRITTEN]);
    const holding = readBoundCatalogue({
      ruleSet: "hone",
      inheritedRecordKinds: [],
      directory,
      fileText,
      path,
      ruleSetRoot: INSTALL_ROOT,
      installRoot: INSTALL_ROOT,
    });
    assert(holding.outcome === "ok", "the shipped symptom catalogue reads");
    assert(holding.value.held === "catalogue", "the shipped symptom catalogue is present");
    const source = createRecordsFolder({
      fileText,
      directory,
      git: createDefaultGitPort(),
      gitTree: createDefaultGitTreePort(),
      repoRoot: repo,
    });
    expect(
      readHoneRecords({
        recordsReader,
        source,
        catalogue: holding.value.catalogue,
        baseRevision: "HEAD",
      }),
    ).toMatchObject(BASE_JUDGED_READING);
  });
});
