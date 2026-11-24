import { assert, describe, expect, it } from "vitest";

import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./process-global-used-in-place.ts";

const SOURCE_FILE = repoPathSchema.parse("src/read-settings.ts");
const BINDING: CheckBinding = {
  address: "process-global-used-in-place#direct-global-use",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/process-global-used-in-place/direct-global-use",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "process-global-used-in-place.ts" },
};

const parsed = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});

describe("process globals", () => {
  it.each([
    'import process = require("process");\nprocess.env.MODE;',
    'import { default as process } from "node:process";\nprocess.env.MODE;',
    'const process = require("node:process");\nprocess.env.MODE;',
  ])("reports process under its canonical name in %s", (source) => {
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "process.env",
      },
    ]);
  });

  it("passes a local require substitute that returns an injected process port", () => {
    const source =
      'const require = injectedLoader;\nconst process = require("node:process");\nprocess.env.MODE;';
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("reports Node built-in imports that name the original process and console", () => {
    const source =
      'import process from "node:process";\nimport * as console from "console";\nprocess.env.MODE;\nconsole.log("ready");';
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "process.env",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "console.log",
      },
    ]);
  });

  it("reports each direct global use at the expression", () => {
    const source =
      "process.env.MODE;\nprocess['argv'];\nprocess.exit(1);\nprocess.on('exit', finish);\nconsole.log('ready');\nconst runtime = globalThis;";
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "process.env",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "process['argv']",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "process.exit",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "process.on",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: "console.log",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 6, column: 16 },
        snippet: "globalThis",
      },
    ]);
  });

  it("passes injected parameters and unrelated object members", () => {
    const source =
      "const read = (process: Runtime) => process.env;\nconst notify = ({ console }: Runtime) => console.log('ready');\nprovided.process.env;\nprovided.globalThis;\ntype Runtime = typeof globalThis;";
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("leaves a destructured process alias outside the syntax check", () => {
    const source = "const { env: environment } = process;\nenvironment.MODE;";
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("leaves locally declared and imported receivers alone", () => {
    const source =
      'import { console } from "./ports.ts";\nconsole.log("ready");\nfunction run() { const process = ports.process; return process.env.MODE; }\nfunction read() { const globalThis = ports.global; return { globalThis }; }';
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("keeps bare global reads and test writes when the name has no local binding", () => {
    const file = repoPathSchema.parse("src/worker.test.ts");
    const source = "const roots = { globalThis };\nprocess.env.MODE = 'test';";
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [file],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      { file, check: BINDING.address, anchor: { line: 1, column: 16 }, snippet: "globalThis" },
      { file, check: BINDING.address, anchor: { line: 2, column: 0 }, snippet: "process.env" },
    ]);
  });

  it("still reports globals described by ambient declarations", () => {
    const source =
      'export {};\ndeclare const process: Runtime;\ndeclare global { var console: Console; }\nprocess.env.MODE;\nconsole.log("ready");';
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "process.env",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: "console.log",
      },
    ]);
  });
});

describe("browser dialog calls by edition", () => {
  const SOURCE = 'alert("a");\nwindow.confirm("b");\nwindow["prompt"]("c");';

  it("keeps unbound browser dialogs outside edition one", () => {
    const bindings = [{ ...BINDING, edition: FIRST_EDITION }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: SOURCE }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("reports browser dialogs in edition two", () => {
    const bindings = [{ ...BINDING, edition: editionOf("2") }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: SOURCE }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      {
        check: BINDING.address,
        file: SOURCE_FILE,
        anchor: { line: 1, column: 0 },
        snippet: "alert",
      },
      {
        check: BINDING.address,
        file: SOURCE_FILE,
        anchor: { line: 2, column: 0 },
        snippet: "window.confirm",
      },
      {
        check: BINDING.address,
        file: SOURCE_FILE,
        anchor: { line: 3, column: 0 },
        snippet: 'window["prompt"]',
      },
    ]);
  });

  it("passes calls with other receivers, other window members, and dynamic member names", () => {
    const source =
      'notifier.confirm("a");\nthis.alert("b");\nwindow.open(url);\nwindow[name]("c");';
    const bindings = [{ ...BINDING, edition: editionOf("2") }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });

  it("reports dialogs only to edition two and passes ordinary globals to both bindings", () => {
    const later: CheckBinding = {
      ...BINDING,
      address: "process-global-used-in-place#browser-dialog",
      edition: editionOf("2"),
    };
    const source = "alert('check');\nconsole.log('ready');";
    const bindings = [BINDING, later];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([
      { file: SOURCE_FILE, check: later.address, anchor: { line: 1, column: 0 }, snippet: "alert" },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "console.log",
      },
      {
        file: SOURCE_FILE,
        check: later.address,
        anchor: { line: 2, column: 0 },
        snippet: "console.log",
      },
    ]);
  });

  it("passes browser dialog names that are imported, declared locally, or used as parameters", () => {
    const source =
      'import { alert } from "./notifications.ts";\nalert("a");\nconst confirm = (text: string) => true;\nconfirm("b");\nconst request = (window: DialogPort) => window.prompt("c");';
    const bindings = [{ ...BINDING, edition: editionOf("2") }];
    assert(parsed.outcome === "ok");
    const prepared = check.prepare({
      bindings: bindings,
      repository: {
        files: [SOURCE_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      },
      syntaxApi: parsed.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const observed = observeWalkerFile({
      file: { file: SOURCE_FILE, readText: () => ({ outcome: "ok", value: source }) },
      pieces: [
        {
          modulePath:
            "/install/walker/process-global-used-in-place/direct-global-use/process-global-used-in-place.ts",
          bindings: bindings,
          check: prepared.value,
        },
      ],
      parse: parsed.value,
      escapes: [],
    });
    assert(observed.outcome === "ok");
    expect(observed.value.hits).toEqual([]);
  });
});
