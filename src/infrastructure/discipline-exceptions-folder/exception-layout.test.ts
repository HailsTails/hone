import { describe, expect, it } from "vitest";
import { type ExceptionLayoutPorts, createExceptionRepository, placementOf } from "./exception-layout.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import { clauseAddressSchema } from "./clause-address.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import type { DirectoryEntry } from "../../application/ports/file-system/directory-port.ts";
import { createPathPort } from "../node/path-port.ts";
import { absolutePathSchema } from "../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";

type RecordsDisk = {
  readonly repoRoot: AbsolutePath;
  readonly ports: ExceptionLayoutPorts;
  readonly texts: () => Readonly<Record<string, string>>;
};

const ROOT = "/repo";

const REPO_ROOT = absolutePathSchema.parse(ROOT);

const absoluteKey = (request: { readonly file: string }): string => `${ROOT}/${request.file}`;

const childEntryOf = (request: { readonly path: string; readonly folder: string }): DirectoryEntry => {
  const [name, ...rest] = request.path.slice(request.folder.length + 1).split("/");
  return { name, kind: rest.length === 0 ? "file" : "directory" };
};

const childrenOf = (request: { readonly paths: readonly string[]; readonly folder: string }): readonly DirectoryEntry[] => {
  const children = request.paths
    .filter((path) => path.startsWith(`${request.folder}/`))
    .map((path) => childEntryOf({ path, folder: request.folder }));
  return [...new Map(children.map((child) => [child.name, child])).values()];
};

const recordsDisk = (request: {
  readonly working: Readonly<Record<string, string>>;
  readonly base: Readonly<Record<string, string>>;
}): RecordsDisk => {
  const files = new Map(Object.entries(request.working).map(([file, text]) => [absoluteKey({ file }), text]));
  const folders = new Set<string>();
  const occupied = (): readonly string[] => [...files.keys(), ...[...folders].map((folder) => `${folder}/`)];
  return {
    repoRoot: REPO_ROOT,
    texts: () => Object.fromEntries([...files.entries()].map(([path, text]) => [path.slice(ROOT.length + 1), text])),
    ports: {
      path: createPathPort({ flavour: "posix", workingDirectory: () => ROOT }),
      fileText: {
        read: ({ path }) => {
          const text = files.get(path);
          return text === undefined ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } } : { outcome: "ok", value: text };
        },
        exists: ({ path }) => (files.has(path) || occupied().some((candidate) => candidate.startsWith(`${path}/`)) ? "present" : "absent"),
        write: ({ path, text }) => {
          files.set(path, text);
          return { outcome: "ok", value: undefined };
        },
      },
      directory: {
        list: ({ path }) => ({ outcome: "ok", value: childrenOf({ paths: [...files.keys()], folder: path }).toSorted((left, right) => (left.name < right.name ? -1 : 1)) }),
        create: ({ path }) => {
          folders.add(path);
          return { outcome: "ok", value: undefined };
        },
      },
      fileRemoval: {
        remove: ({ path }) => {
          files.delete(path);
          return { outcome: "ok", value: undefined };
        },
      },
      git: {
        trackedPaths: () => ({ outcome: "ok", value: [] }),
        changedSince: () => ({ outcome: "ok", value: [] }),
        contentInBase: ({ file }) => ({ outcome: "ok", value: file in request.base ? "present-in-base" : "absent-from-base" }),
        textInBase: ({ file }) => {
          const text = request.base[file];
          return { outcome: "ok", value: text === undefined ? { presence: "absent-from-base" } : { presence: "present-in-base", text } };
        },
        renamedSince: () => ({ outcome: "ok", value: new Map() }),
      },
      gitTree: {
        pathsAt: () => ({ outcome: "ok", value: Object.keys(request.base).map((file) => repoPathSchema.parse(file)) }),
      },
    },
  };
};

const SINGLE_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/a.ts",
      "reason": "held by the adapter"
    },
    {
      "kind": "file-carve-out",
      "clause": "CD-6#identifier-names",
      "file": "src/d.ts",
      "reason": "names from the wire format, “quoted” and \\\\ escaped"
    },
    {
      "kind": "authorised-location",
      "clause": "CD-19#import-boundaries",
      "file": "src/c.ts",
      "reason": "the one wrapping site"
    },
    {
      "kind": "file-carve-out",
      "clause": "hone/CD-19#import-boundaries",
      "file": "src/b.ts",
      "reason": "awaiting the port"
    },
    {
      "kind": "clause-wide-carve-out",
      "clause": "team/TM-1#no-tmp-files",
      "reason": "the whole clause is held",
      "whyChain": {
        "whys": [
          "one"
        ]
      }
    }
  ]
}
`;

const LOCATIONS_19_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "authorised-location",
      "clause": "CD-19#import-boundaries",
      "file": "src/c.ts",
      "reason": "the one wrapping site"
    }
  ]
}
`;

const TEAM_WIDE_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "clause-wide-carve-out",
      "clause": "team/TM-1#no-tmp-files",
      "reason": "the whole clause is held",
      "whyChain": {
        "whys": [
          "one"
        ]
      }
    }
  ]
}
`;

const CARVE_OUTS_19_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/a.ts",
      "reason": "held by the adapter"
    },
    {
      "kind": "file-carve-out",
      "clause": "hone/CD-19#import-boundaries",
      "file": "src/b.ts",
      "reason": "awaiting the port"
    }
  ]
}
`;

const CARVE_OUTS_6_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-6#identifier-names",
      "file": "src/d.ts",
      "reason": "names from the wire format, “quoted” and \\\\ escaped"
    }
  ]
}
`;

const WIRE_AND_INHERITED_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-6#identifier-names",
      "file": "src/d.ts",
      "reason": "names from the wire format, “quoted” and \\\\ escaped"
    },
    {
      "kind": "file-carve-out",
      "clause": "CD-27#test-body-logic",
      "file": "src/a.test.ts",
      "reason": "inherited"
    }
  ]
}
`;

const INHERITED_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-27#test-body-logic",
      "file": "src/a.test.ts",
      "reason": "inherited"
    }
  ]
}
`;

const CARVE_OUTS_19_AND_SECOND_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/a.ts",
      "reason": "held by the adapter"
    },
    {
      "kind": "file-carve-out",
      "clause": "hone/CD-19#import-boundaries",
      "file": "src/b.ts",
      "reason": "awaiting the port"
    },
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/e.ts",
      "reason": "inherited"
    }
  ]
}
`;

const UNPLACEABLE_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/a.ts",
      "reason": "held by the adapter"
    },
    {
      "kind": "file-carve-out",
      "clause": "CD-19 import-boundaries",
      "file": "src/x.ts",
      "reason": "held by the adapter"
    }
  ]
}
`;

const ANNOTATED_TEXT = `{
  "$schema": "./discipline-exceptions.schema.json",
  "version": 1,
  "notes": "kept by the platform team",
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/a.ts",
      "reason": "held by the adapter"
    }
  ]
}
`;

const EMPTY_TEXT = `{ "version": 1, "exceptions": [] }
`;

const ADAPTER = {"kind": "file-carve-out", "clause": "CD-19#import-boundaries", "file": "src/a.ts", "reason": "held by the adapter"} as const;

const WIRE = {"kind": "file-carve-out", "clause": "CD-6#identifier-names", "file": "src/d.ts", "reason": "names from the wire format, “quoted” and \\ escaped"} as const;

const WRAPPING = {"kind": "authorised-location", "clause": "CD-19#import-boundaries", "file": "src/c.ts", "reason": "the one wrapping site"} as const;

const PORT = {"kind": "file-carve-out", "clause": "hone/CD-19#import-boundaries", "file": "src/b.ts", "reason": "awaiting the port"} as const;

const TEAM_WIDE = {"kind": "clause-wide-carve-out", "clause": "team/TM-1#no-tmp-files", "reason": "the whole clause is held", "whyChain": {"whys": ["one"]}} as const;

const SPLIT_FILES = {
  "discipline-exceptions/authorised-locations/cd-19.json": LOCATIONS_19_TEXT,
  "discipline-exceptions/clause-wide-carve-outs/team/tm-1.json": TEAM_WIDE_TEXT,
  "discipline-exceptions/file-carve-outs/cd-19.json": CARVE_OUTS_19_TEXT,
  "discipline-exceptions/file-carve-outs/cd-6.json": CARVE_OUTS_6_TEXT,
};

const SINGLE_FILES = { "discipline-exceptions.json": SINGLE_TEXT };

const repositoryOver = (request: {
  readonly working: Readonly<Record<string, string>>;
  readonly base: Readonly<Record<string, string>>;
}): { readonly repository: ExceptionRepository; readonly disk: RecordsDisk } => {
  const disk = recordsDisk(request);
  return { repository: createExceptionRepository({ ...disk.ports, repoRoot: disk.repoRoot }), disk };
};

const INHERITED = {
  kind: "file-carve-out",
  clause: "CD-27#test-body-logic",
  file: "src/a.test.ts",
  reason: "inherited",
} as const;

const SECOND_ADAPTER = {
  kind: "file-carve-out",
  clause: "CD-19#import-boundaries",
  file: "src/e.ts",
  reason: "inherited",
} as const;

describe("createExceptionRepository read in the single file", () => {
  it("reads each record of discipline-exceptions.json with its index there", () => {
    expect(repositoryOver({ working: SINGLE_FILES, base: {} }).repository.read()).toEqual({
      outcome: "ok",
      value: [
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, entry: ADAPTER },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 1 }, entry: WIRE },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 2 }, entry: WRAPPING },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 3 }, entry: PORT },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 4 }, entry: TEAM_WIDE },
      ],
    });
  });

  it("reads no records when neither layout is present", () => {
    expect(repositoryOver({ working: {}, base: {} }).repository.read()).toEqual({ outcome: "ok", value: [] });
  });

  it("is file-malformed when an entry does not match the records format", () => {
    expect(
      repositoryOver({ working: { "discipline-exceptions.json": '{ "version": 1, "exceptions": [{ "kind": "blanket-waiver" }] }' }, base: {} }).repository.read(),
    ).toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: "/repo/discipline-exceptions.json" } });
  });

  it("is unsupported-version with the found value for a version other than 1", () => {
    expect(repositoryOver({ working: { "discipline-exceptions.json": '{ "version": 0, "exceptions": [] }' }, base: {} }).repository.read()).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: "/repo/discipline-exceptions.json", found: 0 },
    });
  });
});

describe("createExceptionRepository read in the split layout", () => {
  it("reads each rule file in path order, each record with its file and its index in that file", () => {
    expect(repositoryOver({ working: SPLIT_FILES, base: {} }).repository.read()).toEqual({
      outcome: "ok",
      value: [
        { place: { layout: "split", file: "discipline-exceptions/authorised-locations/cd-19.json", index: 0 }, entry: WRAPPING },
        { place: { layout: "split", file: "discipline-exceptions/clause-wide-carve-outs/team/tm-1.json", index: 0 }, entry: TEAM_WIDE },
        { place: { layout: "split", file: "discipline-exceptions/file-carve-outs/cd-19.json", index: 0 }, entry: ADAPTER },
        { place: { layout: "split", file: "discipline-exceptions/file-carve-outs/cd-19.json", index: 1 }, entry: PORT },
        { place: { layout: "split", file: "discipline-exceptions/file-carve-outs/cd-6.json", index: 0 }, entry: WIRE },
      ],
    });
  });

  it("refuses a record kept in another rule's or kind's file, naming where it belongs", () => {
    expect(
      repositoryOver({ working: { "discipline-exceptions/file-carve-outs/cd-6.json": CARVE_OUTS_19_TEXT }, base: {} }).repository.read(),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: "/repo/discipline-exceptions/file-carve-outs/cd-6.json",
        detail: "exceptions[0] is a file-carve-out on CD-19#import-boundaries, which belongs in discipline-exceptions/file-carve-outs/cd-19.json",
      },
    });
  });

  it("refuses a file the layout has no place for", () => {
    expect(repositoryOver({ working: { ...SPLIT_FILES, "discipline-exceptions/notes.md": "notes" }, base: {} }).repository.read()).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: "/repo/discipline-exceptions/notes.md",
        detail:
          "is not a records file: discipline-exceptions holds only the folders authorised-locations, file-carve-outs, clause-wide-carve-outs, each holding one <discipline>.json for each discipline, inside a folder named for its rule set when that rule set is not hone",
      },
    });
  });

  it("refuses a repository holding both layouts rather than merging them", () => {
    expect(repositoryOver({ working: { ...SINGLE_FILES, ...SPLIT_FILES }, base: {} }).repository.read()).toEqual({
      outcome: "failed",
      error: { kind: "records-in-both-layouts", path: "/repo/discipline-exceptions.json", folder: "/repo/discipline-exceptions" },
    });
  });
});

describe("createExceptionRepository readAt reads the base revision in whichever layout it holds", () => {
  it.each([
    { layout: "single file", base: SINGLE_FILES, entries: [ADAPTER, WIRE, WRAPPING, PORT, TEAM_WIDE] },
    { layout: "split layout", base: SPLIT_FILES, entries: [WRAPPING, TEAM_WIDE, ADAPTER, PORT, WIRE] },
  ])("reads the records of a base in the $layout, whatever the working tree holds", ({ base, entries }) => {
    expect({
      underSingle: repositoryOver({ working: SINGLE_FILES, base }).repository.readAt({ revision: "main" }),
      underSplit: repositoryOver({ working: SPLIT_FILES, base }).repository.readAt({ revision: "main" }),
    }).toEqual({ underSingle: { outcome: "ok", value: entries }, underSplit: { outcome: "ok", value: entries } });
  });

  it("reads no records from a base that holds neither layout", () => {
    expect(repositoryOver({ working: SINGLE_FILES, base: { "src/a.ts": "a" } }).repository.readAt({ revision: "main" })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});

describe("createExceptionRepository add", () => {
  it("appends to discipline-exceptions.json in the single-file layout", () => {
    const { repository, disk } = repositoryOver({ working: { "discipline-exceptions.json": CARVE_OUTS_6_TEXT }, base: {} });

    expect(repository.add({ entries: [INHERITED] })).toEqual({ outcome: "ok", value: undefined });
    expect(disk.texts()).toEqual({ "discipline-exceptions.json": WIRE_AND_INHERITED_TEXT });
  });

  it("writes a new discipline-exceptions.json when neither layout is present", () => {
    const { repository, disk } = repositoryOver({ working: {}, base: {} });

    repository.add({ entries: [INHERITED] });

    expect(disk.texts()).toEqual({ "discipline-exceptions.json": INHERITED_TEXT });
  });

  it("appends each record to its rule's file in the split layout, writing a new rule file where none is", () => {
    const { repository, disk } = repositoryOver({ working: SPLIT_FILES, base: {} });

    expect(repository.add({ entries: [INHERITED, SECOND_ADAPTER] })).toEqual({ outcome: "ok", value: undefined });
    expect(disk.texts()).toEqual({
      ...SPLIT_FILES,
      "discipline-exceptions/file-carve-outs/cd-19.json": CARVE_OUTS_19_AND_SECOND_TEXT,
      "discipline-exceptions/file-carve-outs/cd-27.json": INHERITED_TEXT,
    });
  });
});

const PORT_ONLY_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "hone/CD-19#import-boundaries",
      "file": "src/b.ts",
      "reason": "awaiting the port"
    }
  ]
}
`;

const CARVE_OUTS_19_ONLY_ADAPTER_TEXT = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-19#import-boundaries",
      "file": "src/a.ts",
      "reason": "held by the adapter"
    }
  ]
}
`;

const EMPTIED_TEXT = `{
  "version": 1,
  "exceptions": []
}
`;

const pairOf = (request: { readonly clause: string; readonly file: string }) => ({
  clause: clauseAddressSchema.parse(request.clause),
  file: repoPathSchema.parse(request.file),
});

const ADAPTER_PAIR = pairOf({ clause: "CD-19#import-boundaries", file: "src/a.ts" });

const WIRE_PAIR = pairOf({ clause: "CD-6#identifier-names", file: "src/d.ts" });

const PORT_PAIR = pairOf({ clause: "CD-19#import-boundaries", file: "src/b.ts" });

describe("createExceptionRepository remove", () => {
  it("removes each pair's file carve-out from its rule's file in the split layout, keeping every other record's text, and deletes a rule's file once its last record is gone", () => {
    const { repository, disk } = repositoryOver({ working: SPLIT_FILES, base: {} });

    expect(repository.remove({ pairs: [ADAPTER_PAIR, WIRE_PAIR] })).toEqual({ outcome: "ok", value: [ADAPTER_PAIR, WIRE_PAIR] });
    expect(disk.texts()).toEqual({
      "discipline-exceptions/authorised-locations/cd-19.json": LOCATIONS_19_TEXT,
      "discipline-exceptions/clause-wide-carve-outs/team/tm-1.json": TEAM_WIDE_TEXT,
      "discipline-exceptions/file-carve-outs/cd-19.json": PORT_ONLY_TEXT,
    });
  });

  it("removes a pair's file carve-out from discipline-exceptions.json, its clause written with the hone rule set named", () => {
    const { repository, disk } = repositoryOver({ working: { "discipline-exceptions.json": CARVE_OUTS_19_TEXT }, base: {} });

    expect(repository.remove({ pairs: [PORT_PAIR] })).toEqual({ outcome: "ok", value: [PORT_PAIR] });
    expect(disk.texts()).toEqual({ "discipline-exceptions.json": CARVE_OUTS_19_ONLY_ADAPTER_TEXT });
  });

  it("keeps discipline-exceptions.json, holding an empty list, once its last record is gone", () => {
    const { repository, disk } = repositoryOver({ working: { "discipline-exceptions.json": CARVE_OUTS_19_TEXT }, base: {} });

    expect(repository.remove({ pairs: [ADAPTER_PAIR, PORT_PAIR] })).toEqual({ outcome: "ok", value: [ADAPTER_PAIR, PORT_PAIR] });
    expect(disk.texts()).toEqual({ "discipline-exceptions.json": EMPTIED_TEXT });
  });

  it("leaves an authorised location on the pair's clause and file, and a pair no record holds, writing nothing", () => {
    const { repository, disk } = repositoryOver({ working: SPLIT_FILES, base: {} });

    expect(
      repository.remove({ pairs: [pairOf({ clause: "CD-19#import-boundaries", file: "src/c.ts" }), pairOf({ clause: "CD-15#loops", file: "src/a.ts" })] }),
    ).toEqual({ outcome: "ok", value: [] });
    expect(disk.texts()).toEqual(SPLIT_FILES);
  });

  it("refuses a repository holding both layouts, writing nothing", () => {
    const { repository, disk } = repositoryOver({ working: { ...SINGLE_FILES, ...SPLIT_FILES }, base: {} });

    expect(repository.remove({ pairs: [ADAPTER_PAIR] })).toEqual({
      outcome: "failed",
      error: { kind: "records-in-both-layouts", path: "/repo/discipline-exceptions.json", folder: "/repo/discipline-exceptions" },
    });
    expect(disk.texts()).toEqual({ ...SINGLE_FILES, ...SPLIT_FILES });
  });
});

const LEFT_AS_THEY_ARE: readonly {
  readonly state: string;
  readonly working: Readonly<Record<string, string>>;
  readonly outcome: { readonly effect: string; readonly path: string };
}[] = [
  { state: "already split", working: SPLIT_FILES, outcome: { effect: "already-split", path: "discipline-exceptions" } },
  { state: "without records", working: {}, outcome: { effect: "no-records", path: "discipline-exceptions.json" } },
  { state: "with an empty records file", working: { "discipline-exceptions.json": EMPTY_TEXT }, outcome: { effect: "no-records", path: "discipline-exceptions.json" } },
];

describe("createExceptionRepository moveToSplitLayout", () => {
  it("writes one file for each kind and discipline, in the single file's order within each, then removes the single file", () => {
    const { repository, disk } = repositoryOver({ working: SINGLE_FILES, base: {} });

    expect(repository.moveToSplitLayout()).toEqual({
      outcome: "ok",
      value: {
        effect: "split",
        writes: [
          { path: "discipline-exceptions/authorised-locations/cd-19.json", effect: "written" },
          { path: "discipline-exceptions/clause-wide-carve-outs/team/tm-1.json", effect: "written" },
          { path: "discipline-exceptions/file-carve-outs/cd-19.json", effect: "written" },
          { path: "discipline-exceptions/file-carve-outs/cd-6.json", effect: "written" },
          { path: "discipline-exceptions.json", effect: "removed" },
        ],
      },
    });
    expect(disk.texts()).toEqual(SPLIT_FILES);
  });

  it("refuses a record whose clause names no discipline, writing nothing", () => {
    const { repository, disk } = repositoryOver({ working: { "discipline-exceptions.json": UNPLACEABLE_TEXT }, base: {} });

    expect(repository.moveToSplitLayout()).toEqual({
      outcome: "failed",
      error: {
        kind: "records-unsplittable",
        path: "/repo/discipline-exceptions.json",
        detail:
          'exceptions[1] has the clause "CD-19 import-boundaries", which names no discipline, so no rule\'s file can hold it: ✖ is not a clause address of the form [<ruleSet>/]<discipline>#<clause>; fix its clause or remove it, then split again',
      },
    });
    expect(disk.texts()).toEqual({ "discipline-exceptions.json": UNPLACEABLE_TEXT });
  });

  it("refuses a records file holding keys beside version and exceptions, naming them and writing nothing", () => {
    const { repository, disk } = repositoryOver({ working: { "discipline-exceptions.json": ANNOTATED_TEXT }, base: {} });

    expect(repository.moveToSplitLayout()).toEqual({
      outcome: "failed",
      error: {
        kind: "records-unsplittable",
        path: "/repo/discipline-exceptions.json",
        detail:
          'holds the keys "$schema", "notes" beside version and exceptions, and the split layout has no file to keep them in; remove them or keep them elsewhere, then split again',
      },
    });
    expect(disk.texts()).toEqual({ "discipline-exceptions.json": ANNOTATED_TEXT });
  });

  it.each(LEFT_AS_THEY_ARE)("leaves a repository $state as it is", ({ working, outcome }) => {
    const { repository, disk } = repositoryOver({ working, base: {} });

    expect({ split: repository.moveToSplitLayout(), texts: disk.texts() }).toEqual({ split: { outcome: "ok", value: outcome }, texts: working });
  });

  it("refuses to split while both layouts are present", () => {
    expect(repositoryOver({ working: { ...SINGLE_FILES, ...SPLIT_FILES }, base: {} }).repository.moveToSplitLayout()).toMatchObject({
      outcome: "failed",
      error: { kind: "records-in-both-layouts" },
    });
  });
});

describe("placementOf", () => {
  it.each([
    { entry: ADAPTER, file: "discipline-exceptions/file-carve-outs/cd-19.json" },
    { entry: PORT, file: "discipline-exceptions/file-carve-outs/cd-19.json" },
    { entry: WRAPPING, file: "discipline-exceptions/authorised-locations/cd-19.json" },
    { entry: TEAM_WIDE, file: "discipline-exceptions/clause-wide-carve-outs/team/tm-1.json" },
    { entry: { ...ADAPTER, clause: "CD-7a#nesting" }, file: "discipline-exceptions/file-carve-outs/cd-7a.json" },
  ])("keeps a $entry.kind on $entry.clause in $file", ({ entry, file }) => {
    expect(placementOf({ entry })).toEqual({ placed: "yes", file });
  });
});
