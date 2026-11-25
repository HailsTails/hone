# How to read the rules

A finding names a symptom. Read it along the chain:

**symptom → case → why → reason to change**

A [symptom](typescript/symptoms.md) is what was seen in the code. It points at the [cases](cases.md) it may indicate: what the code was trying to do. Each case owes one or more whys, its [principles](principles.md), and each principle names its reason to change. The [rules](rules.md) under a principle say what must hold, and the [recipes](typescript/recipes.md) are the known methods that make a rule hold.

## Why these rules are strict

"my rules are stricter than most because leaving any trade off or judgement based calls to llm leads to the easiest option locally. Which is almost never the better choice."

So no principle or rule leaves a trade-off or a judgement call to the reader. It states what must hold. The room for a correct exception is a record, never softness in the text. Being stricter than a cited source is intended.

## The model

| Kind | What it is | Industry name |
|---|---|---|
| [Principle](principles.md) | A why. What it protects and its reason to change. | Rationale |
| [Case](cases.md) | What the code is trying to do ("this needs the current time"). Where the why is owed. | Problem in context |
| [Rule](rules.md) | What must hold. Carries no exceptions. | Requirement |
| [Recipe](typescript/recipes.md) | A known method that makes a rule hold, with the reason it was chosen. "It's as binding as it's reasoning. The proof of burden is on the deviation to show that the reason it was chosen no longer holds." | Acceptable means of compliance; pattern |
| [Symptom](typescript/symptoms.md) | Something seen in code. Suspect by default. May point at several rules. | Code smell |
| [Check](typescript/checks.md) | How a symptom is found. Imperfect by design. | Enforcement; fitness function |
| [Record](records.md) | A thought-through use, known debt, or a design decision. | Deviation record; ADR |

"Reasons to change" is not on the list. It is the test used to place a boundary and to decide whether two things are one.

## The language boundary

Principles, cases and rules are cross-language. Recipes, symptoms and checks are written for one language; TypeScript is the one today, under [typescript](typescript/symptoms.md).

Two tests for a rule:
1. It names no language feature. If it only makes sense because of a quirk of the language, it is a symptom or a recipe for that language.
2. The other rules together do not already give it. If they do, it is a case.

## Names, not numbers

Rules, principles, cases, recipes and symptoms are named, not numbered. A name's id is the name, hyphenated. [Every CD](numbers.md) maps each old number to its new names. Each check's mechanics are on its own page under its symptom.

[Every CD](numbers.md#every-numbered-discipline) lists each numbered discipline with its title, clauses, files checked and review lens.

## Words used the same way everywhere

- **Business logic:** all code outside a recorded boundary.
- **Unit:** one function.
- **Port:** an interface of ours that business logic is handed.
- **Adapter:** a unit inside a recorded boundary that fulfils a port.
- **Passed in:** given as an argument or to the factory that built the unit. Never imported.
- **One decision:** one reason to change.
- **Outside dependency:** what was called a package. An internal package is our own code.

## The pages

| Page | What it holds |
|---|---|
| [principles.md](principles.md) | The principles, each with what must hold, what it protects, its reason to change and where a breach sits |
| [cases.md](cases.md) | The cases under each principle, the whys each owes, and what to do |
| [rules.md](rules.md) | The named rules |
| [records.md](records.md) | The record kinds, and today's record formats beside them |
| [sources.md](sources.md) | The sources behind each principle, rule, recipe and record kind |
| [typescript/recipes.md](typescript/recipes.md) | The recipes for TypeScript |
| [typescript/symptoms.md](typescript/symptoms.md) | The symptoms in TypeScript, and how near today's checks come |
| [typescript/checks.md](typescript/checks.md) | Each check, its margin and its settings |
| [numbers.md](numbers.md) | Every CD number and its new names |

## Selecting checks

Adopters select clauses in `disciplines.json`. Selecting one clause adopts its discipline, so every mechanical clause of an adopted discipline must be selected, each through one of its checks, or listed as `"not-run"` or `"not-adopted"`; the check reports the rest as uncovered. Review clauses are judgement clauses: they cannot be selected and are applied in review with the discipline's review lens, as [ADOPTING.md](../ADOPTING.md#9-apply-the-judgement-rules) describes.

Exceptions are recorded in `discipline-exceptions.json`; see [the package README](../README.md#hone-records). [The spirit of the rules](SPIRIT.md) explains what the friction is for.

## Principles

A principle is a why: what it protects and its reason to change. Each is stated in the same four lines: what must hold, what it protects, its reason to change, and where a breach sits.

The principles hold in combination, not one at a time. "The principles are not to hold my rulings on their own but in combination."

Principles name no language, tool or library. [Cases](cases.md) say what to do for each thing code is trying to do, and [rules](rules.md) say what must hold under each principle.

## Not principles

- **Failures as values.** A rule under The type checker proves it.
- **Sensitive data.** Its rules stand on their own with safety as their why.
- **Determinism.** The test half is in Tests are ours ("inputs the test writes out"). The other half is in One place decides (one unit dates, one numbers) and External behaviour sits at a boundary (a clock depends on more than its arguments).
- **Reasons to change.** The test that says what one decision is, not a principle.

## Rules

A rule states what must hold. It carries no exceptions. A rule's id is its name, hyphenated.

Each rule passes two tests: it names no language feature, and the other rules together do not already give it. Where a rule only restated its principle, it was dropped and the principle decides. The room for a correct exception is a [record](records.md), never softness in the text.

## Rules: No hidden effects

No rule. The principle decides. State that changes between calls lives only in an adapter: No hidden effects plus External behaviour sits at a boundary give it, so it is a case.

## Rules: External behaviour sits at a boundary

Outside dependency: what was called a package. An internal package is our own code, under One reason per module and the layering.

## Rules: No leak across a boundary

No rule. The principle, now covering data and failures, plus One reason per module, gives one adapter per outside party that maps both ways, so Reads data from outside (request, file, environment, stored row, response) and Sends data out of the program are each a case that owes One reason per module.

## Cases

A case is what the code is trying to do. It is where the why is owed. A case may owe more than one why. "Owes" lists principles by short name; the first one decides what to do.

Short names: Tests ([Tests are ours](principles.md#tests-are-ours)), One place ([One place decides](principles.md#one-place-decides)), Effects ([No hidden effects](principles.md#no-hidden-effects)), Boundary ([External behaviour sits at a boundary](principles.md#external-behaviour-sits-at-a-boundary)), Leak ([No leak across a boundary](principles.md#no-leak-across-a-boundary)), Checker ([The type checker proves it](principles.md#the-type-checker-proves-it)), Language ([Our code reads in the common language](principles.md#our-code-reads-in-the-common-language)), Outside risk ([Outside risk is carried on purpose](principles.md#outside-risk-is-carried-on-purpose)).

Cases name no language, tool or library.

## Cases: Tests are ours

Quoted reasons: "If it calls something and uses its output we hardcode that output using DI." "no for each in tests, hard coded and not dynamic only" "No conditional run time checks within an expect. Use an assert to narrow and standard expects" "if its a unit test it covers the unit it is the companion file to" "They are integration test tools. Per my code disciplines they are for the boundary it needs only."

## Cases: One place decides

Quoted reasons: "I hold to functions are doers or are orchestrator a teaching." "If it's long it's doing too many things inline." "If nested it's a poorly modelled set of questions for a single job." "the choice of duplicate or not or boundary or not is pretty much always a deep think on "reasons to change"" "all types have a purpose. that purpose is its reason to exist and its reason to change" "dry is true but it must be held with reasons to change not "same functional code right now""

## Cases: No hidden effects

Quoted reasons: "An effect can be checked at the units seam is about testing what is ours not what isn't." "this is a bunch of nullable and state management mess"

Quoted reasons: "An effect can be checked at the units seam is about testing what is ours not what isn't." "this is a bunch of nullable and state management mess"

## Cases: External behaviour sits at a boundary

Quoted reasons: "we have a clock, why is bare date being used?" "Yes the library and the data are different reasons to change. Often why we have a port for http and a port for the specific resource/domain that utilises the http port to access it."

## Cases: No leak across a boundary

Quoted reasons: "I didn't want a json parse wrapper. I wanted a boundary on whoever made json" "our usecase of literal json should only be boundaries that are using json. As we should be runtime objects not json as soon as we leave a boundary" "no default, must be provided as env var"

## Cases: The type checker proves it

Quoted reasons: "sounds like a rule of the type checker in a way. As it makes the output clear to type system instead of hidden in throws" "way too much casting, hint: the correct amount of casting is **0**"

## Cases: Our code reads in the common language

Quoted reasons: "dont care if its a lambda function or not, meaningful names always" "If the code isn't self explanatory that's the problem. You shouldn't need usage notes at all." "language additions beyond the common language expected of engineers in the space and language obscuring standard operations."

Meaning by name, never by position: a unit whose signature is ours takes one argument; a callback shaped by an outside API takes what that API passes.

## Cases: Outside risk is carried on purpose

Quoted reasons: "Packages need a justification for the maintenance they add."

Outside dependency: what was called a package. An internal package is our own code. An internal package falls under One place decides and the layering, not this case.

## Outside the cases

- **Sensitive data:** safety is their why; no principle forces them.
- **Records and debt:** see [records](records.md).
- **A named ban:** no record makes it correct. Existing use is still held as debt, like any symptom.
- **How rules and checks are written:** spirit pure, strict wording, checks imperfect by design.
- **Process:** root cause over a guard, no deferring, no ask-me exits, no parallel machinery.

## Recipes

A recipe is a known method that makes a [rule](rules.md) hold, with the reason it was chosen. Recipes name the tool, the feature and the method. Rules stay as they are.

A recipe is "as binding as it's reasoning. The proof of burden is on the deviation to show that the reason it was chosen no longer holds."

So every recipe says why it was chosen, and binds as far as that reason holds. **A [deviation record](records.md#deviation) names the recipe and its reason, and shows that this reason does not hold at this site. Showing that another method also meets the rule is not enough.**

Where a reason is marked **proposed**, it is not yet accepted.

Outside dependency: what was called a package. An internal package is our own code.

## Recipes: Examples

A recipe's examples show the method. Each names the check and form it answers. The first block is a flagged form, and each block after it is the method applied. Every block after the first passes every check Hone ships at every edition, and compiles under the compiler options [strictness-weakened](typescript/symptoms/strictness-weakened.md) requires. Statements outside an `it` stand for the body of one test. `assert`, `expect`, `it` and `vi` come from `vitest`, and a `declare const` line stands for the unit under test or what it is handed.

## Recipes: No hidden effects

The principle decides.

## Recipes: No leak across a boundary

The principle decides.

## Recipes: Shipped risk declared

Proposed, not accepted: the rule, its case [Ships code for others](cases.md#proposed-cases), and this recipe.

## Built-ins and libraries: decided answers

Whether code of ours may use a built-in or a library directly, as the principles decide it. Short names in the "By" column: Tests ([Tests are ours](principles.md#tests-are-ours)), One place ([One place decides](principles.md#one-place-decides)), Effects ([No hidden effects](principles.md#no-hidden-effects)), Boundary ([External behaviour sits at a boundary](principles.md#external-behaviour-sits-at-a-boundary)), Leak ([No leak across a boundary](principles.md#no-leak-across-a-boundary)), Checker ([The type checker proves it](principles.md#the-type-checker-proves-it)), Language ([Our code reads in the common language](principles.md#our-code-reads-in-the-common-language)), Outside risk ([Outside risk is carried on purpose](principles.md#outside-risk-is-carried-on-purpose)).

| Case | Answer | By |
|---|---|---|
| `console` | Only through a port passed in | Effects |
| `Date.now()` in `chargeOrder` | No: it depends on more than its arguments, and dating is another unit's decision | Boundary, One place, Tests |
| An HTTP client, or our own wrapper of one, imported | No: a port passed in | Boundary |
| `Intl.NumberFormat` | No: depends on the runtime's locale data | Boundary |
| `structuredClone`, `Math`, `Map`, `URL` | Direct in business logic; never to compute a test's expectation | Boundary, Tests |
| `JSON.parse`, `isValidIBAN` | Direct, no wrapper, in the adapter | Leak |
| `z.infer` as a business-logic type | No: not our own type, and an outside dependency's type in a signature | Leak, Boundary, Language |
| `addBusinessDays` from a library | No: the decision is not made by a unit of ours | One place |
| `decimal.js` for integer cents | No: the record cannot say why native was not enough | Outside risk |
| `neverthrow`, `ts-pattern`, `fp-ts`, `type-fest` | No | Language, Outside risk |
| lodash | No | named ban |

Quoted reasons: "json and Zod indicate a boundary about external behaviour. Same with clock. Math and map are deterministic logic." "Math and map are deterministic logic. Banned in tests." "Zod is the wire. We can use infer to create a native type we then use on an adapter to create our domain object." "For of mutates by its nature. It doesn't return. It's state holding required or side effect based." "no for of, use functional paradigms and avoid mutation, this solution is rejected" "Lodash is banned. Personal rule."

## Symptoms

A symptom is something seen in code. It is suspect by default, and it may point at several rules. Symptoms here name TypeScript constructs. "Clearly a symptom can exist with ambiguity about reasoning."

A finding has two addresses: where the symptom is seen, and where the breach sits. A symptom's id is its name, hyphenated.

Where the thing seen is correct use, a [record](records.md) covers it. The record kind is named under "Breach usually sits". No symptom carries an exception.

**May indicate** lists cases, then the rules they point at, as case → rule.

**Seen by** is one of:
- **syntax:** the file's tree alone;
- **types:** needs the type checker;
- **graph:** needs the import graph;
- **app:** needs the app's structure;
- **files:** config, file names or build output;
- **history:** needs the change history;
- **person:** only a person sees it.

**Check today** is how near today's checks come, from the [checks page](typescript/checks.md): reuse, partial, review (only a review clause covers it), new (nothing covers it), or only review (a person sees it).

Outside dependency: what was called a package. An internal package is our own code.

## Symptoms: Text and schemas past their reader

"Json use and Zod use both imply same sort of symptom". They are two symptoms because two different things are seen.

## Checks

A check is how a [symptom](typescript/symptoms.md) is found. It is imperfect by design. "We aim for a check to find that. But we assess ways to narrow the margin of error and start with the 80/20 rule and reuse what we have where it is sufficient for first cut of mechanical ways to check what we are looking for."

So the symptom states exactly what is seen; a check aims at it and states its margin: what it flags that is not the symptom, and what it misses. An existing check that is sufficient for a first cut is reused.

Correct use at an authorised location is never margin: "it flagging the one allowed location is not a fault. It's what authorised locations are for".

Today's checks are addressed by clause. [Every CD](numbers.md#every-mechanical-clause) gives the symptom each mechanical clause sees.

Outside dependency: what was called a package. An internal package is our own code. Telling an outside dependency from an internal package needs the workspace layout, which is files and config Hone can read.

**Columns.**
- **Reports:** *seen* (where the symptom is), or *seen → breach* (it could also name the breach, given what follows the arrow).
- **Needs:** syntax, types, graph (imports between files), app (the app's structure), files (config, names, build output), history, person.
- **Today:**
  - *reuse:* a clause is enough for a first cut.
  - *partial:* every check of the symptom states what it misses.
  - *review:* only a review clause covers it today.
  - *new:* nothing covers it today.
- **Margin:** what it flags that is not the symptom / what it misses. "Review owes" names what only a person sees.
- **Settings traced to:** each threshold or setting, and the rule or recipe sentence behind it. *Nothing* means no sentence says so.

## Checks: Findings that point at the breach

Several symptoms are seen far from their breach. Each finding has two addresses:
- where the symptom is seen;
- the rule or rules the symptom indicates, with the place the breach usually sits.

Until a check can name the breach, a finding names the rules the symptom points at and where the breach usually sits. It never says only "this line".

## Checks: The test-body checks

Six checks run together on `CD-27#test-body-logic`: [branch-in-a-test#test-body](typescript/symptoms/branch-in-a-test/test-body.md), [throw-or-catch-in-a-test#try-block](typescript/symptoms/throw-or-catch-in-a-test/try-block.md), [rebinding#test-body](typescript/symptoms/rebinding/test-body.md), [computed-value-in-a-test#test-body](typescript/symptoms/computed-value-in-a-test/test-body.md), [text-past-its-reader#test-body](typescript/symptoms/text-past-its-reader/test-body.md) and [double-with-a-body#logic-in-a-passed-function](typescript/symptoms/double-with-a-body/logic-in-a-passed-function.md). Each check's page lists what it flags.

- They read test files only: `.ts` and `.tsx` files that `testFiles` in `hone.config.json` names. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped. Helper files that tests import are not checked.
- None flags loops, which [loop-statement](typescript/symptoms/loop-keyword/loop-statement.md) covers, or `throw`, which [throw-statement](typescript/symptoms/throw-or-catch-in-a-test/throw-statement.md) covers.
- None flags element access such as `calls[0]`, calls to free functions, a method called through a computed key, such as `rows["map"]`, or text built with a template literal.

They have two editions. Edition 1 runs by default. Edition 2 adds what each check lists under edition 2, and becomes the default in the next major release. To run it now, set `edition`, `"1"` or `"2"`; without it the clause runs edition 1, or the latest edition when `checkEditions` in `disciplines.json` is `"latest"`:

```jsonc
"clauseSettings": {
  "CD-27#test-body-logic": { "edition": "2" }
}
```

## Checks: Settings

A setting fails only if it changes what a rule requires. It does not fail when it:
- tunes how early a symptom fires: "Line and complexity are symptoms that flag many things.";
- is scope a codebase chose: "Exclude is any codebases choice to say this is not in scope. It's never bound by any rules."

A default that quietly narrows a rule, which no codebase chose, still fails.

**Settings that change what a rule requires today:**

| Setting | What it changes | Traced to |
|---|---|---|
| Strictness edition 1 flags a flag's presence | requires the recipe's layout, not strictness | a recipe, not a rule. "The older strictness check is probably just a flaw." |
| `.todo` not flagged | a test that does not run passes | a miss. "Todo not flagged is probably just a false negative." |
| Accepted helper names | The subprocess-environment check passes a git spawn when its `env:` option mentions one of three hard-coded identifiers: `hermeticGitEnvironment`, `withoutInheritedGitBindings` or `environment`. It matches the name, not what the value holds, so any variable called `environment` passes. | nothing; a margin of the check (it misses by name) |
| Casing fixed inside Hone | Today file names must be kebab-case or PascalCase, both allowed everywhere, hard-coded. Identifier casing is a fixed option list in Hone's own piece, built on typescript-eslint's naming-convention. The adopter declares neither. | nothing. "Casing should be config from adopter to declare for consistency but requires the folder nuance settings." |
| Tracked-reference form | which TODO counts as tracked | nothing yet |

**Settings that do not:**

| Setting | Why |
|---|---|
| 50-line limit, complexity 15 | where two broad symptoms fire; they change no rule |
| `max-params: 2` | a recorded compromise of the check; its miss is margin |
| `exclude` | scope chosen by the codebase |
| Edition defaults | "Edition defaults would be for backwards compatability since we went npm." An existing adopter keeps the behaviour it installed. |
| `confinedPackages` empty by default | "packages is empty because we can't define the universe and if we just said imports at all we would catch internal packages." Seeing every outside dependency needs a way to tell it from an internal package; until then the list is the adopter's to fill. |
| `__tests__` skipped by default | "probably because of noise level and the fact I don't adopt that folder practice deliberately at all." |
| Which files are test files | "Spec is also just not a naming practice I use." Then: "It honestly should be config for user to declare file naming structure so we can match their conventions." `testFiles` in `hone.config.json` declares it. |
| Generated folders skipped (`node_modules`, `dist` and the like) | not code of ours |
| Reading `.test.js` and `.test.mjs` in the subprocess-environment check | it widens one check, not narrows a rule |
| Suite-body exemption | "A test suite's body is a list of cases, not a coordinator." |
| Drawer names | Screaming folders |
| Shorthand list | Whole words |
| `as const` | Declared, not asserted |
| Integration suffix | its recipe |

## Checks: Folder-scoped settings

Hone has no folder-scoped settings yet. "glob or folder specific ruleset settings would be useful to smooth those" (React beside a Node server; GraphQL types generated in a boundary folder).

Checks whose convention can differ by folder in one repository:
- **Name off its casing.** Identifier and file-name conventions: a React folder's PascalCase components beside a Node server's kebab-case files.
- **Generated code at a boundary.** Checks that would read an outside generator's output as ours: Shorthand name, Name off its casing, Prose in code, Claimed type, Untyped value, Type derived from code, Unit without a running test.

What a folder-scoped setting does:
- It **smooths** a second convention, by choosing which convention a check measures a folder against.
- It **marks generated code** as an outside party's code at a boundary, under that boundary's record.

What it must not be able to do:
- **Switch a rule off for a folder.** That is a record: an authorised location with its why, or debt.
- **Change what a rule means.** For example, a looser line limit, a wider parameter count or a narrower test-file definition for a folder.

So a setting never deselects a clause and never carries debt.

`exclude` is different again. It is scope, outside the model. It needs no rule sentence and no record.
