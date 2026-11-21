import { describe, expect, it } from "vitest";
import { createPathPort } from "../src/infrastructure/node/path-port.ts";
import {
  computedModuleLoad,
  dynamicLoadMatching,
  filesNotMatching,
  filesReachableFrom,
  filesReachingExcept,
  globExtensionsIn,
  importEdgesLeaving,
  importFactsReaching,
  importNotMatching,
  importsOutside,
  importsWithoutFacts,
  importStatementsLeaving,
  importsOutsideFromOwnFolder,
  importStatementsReaching,
  MODULE_EXTENSIONS,
  nodeBuiltinImport,
  outsideFiles,
  packageImport,
  packageOrComputedImport,
  packageTypeImport,
  pathCallsOutside,
  relativeImport,
  relativeImportOfAnyForm,
  relativeImportNotNaming,
  relativeImportReaching,
  sourcesNamed,
  sourcesOfFiles,
  sourcesNotNamed,
  specifierImportsReached,
  unresolvedLoadsReached,
  unscannedEdgesReached,
} from "./confinement.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const underCore = relativeImportReaching({ importingFolder: "core/folder", reach: /^core\// });

describe("relativeImport", () => {
  it("allows a relative value import and a relative type-only import", () => {
    expect([
      relativeImport({ moduleImport: { specifier: "./a.ts", form: "value" } }),
      relativeImport({ moduleImport: { specifier: "../b.ts", form: "type-only" } }),
    ]).toEqual(["allowed", "allowed"]);
  });

  it("refuses a relative dynamic import and a package import", () => {
    expect([
      relativeImport({ moduleImport: { specifier: "./a.ts", form: "dynamic" } }),
      relativeImport({ moduleImport: { specifier: "zod", form: "value" } }),
    ]).toEqual(["outside", "outside"]);
  });
});

describe("relativeImportOfAnyForm", () => {
  it("allows a relative dynamic import and refuses a package import", () => {
    expect([
      relativeImportOfAnyForm({ moduleImport: { specifier: "./a.ts", form: "dynamic" } }),
      relativeImportOfAnyForm({ moduleImport: { specifier: "vitest", form: "value" } }),
    ]).toEqual(["allowed", "outside"]);
  });
});

describe("nodeBuiltinImport", () => {
  it("allows a static node builtin import and refuses a dynamic one and a package", () => {
    expect([
      nodeBuiltinImport({ moduleImport: { specifier: "node:path", form: "value" } }),
      nodeBuiltinImport({ moduleImport: { specifier: "node:path", form: "dynamic" } }),
      nodeBuiltinImport({ moduleImport: { specifier: "path", form: "value" } }),
    ]).toEqual(["allowed", "outside", "outside"]);
  });
});

describe("dynamicLoadMatching", () => {
  it("allows a dynamic load whose specifier matches and refuses another one or a static import of it", () => {
    expect([
      dynamicLoadMatching({ specifier: /^load-\w+$/ })({ moduleImport: { specifier: "load-one", form: "dynamic" } }),
      dynamicLoadMatching({ specifier: /^load-\w+$/ })({ moduleImport: { specifier: "other", form: "dynamic" } }),
      dynamicLoadMatching({ specifier: /^load-\w+$/ })({ moduleImport: { specifier: "load-one", form: "value" } }),
    ]).toEqual(["allowed", "outside", "outside"]);
  });
});

describe("importNotMatching", () => {
  it("refuses an import of any form whose specifier matches and allows every other", () => {
    expect([
      importNotMatching({ specifier: /^eslint(?:\/|$)/ })({ moduleImport: { specifier: "eslint", form: "type-only" } }),
      importNotMatching({ specifier: /^eslint(?:\/|$)/ })({ moduleImport: { specifier: "eslint/rules", form: "dynamic" } }),
      importNotMatching({ specifier: /^eslint(?:\/|$)/ })({ moduleImport: { specifier: "eslint-plugin-x", form: "value" } }),
    ]).toEqual(["outside", "outside", "allowed"]);
  });
});

describe("computedModuleLoad", () => {
  it("allows a dynamic load of a computed specifier and refuses a literal one or a static import", () => {
    expect([
      computedModuleLoad({ moduleImport: { specifier: "pathToFileURL(request.path", form: "dynamic" } }),
      computedModuleLoad({ moduleImport: { specifier: "./runner.ts", form: "dynamic" } }),
      computedModuleLoad({ moduleImport: { specifier: "pathToFileURL(request.path", form: "value" } }),
    ]).toEqual(["allowed", "outside", "outside"]);
  });
});

describe("packageOrComputedImport", () => {
  it("allows any specifier not starting with a dot", () => {
    expect([
      packageOrComputedImport({ moduleImport: { specifier: "zod", form: "value" } }),
      packageOrComputedImport({ moduleImport: { specifier: "request.path", form: "dynamic" } }),
      packageOrComputedImport({ moduleImport: { specifier: "../a.ts", form: "value" } }),
    ]).toEqual(["allowed", "allowed", "outside"]);
  });
});

describe("packageImport", () => {
  it("allows the named package by value or type only, and refuses another package or a dynamic load", () => {
    expect([
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "value" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "type-only" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "dynamic" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint-scope", form: "value" } }),
    ]).toEqual(["allowed", "allowed", "outside", "outside"]);
  });
});

describe("packageTypeImport", () => {
  it("allows the named package type only and refuses it by value", () => {
    expect([
      packageTypeImport({ packageName: "typescript" })({ moduleImport: { specifier: "typescript", form: "type-only" } }),
      packageTypeImport({ packageName: "typescript" })({ moduleImport: { specifier: "typescript", form: "value" } }),
    ]).toEqual(["allowed", "outside"]);
  });
});

describe("relativeImportReaching", () => {
  it("allows a relative import resolving inside the reach, of any form", () => {
    expect([
      underCore({ moduleImport: { specifier: "../values/result.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "./sibling.ts", form: "dynamic" } }),
    ]).toEqual(["allowed", "allowed"]);
  });

  it("refuses a relative import resolving outside the reach, and a package import", () => {
    expect([
      underCore({ moduleImport: { specifier: "../../mechanisms/audit/runner/runner.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "../../../outside.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "zod", form: "value" } }),
    ]).toEqual(["outside", "outside", "outside"]);
  });
});

describe("importsOutsideFromOwnFolder", () => {
  const sources = {
    "./core/run/a.ts": 'import { x } from "../values/x.ts";\nimport { y } from "../check/y.ts";\n',
    "./core/run/deeper/b.ts": 'import { x } from "../../values/x.ts";\nimport { y } from "../../check/y.ts";\nimport { z } from "../check/z.ts";\n',
  };

  const reachingNothingUnderCheck = ({ importingFolder }: { readonly importingFolder: string }) => [
    relativeImportReaching({ importingFolder, reach: /^(?!core\/check\/)/ }),
  ];

  it("resolves each import from its own file's folder, so a file in a subfolder reaching core/check is refused", () => {
    expect(importsOutsideFromOwnFolder({ sources, allowedFrom: reachingNothingUnderCheck })).toEqual([
      { file: "./core/run/a.ts", specifier: "../check/y.ts", form: "value" },
      { file: "./core/run/deeper/b.ts", specifier: "../../check/y.ts", form: "value" },
    ]);
  });
});

describe("filesReachableFrom", () => {
  const sources = {
    "./core/run/start.ts": 'import { a } from "../mid/a.ts";\nimport { h } from "../held/h.ts";\n',
    "./core/mid/a.ts": 'import { b } from "./b.ts";\n',
    "./core/mid/b.ts": "export const b = 1;\n",
    "./core/held/h.ts": 'import { far } from "../far/far.ts";\n',
    "./core/far/far.ts": "export const far = 1;\n",
    "./core/other/unrelated.ts": "export const unrelated = 1;\n",
  };

  it("lists the starting files and every scanned file they reach without entering the files not to be entered", () => {
    expect(filesReachableFrom({ sources, startingFrom: /^\.\/core\/run\//, notEntering: /^\.\/core\/held\// })).toEqual([
      "./core/mid/a.ts",
      "./core/mid/b.ts",
      "./core/run/start.ts",
    ]);
  });
});

describe("importStatementsReaching", () => {
  it("lists each import statement whose specifier matches, whole, with its file, so the names it imports are pinned", () => {
    expect(
      importStatementsReaching({
        sources: {
          "./a.ts": 'import type { One, Two } from "../held/one.ts";\nimport { z } from "zod";\nimport {\n  Three,\n} from "../held/three.ts";\n',
          "./b.ts": 'import { other } from "../free/other.ts";\n',
        },
        specifier: /^\.\.\/held\//,
      }),
    ).toEqual([
      { file: "./a.ts", statement: 'import type { One, Two } from "../held/one.ts";' },
      { file: "./a.ts", statement: 'import {\n  Three,\n} from "../held/three.ts";' },
    ]);
  });
});

describe("importFactsReaching", () => {
  it("lists the file, specifier, type-only form and imported names of each import statement whose specifier matches", () => {
    expect(
      importFactsReaching({
        sources: {
          "./a.ts": 'import type { One, Two } from "../held/one.ts";\nimport { z } from "zod";\nimport {\n  Three,\n} from "../held/three.ts";\nimport Four from "../held/four.ts";\n',
        },
        specifier: /^\.\.\/held\//,
      }),
    ).toEqual([
      { file: "./a.ts", kind: "import", specifier: "../held/one.ts", form: "type-only", names: ["One", "Two"] },
      { file: "./a.ts", kind: "import", specifier: "../held/three.ts", form: "value", names: ["Three"] },
      { file: "./a.ts", kind: "import", specifier: "../held/four.ts", form: "value", names: ["Four"] },
    ]);
  });

  it("lists a default import beside named ones as separate names, and a namespace import as one", () => {
    expect(
      importFactsReaching({
        sources: { "./a.ts": 'import Default, { A } from "../held/one.ts";\nimport * as Everything from "../held/two.ts";\n' },
        specifier: /^\.\.\/held\//,
      }),
    ).toEqual([
      { file: "./a.ts", kind: "import", specifier: "../held/one.ts", form: "value", names: ["Default", "A"] },
      { file: "./a.ts", kind: "import", specifier: "../held/two.ts", form: "value", names: ["* as Everything"] },
    ]);
  });

  it("lists an import as type-only only when the statement itself is marked, since names marked type-only inside it still load the module", () => {
    expect(
      importFactsReaching({
        sources: { "./a.ts": 'import { type A, type B } from "../held/one.ts";\nimport type { C, D } from "../held/two.ts";\n' },
        specifier: /^\.\.\/held\//,
      }),
    ).toEqual([
      { file: "./a.ts", kind: "import", specifier: "../held/one.ts", form: "value", names: ["A", "B"] },
      { file: "./a.ts", kind: "import", specifier: "../held/two.ts", form: "type-only", names: ["C", "D"] },
    ]);
  });

  it("lists a re-export from a matching specifier with the names it passes on", () => {
    expect(
      importFactsReaching({
        sources: { "./a.ts": 'export type { One, Two } from "../held/one.ts";\n' },
        specifier: /^\.\.\/held\//,
      }),
    ).toEqual([{ file: "./a.ts", kind: "re-export", specifier: "../held/one.ts", form: "type-only", names: ["One", "Two"] }]);
  });
});

describe("importsWithoutFacts", () => {
  it("lists a static import or re-export of a matching specifier that the facts do not hold, with how many were found and held", () => {
    expect(
      importsWithoutFacts({
        sources: { "./a.ts": 'import { One } from "../held/one.ts";\nimport "../held/side-effect.ts";\nexport * from "../free/free.ts";\n' },
        specifier: /^\.\.\/held\//,
      }),
    ).toEqual([{ file: "./a.ts", specifier: "../held/side-effect.ts", found: 1, withFacts: 0 }]);
  });

  it("lists nothing when every static import and re-export of a matching specifier has its facts", () => {
    expect(
      importsWithoutFacts({
        sources: { "./a.ts": 'import { One } from "../held/one.ts";\nexport type { Two } from "../held/one.ts";\n' },
        specifier: /^\.\.\/held\//,
      }),
    ).toEqual([]);
  });
});

describe("importsOutside", () => {
  it("lists each import no allowance allows, with its file, in source order", () => {
    expect(
      importsOutside({
        sources: {
          "./a.ts": 'import { z } from "zod";\nimport { b } from "./b.ts";\nimport ts from "typescript";\n',
          "./b.ts": 'export type { Padding } from "left-pad";\n',
        },
        allowed: [relativeImport, packageImport({ packageName: "zod" })],
      }),
    ).toEqual([
      { file: "./a.ts", specifier: "typescript", form: "value" },
      { file: "./b.ts", specifier: "left-pad", form: "type-only" },
    ]);
  });

  it("lists nothing when every import is allowed", () => {
    expect(
      importsOutside({
        sources: { "./a.ts": 'import { b } from "./b.ts";\nimport type { T } from "vitest";\n' },
        allowed: [relativeImport, packageImport({ packageName: "vitest" })],
      }),
    ).toEqual([]);
  });
});

describe("relativeImportNotNaming", () => {
  const notNamingTwo = relativeImportNotNaming({ importingFolder: "pkg/runner", files: ["a.ts", "b.test.ts"] });

  it("allows a sibling import of a file not named, an import of a same-named file in another folder, and a package import", () => {
    expect([
      notNamingTwo({ moduleImport: { specifier: "./c.ts", form: "value" } }),
      notNamingTwo({ moduleImport: { specifier: "../other/a.ts", form: "value" } }),
      notNamingTwo({ moduleImport: { specifier: "zod", form: "value" } }),
    ]).toEqual(["allowed", "allowed", "allowed"]);
  });

  it("refuses an import of each file named, in any form", () => {
    expect([
      notNamingTwo({ moduleImport: { specifier: "./a.ts", form: "value" } }),
      notNamingTwo({ moduleImport: { specifier: "./b.test.ts", form: "type-only" } }),
    ]).toEqual(["outside", "outside"]);
  });

  it("refuses an import of a file named however its specifier reaches the folder", () => {
    expect([
      notNamingTwo({ moduleImport: { specifier: "../runner/a.ts", form: "value" } }),
      notNamingTwo({ moduleImport: { specifier: "./x/../a.ts", form: "value" } }),
    ]).toEqual(["outside", "outside"]);
  });
});

describe("sourcesNamed", () => {
  const sources = { "./dir/a.ts": "a", "./dir/b.ts": "b", "./dir/c.ts": "c" };

  it("gives the sources whose file name is in the list", () => {
    expect(sourcesNamed({ sources, files: ["a.ts", "c.ts"] })).toEqual({ "./dir/a.ts": "a", "./dir/c.ts": "c" });
  });
});

describe("sourcesNotNamed", () => {
  const sources = { "./dir/a.ts": "a", "./dir/b.ts": "b", "./dir/c.ts": "c" };

  it("gives the sources whose file name is not in the list", () => {
    expect(sourcesNotNamed({ sources, files: ["a.ts", "c.ts"] })).toEqual({ "./dir/b.ts": "b" });
  });
});

describe("the reach leaving a start without entering what is held", () => {
  const sources = {
    "./core/run/start.ts":
      'import { a } from "../mid/a.ts";\nimport { h } from "../held/h.ts";\nexport type { T } from "../held/t.ts";\nconst loaded = await import("../held/d.ts");\n',
    "./core/run/held/local.ts": "export const local = 1;\n",
    "./core/run/uses-local.ts": 'import { local } from "./held/local.ts";\n',
    "./core/mid/a.ts": 'import { b } from "../held/b.ts";\n',
    "./core/held/h.ts": 'import { far } from "../far/far.ts";\n',
  };
  const leaving = {
    sources,
    startingFrom: /^\.\/core\/run\//,
    notEntering: /^\.\/core\/held\//,
    reaching: /^\.\/core\/held\//,
  };

  it("lists each import edge into the held files of any form, resolved from its own file, so a re-export or a dynamic load is listed beside an import and a lookalike folder is not", () => {
    expect(importEdgesLeaving(leaving)).toEqual([
      { file: "./core/run/start.ts", specifier: "../held/h.ts", form: "value" },
      { file: "./core/run/start.ts", specifier: "../held/t.ts", form: "type-only" },
      { file: "./core/run/start.ts", specifier: "../held/d.ts", form: "dynamic" },
      { file: "./core/mid/a.ts", specifier: "../held/b.ts", form: "value" },
    ]);
  });

  it("lists each whole import or re-export statement into the held files, resolved from its own file", () => {
    expect(importStatementsLeaving(leaving)).toEqual([
      { file: "./core/run/start.ts", statement: 'import { h } from "../held/h.ts";' },
      { file: "./core/run/start.ts", statement: 'export type { T } from "../held/t.ts";' },
      { file: "./core/mid/a.ts", statement: 'import { b } from "../held/b.ts";' },
    ]);
  });

  it("drops what is held in files matching", () => {
    expect(outsideFiles({ held: importEdgesLeaving(leaving), files: /^\.\/core\/run\// })).toEqual([
      { file: "./core/mid/a.ts", specifier: "../held/b.ts", form: "value" },
    ]);
  });
});

describe("a dynamic load written as a template literal without substitutions", () => {
  const sources = {
    "./core/run/start.ts": "const loaded = await import(`../held/d.ts`);\nconst required = require(`../held/r.ts`);\n",
    "./core/run/chained.ts": "const loaded = await import(`../mid/m.ts`);\n",
    "./core/mid/m.ts": "export const m = await import(`../held/m.ts`);\n",
    "./core/held/d.ts": "export const d = 1;\n",
    "./core/held/m.ts": "export const m = 1;\n",
    "./core/held/r.ts": "export const r = 1;\n",
  };
  const leaving = { sources, startingFrom: /^\.\/core\/run\//, notEntering: /^\.\/core\/held\//, reaching: /^\.\/core\/held\// };

  it("is listed as the import edge it is, whatever the load function", () => {
    expect(importEdgesLeaving(leaving)).toEqual([
      { file: "./core/run/start.ts", specifier: "../held/d.ts", form: "dynamic" },
      { file: "./core/run/start.ts", specifier: "../held/r.ts", form: "dynamic" },
      { file: "./core/mid/m.ts", specifier: "../held/m.ts", form: "dynamic" },
    ]);
  });

  it("is followed through the graph, so a chain through it is found", () => {
    expect(
      filesReachingExcept({ sources, startingFrom: /^\.\/core\/run\//, reaching: /^\.\/core\/held\//, exceptEdges: [] }),
    ).toEqual(["./core/run/chained.ts", "./core/run/start.ts"]);
  });

  it("is refused as a computed load by no allowance, because it reads as the path it is", () => {
    expect(
      importsOutside({ sources: { "./a.ts": "const loaded = await import(`../held/d.ts`);\n" }, allowed: [packageOrComputedImport] }),
    ).toEqual([{ file: "./a.ts", specifier: "../held/d.ts", form: "dynamic" }]);
  });
});

describe("unresolvedLoadsReached", () => {
  const sources = {
    "./core/run/start.ts": `import { a } from "./a.ts";
const relative = await import("./a.ts");
const named = await import("zod");
const computed = await import(\`\${folder}/mod.ts\`);
const viaVariable = await import(modulePath);
`,
    "./core/run/a.ts": "export const a = 1;\n",
    "./core/held/h.ts": "const hidden = await import(somewhere);\n",
    "./core/unreached/u.ts": "const hidden = await import(elsewhere);\n",
  };

  it("lists each dynamic load in the reached files that no relative path names, as written, and none it cannot enter", () => {
    expect(unresolvedLoadsReached({ sources, startingFrom: /^\.\/core\/run\//, notEntering: /^\.\/core\/held\// })).toEqual([
      { file: "./core/run/start.ts", specifier: "zod", form: "dynamic" },
      { file: "./core/run/start.ts", specifier: `\`\${folder}/mod.ts\``, form: "dynamic" },
      { file: "./core/run/start.ts", specifier: "modulePath", form: "dynamic" },
    ]);
  });
});

describe("globExtensionsIn", () => {
  it("lists each distinct extension set a source glob names under a folder, in the order first written, and none of a glob naming a file", () => {
    const text = `const a = import.meta.glob(["./core/a/**/*.ts", "./core/b/**/*.{ts,mts}", './core/c/**/*.ts', "./core/d/file.ts"]);
const b = import.meta.glob(["./core/e/**/*.{ts,mts}"]);
`;
    expect(globExtensionsIn({ text })).toEqual(["ts", "{ts,mts}"]);
  });

  it("holds the module extensions every guard glob names", () => {
    expect(MODULE_EXTENSIONS).toBe("{ts,mts,cts,tsx,js,mjs,cjs,jsx}");
  });
});

describe("a module of another extension in the files version 2 owns", () => {
  const sources = {
    "./core/run/leak.mts": 'export * from "../upgrade/answering/governance.ts";\n',
    "./core/run/chain.mts": 'import { run } from "../check/run-check.ts";\n',
    "./core/upgrade/answering/governance.ts": "export const governed = 1;\n",
    "./core/check/run-check.ts": "export const run = 1;\n",
  };

  it("is read as an edge into version 1, so the frontier lists it", () => {
    expect(
      importEdgesLeaving({
        sources,
        startingFrom: /^\.\/core\/run\//,
        notEntering: /^\.\/core\/(?:upgrade|check)\//,
        reaching: /^\.\/core\/(?:upgrade|check)\//,
      }),
    ).toEqual([
      { file: "./core/run/leak.mts", specifier: "../upgrade/answering/governance.ts", form: "value" },
      { file: "./core/run/chain.mts", specifier: "../check/run-check.ts", form: "value" },
    ]);
  });
});

describe("unscannedEdgesReached", () => {
  const sources = {
    "./core/run/start.ts": `import { a } from "./a.ts";
import { s } from "../values/scanned.mts";
const unread = await import("../values/x.mts");
import { gone } from "./gone.js";
import { o } from "../../outside/o.ts";
import { z } from "zod";
`,
    "./core/run/a.ts": "export const a = 1;\n",
    "./core/values/scanned.mts": "export const s = 1;\n",
    "./core/held/h.ts": 'import { far } from "../far/far.ts";\n',
  };

  it("lists each relative edge in the reached files that resolves under the folder to no source given, whatever its form, and none that resolves outside it or names a package", () => {
    expect(
      unscannedEdgesReached({ sources, startingFrom: /^\.\/core\/run\//, notEntering: /^\.\/core\/held\//, within: /^\.\/core\// }),
    ).toEqual([
      { file: "./core/run/start.ts", specifier: "../values/x.mts", form: "dynamic" },
      { file: "./core/run/start.ts", specifier: "./gone.js", form: "value" },
    ]);
  });
});

describe("specifierImportsReached", () => {
  const sources = {
    "./core/run/start.ts": `import { createRequire } from "node:module";
import legacy from "module";
const loaded = await import("node:module");
import { z } from "zod";
import { p } from "./module.ts";
`,
    "./core/run/module.ts": "export const p = 1;\n",
    "./core/held/h.ts": 'import legacy from "module";\n',
  };

  it("lists each import or load in the reached files whose specifier matches, as written, and none in files it cannot enter", () => {
    expect(
      specifierImportsReached({ sources, startingFrom: /^\.\/core\/run\//, notEntering: /^\.\/core\/held\//, specifier: /^(?:node:)?module$/ }),
    ).toEqual([
      { file: "./core/run/start.ts", specifier: "node:module", form: "value" },
      { file: "./core/run/start.ts", specifier: "module", form: "value" },
      { file: "./core/run/start.ts", specifier: "node:module", form: "dynamic" },
    ]);
  });
});

describe("the loads the guards read, by the syntax and not by the text", () => {
  const sources = {
    "./core/run/forms.ts": `const concatenated = await import("../values/" + "x.ts");
const escapedString = await import("../verd\\x69ct/x.ts");
const backtick = await import(\`../verdict/b.ts\`);
const escapedBacktick = await import(\`../verd\\x69ct/c.ts\`);
const commented = await import(/* note */ "../verdict/d.ts");
const required = require(\`../verdict/e.ts\`);
const sampleText = "import('../verdict/f.ts')";
// import("../verdict/g.ts")
`,
  };
  const request = { sources, startingFrom: /^\.\/core\/run\//, notEntering: /^\.\/core\/verdict\// };

  it("lists a load into a watched folder however its path is written, an escape, a backtick or a comment in the call included, and none that sits in a string or a comment", () => {
    expect(importEdgesLeaving({ ...request, reaching: /^\.\/core\/verdict\// })).toEqual([
      { file: "./core/run/forms.ts", specifier: "../verdict/x.ts", form: "dynamic" },
      { file: "./core/run/forms.ts", specifier: "../verdict/b.ts", form: "dynamic" },
      { file: "./core/run/forms.ts", specifier: "../verdict/c.ts", form: "dynamic" },
      { file: "./core/run/forms.ts", specifier: "../verdict/d.ts", form: "dynamic" },
      { file: "./core/run/forms.ts", specifier: "../verdict/e.ts", form: "dynamic" },
    ]);
  });

  it("lists a load whose path is built by concatenation by its exact text, so it is pinned and not read as a relative path", () => {
    expect(unresolvedLoadsReached(request)).toEqual([
      { file: "./core/run/forms.ts", specifier: `"../values/" + "x.ts"`, form: "dynamic" },
    ]);
  });
});

describe("filesReachingExcept", () => {
  const sources = {
    "./core/run/direct.ts": 'import { a } from "../held/a.ts";\n',
    "./core/run/chained.ts": 'import { b } from "../mid/b.ts";\n',
    "./core/run/reexporting.ts": 'export type { T } from "../held/t.ts";\n',
    "./core/mid/b.ts": 'import { a } from "../held/a.ts";\n',
    "./core/held/a.ts": "export const a = 1;\n",
    "./core/held/t.ts": "export type T = string;\n",
  };
  const reaching = { sources, startingFrom: /^\.\/core\/run\//, reaching: /^\.\/core\/held\// };

  it("lists the files still reaching the held files once the excepted edges are removed from the graph, whatever form the edge has", () => {
    expect(
      filesReachingExcept({
        ...reaching,
        exceptEdges: [
          { file: "./core/run/direct.ts", specifier: "../held/a.ts", form: "value" },
          { file: "./core/run/reexporting.ts", specifier: "../held/t.ts", form: "type-only" },
        ],
      }),
    ).toEqual(["./core/run/chained.ts"]);
  });

  it("lists nothing when every reaching edge is excepted", () => {
    expect(
      filesReachingExcept({
        ...reaching,
        exceptEdges: [
          { file: "./core/run/direct.ts", specifier: "../held/a.ts", form: "value" },
          { file: "./core/run/reexporting.ts", specifier: "../held/t.ts", form: "type-only" },
          { file: "./core/mid/b.ts", specifier: "../held/a.ts", form: "value" },
        ],
      }),
    ).toEqual([]);
  });
});

describe("sourcesOfFiles", () => {
  const sources = { "./dir/a.ts": "a", "./dir/b.ts": "b", "./other/a.ts": "c" };

  it("keeps only the sources at the listed paths", () => {
    expect(sourcesOfFiles({ sources, files: ["./dir/a.ts", "./other/a.ts"] })).toEqual({ "./dir/a.ts": "a", "./other/a.ts": "c" });
  });
});

describe("filesNotMatching", () => {
  it("lists each file whose whole text the pattern does not match", () => {
    expect(
      filesNotMatching({
        sources: { "./kept.ts": "const kept = 1;\n", "./broken.ts": 'import { x } from "../core/check/x.ts";\n' },
        pattern: /^(?!.*core\/check\/).*$/s,
      }),
    ).toEqual(["./broken.ts"]);
  });
});

describe("pathCallsOutside", () => {
  it("reports at least one call and lists the observed paths outside the root or the pattern", () => {
    expect(
      pathCallsOutside({
        path: posixPath,
        root: "/install",
        calls: [[{ path: "/install/core/a.ts" }], [{ path: "/install/tests/b.ts" }], [{ path: "/elsewhere/c.ts" }]],
        paths: /^core\//,
      }),
    ).toEqual({ called: "at least once", outside: ["/install/tests/b.ts", "/elsewhere/c.ts"] });
  });

  it("reports never when no call was made", () => {
    expect(pathCallsOutside({ path: posixPath, root: "/install", calls: [], paths: /^core\// })).toEqual({
      called: "never",
      outside: [],
    });
  });
});
