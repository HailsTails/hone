# Every CD

Rules, principles, cases, recipes and symptoms are named, not numbered. This is the one page that gives the old numbers: each CD, its verdict, and where it went. Selections, records and findings still use the numbered clause addresses.

| Verdict | Meaning |
|---|---|
| Keeps | A rule under one principle. |
| Merges | Same reason to change as another rule. |
| Splits | The discipline's content went to more than one rule. |
| Recipe | A method for another rule. |
| Cases | A list of cases of an existing rule or principle. |
| Symptom or Check | Something seen in code, or how it is found. |
| Outside | Outside the cases. |

| CD | Verdict | Where |
|---|---|---|
| [CD-1](typescript/symptoms/untyped-value.md) | Symptom | of [Declared, not asserted](rules.md#declared-not-asserted) |
| [CD-2](rules/declared-not-asserted.md) | Keeps | [Declared, not asserted](rules.md#declared-not-asserted) |
| [CD-3](cases/sets-how-strictly-the-checker-works.md) | Cases | strictest checker setting |
| [CD-4](typescript/recipes/zod-at-the-producers-adapter.md) | Recipe | for the No leak case: [Zod at the producer's adapter](typescript/recipes.md#zod-at-the-producers-adapter) |
| [CD-5](rules/one-word-everywhere.md) | Splits | One word everywhere; Declared, not asserted; records |
| [CD-6](rules/one-word-everywhere.md) | Keeps | [One word everywhere](rules.md#one-word-everywhere); casing a check |
| [CD-7](rules/one-reason-per-module.md) | Splits | One reason per module; One word everywhere; filename case a check |
| [CD-7a](typescript/symptoms/type-derived-from-code.md) | Symptom | of [Outside dependencies stay at boundaries](rules.md#outside-dependencies-stay-at-boundaries) |
| [CD-8](typescript/symptoms/default-on-a-closed-union.md) | Symptom | of [Kinds are named](rules.md#kinds-are-named) |
| [CD-9](rules/failures-are-values.md) | Keeps | [Failures are values](rules.md#failures-are-values) |
| [CD-10](rules/failures-are-values.md) | Splits | Failures are values; Straight-through tests; throw-only-error a check |
| [CD-11](typescript/recipes/result-union.md) | Recipe | for [Failures are values](rules.md#failures-are-values) |
| [CD-12](typescript/recipes/port-in-the-domain.md) | Recipe | for [Ports declared inside](rules.md#ports-declared-inside) |
| [CD-13](rules/ports-declared-inside.md) | Keeps | [Ports declared inside](rules.md#ports-declared-inside) |
| [CD-14](typescript/recipes/closure-factory.md) | Splits | no-class recipe; Outside dependencies stay at boundaries; state a case |
| [CD-15](principles/no-hidden-effects.md) | Cases | of [No hidden effects](principles.md#no-hidden-effects) |
| [CD-16](principles/no-hidden-effects.md) | Merges | with CD-15 |
| [CD-17](rules/handed-what-it-uses.md) | Cases | under Handed what it uses and One reason per module |
| [CD-18](rules/ports-declared-inside.md) | Cases | under [Ports declared inside](rules.md#ports-declared-inside) |
| [CD-19](rules/outside-dependencies-stay-at-boundaries.md) | Splits | Outside dependencies stay at boundaries; Ports declared inside; construction and ids cases |
| [CD-20](rules/outside-dependencies-stay-at-boundaries.md) | Merges | with CD-19 |
| [CD-21](cases/builds-the-real-implementations.md) | Cases | built at the entry point |
| [CD-22](typescript/recipes/bounded-context-generic.md) | Recipe | for [Declared, not asserted](rules.md#declared-not-asserted) |
| [CD-23](rules/tested-where-its-owned.md) | Keeps | [Tested where it's owned](rules.md#tested-where-its-owned) |
| [CD-24](rules/tested-where-its-owned.md) | Merges | with CD-23 |
| [CD-25](rules/written-out-answers.md) | Keeps | [Written-out answers](rules.md#written-out-answers) |
| [CD-26](typescript/symptoms/module-or-global-patched.md) | Symptom | of Written-out answers, Ports declared inside |
| [CD-27](rules/straight-through-tests.md) | Splits | Straight-through tests; Tested where it's owned |
| [CD-28](rules/written-out-answers.md) | Merges | into [Written-out answers](rules.md#written-out-answers) |
| [CD-29](rules/tested-where-its-owned.md) | Merges | into [Tested where it's owned](rules.md#tested-where-its-owned) |
| [CD-30](rules/tested-where-its-owned.md) | Merges | into [Tested where it's owned](rules.md#tested-where-its-owned) |
| [CD-31](typescript/symptoms/coverage-gate.md) | Check | of [Tested where it's owned](rules.md#tested-where-its-owned) |
| CD-32 | Outside | outside the 2.0 model (safety), no symptom |
| CD-33 | Outside | outside the 2.0 model (safety), no symptom |
| CD-34 | Outside | outside the 2.0 model (safety), no symptom |
| CD-39 | Outside | outside the 2.0 model (process), no symptom |
| [CD-40](rules/one-word-everywhere.md) | Cases | of One word everywhere, Handed what it uses |
| [CD-41](rules/doer-or-orchestrator.md) | Keeps | [Doer or orchestrator](rules.md#doer-or-orchestrator) |
| [CD-42](rules/guard-first.md) | Keeps | [Guard first](rules.md#guard-first) |
| [CD-43](rules/kinds-are-named.md) | Keeps | [Kinds are named](rules.md#kinds-are-named) |
| [CD-44](principles/no-hidden-effects.md) | Cases | of [No hidden effects](principles.md#no-hidden-effects) |
| [CD-45](principles/no-leak-across-a-boundary.md) | Cases | of [No leak across a boundary](principles.md#no-leak-across-a-boundary) |
| [CD-46](records.md) | Outside | records |
| [CD-47](rules/tested-where-its-owned.md) | Cases | under [Tested where it's owned](rules.md#tested-where-its-owned) |

## Every mechanical clause

Each mechanical clause and the [symptom](typescript/symptoms.md) it sees.

| Clause | Symptom |
|---|---|
| CD-1 (3 clauses) | [Claimed type](typescript/symptoms.md#claimed-type); [Untyped value](typescript/symptoms.md#untyped-value) |
| CD-2 (2 clauses) | [Claimed type](typescript/symptoms.md#claimed-type) |
| CD-3 (7 clauses) | [Strictness weakened](typescript/symptoms.md#strictness-weakened) |
| CD-5 | [Untracked escape](typescript/symptoms.md#untracked-escape) |
| CD-6#identifier-names | [Shorthand name](typescript/symptoms.md#shorthand-name) |
| CD-6#naming-convention | [Name off its casing](typescript/symptoms.md#name-off-its-casing) |
| CD-7#categorical-paths | [Drawer path](typescript/symptoms.md#drawer-path) |
| CD-7#filename-case | [Name off its casing](typescript/symptoms.md#name-off-its-casing) |
| CD-7a | [Type derived from code](typescript/symptoms.md#type-derived-from-code) |
| CD-8 | [Default on a closed union](typescript/symptoms.md#default-on-a-closed-union) |
| CD-10#throws-in-tests | [Throw or catch in a test](typescript/symptoms.md#throw-or-catch-in-a-test) |
| CD-10#throw-only-error | [Thrown non-error](typescript/symptoms.md#thrown-non-error) |
| CD-14#class-syntax, CD-14#static-only-class | [Authored class or this](typescript/symptoms.md#authored-class-or-this) |
| CD-15 | [Loop keyword](typescript/symptoms.md#loop-keyword) |
| CD-17 | [Date used directly](typescript/symptoms.md#date-used-directly) |
| CD-19 | [Outside import past a boundary](typescript/symptoms.md#outside-import-past-a-boundary) |
| CD-23 | [Unit without a running test](typescript/symptoms.md#unit-without-a-running-test) |
| CD-25 | [Double with a body](typescript/symptoms.md#double-with-a-body) |
| CD-26 | [Module or global patched](typescript/symptoms.md#module-or-global-patched) |
| CD-27#test-body-logic | [Branch in a test](typescript/symptoms.md#branch-in-a-test); [Computed value in a test](typescript/symptoms.md#computed-value-in-a-test); [Rebinding](typescript/symptoms.md#rebinding); [Text past its reader](typescript/symptoms.md#text-past-its-reader) |
| CD-27#focused-tests, CD-27#skipped-tests | [Test switched off](typescript/symptoms.md#test-switched-off) |
| CD-40#parameter-count | [Positional parameters](typescript/symptoms.md#positional-parameters) |
| CD-41#cognitive-complexity | [Tangled function](typescript/symptoms.md#tangled-function) |
| CD-41#function-length | [Long function](typescript/symptoms.md#long-function) |
| CD-42 | [Work inside a condition](typescript/symptoms.md#work-inside-a-condition) |
| CD-43 | [Boolean in a signature](typescript/symptoms.md#boolean-in-a-signature) |
| CD-44#parameter-mutation | [Write into a parameter](typescript/symptoms.md#write-into-a-parameter) |
| CD-44#parameter-reassignment | [Rebinding](typescript/symptoms.md#rebinding) |
| CD-47 | [Inherited environment in a subprocess](typescript/symptoms.md#inherited-environment-in-a-subprocess) |

The test-logic check, CD-27#test-body-logic, also sees the `let` form of [Answer set in a hook](typescript/symptoms.md#answer-set-in-a-hook), and `try`, a form of [Throw or catch in a test](typescript/symptoms.md#throw-or-catch-in-a-test).

Review clauses that demand a method (CD-4, CD-9, CD-11, CD-12, CD-21 and CD-22) map to their [recipes](typescript/recipes.md). The outcome each protects is seen by Schema past its adapter, Throw between our units, Failure shaped as success, Port outside the domain, Adapter built outside the root and Default for a required value.

Sensitive data and citation clauses (CD-32, CD-33, CD-34 and CD-39) are outside the 2.0 model, as safety (CD-32, CD-33 and CD-34) and process (CD-39): no item, no symptom, no check. Each is applied in review.

## Every numbered discipline

Each numbered discipline as version 1 held it: its title, its clause addresses, the files its checks read, and its review lens.

Adopters select clauses in `disciplines.json`. Selecting one clause adopts its discipline, so every mechanical clause of an adopted discipline must be selected, each through one of its checks, or listed as `"not-adopted"`; the check reports the rest as uncovered. Clauses marked (review) are judgement clauses: they cannot be selected and are applied in review with the discipline's review lens, as [ADOPTING.md](../ADOPTING.md#9-apply-the-judgement-rules) describes.

| ID | Title | Clauses | Files checked | Review lens |
| --- | --- | --- | --- | --- |
| [CD-1](typescript/symptoms/untyped-value.md) | No any, ever | `CD-1#any-cast`, `CD-1#explicit-any`, `CD-1#implicit-any-let` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| [CD-2](rules/declared-not-asserted.md) | Closed enumerated list of permitted cast sites | `CD-2#cast-expressions`, `CD-2#non-null-assertions` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| [CD-3](cases/sets-how-strictly-the-checker-works.md) | Strict mode flags inherited, never overridden | `CD-3#strict`, `#no-unchecked-indexed-access`, `#exact-optional-property-types`, `#no-implicit-override`, `#no-fallthrough-cases-in-switch`, `#no-property-access-from-index-signature`, `#use-unknown-in-catch-variables` | `tsconfig.json` | [type-soundness](../methods/lenses/type-soundness.md) |
| [CD-4](typescript/recipes/zod-at-the-producers-adapter.md) | Zod at every external boundary | `CD-4#boundary-validation` (review) | — | [zod-boundary](../methods/lenses/zod-boundary.md) |
| [CD-5](rules/one-word-everywhere.md) | No comments, no JSDoc | `CD-5#comments-directives` | `.ts`, `.tsx` | [naming](../methods/lenses/naming.md) |
| [CD-6](rules/one-word-everywhere.md) | Meaningful names always — no shorthand, no filler words | `CD-6#identifier-names`, `CD-6#naming-convention` | `.ts`, `.tsx` | [naming](../methods/lenses/naming.md) |
| [CD-7](rules/one-reason-per-module.md) | No categorical filenames or folder names | `CD-7#categorical-paths`, `CD-7#filename-case` | `.ts`, `.tsx` paths | [naming](../methods/lenses/naming.md) |
| [CD-7a](typescript/symptoms/type-derived-from-code.md) | No ReturnType<typeof X> for our own codebase | `CD-7a#factory-return-types` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| [CD-8](typescript/symptoms/default-on-a-closed-union.md) | No default on switch over a closed discriminated union | `CD-8#switch-defaults` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| [CD-9](rules/failures-are-values.md) | All operational failures return Result<T, E> | `CD-9#result-failures` (review) | — | [errors-as-data](../methods/lenses/errors-as-data.md) |
| [CD-10](rules/failures-are-values.md) | Throws permitted in exactly two contexts | `CD-10#throws-in-tests`, `CD-10#throw-only-error` | `*.test.ts`, `*.test.tsx` | [errors-as-data](../methods/lenses/errors-as-data.md) |
| [CD-11](typescript/recipes/result-union.md) | Operational error envelopes are plain data, not classes | `CD-11#error-envelopes` (review) | — | [errors-as-data](../methods/lenses/errors-as-data.md) |
| [CD-12](typescript/recipes/port-in-the-domain.md) | Repositories are the primary storage abstraction | `CD-12#repository-ports` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| [CD-13](rules/ports-declared-inside.md) | Kernel layer boundaries are non-negotiable | `CD-13#layer-boundaries` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| [CD-14](typescript/recipes/closure-factory.md) | Zero class authoring; classes only at external-library call sites | `CD-14#class-syntax`, `CD-14#static-only-class`, `CD-14#library-construction` (review) | TypeScript, not `.d.ts` | [function-first](../methods/lenses/function-first.md) |
| [CD-15](principles/no-hidden-effects.md) | Iteration is functional transformation, never an imperative loop | `CD-15#loops` | `.ts`, `.tsx` | [function-first](../methods/lenses/function-first.md) |
| [CD-16](principles/no-hidden-effects.md) | No counted for loops | see CD-15 | — | [function-first](../methods/lenses/function-first.md) |
| [CD-17](rules/handed-what-it-uses.md) | Clock is the only time source | `CD-17#clock-sources` | `.ts`, `.tsx` | [di-discipline](../methods/lenses/di-discipline.md), [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-18](rules/ports-declared-inside.md) | Process-lifecycle operations arrive through an injected port | `CD-18#process-lifecycle-ports` (review) | — | [di-discipline](../methods/lenses/di-discipline.md) |
| [CD-19](rules/outside-dependencies-stay-at-boundaries.md) | External dependencies confined to wrapping ports at the boundary | `CD-19#import-boundaries` | `.ts`, `.tsx` | [function-first](../methods/lenses/function-first.md) |
| [CD-20](rules/outside-dependencies-stay-at-boundaries.md) | Runtime stdlib imports arrive through injected ports | see CD-19 | — | [di-discipline](../methods/lenses/di-discipline.md) |
| [CD-21](cases/builds-the-real-implementations.md) | Every injected port ships a default production factory | `CD-21#default-factories` (review) | — | [di-discipline](../methods/lenses/di-discipline.md) |
| [CD-22](typescript/recipes/bounded-context-generic.md) | Middleware generic context constraint | `CD-22#middleware-context` (review) | — | [di-discipline](../methods/lenses/di-discipline.md) |
| [CD-23](rules/tested-where-its-owned.md) | Every unit has a co-located test sibling | `CD-23#export-test-sibling` | production `.ts`, `.tsx` | [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-24](rules/tested-where-its-owned.md) | Every file is unit-tested | see CD-23 | — | [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-25](rules/written-out-answers.md) | Unit tests replace everything outside the unit with test doubles | `CD-25#dependency-isolation` | `*.test.ts`, `*.test.tsx` | [di-discipline](../methods/lenses/di-discipline.md), [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-26](typescript/symptoms/module-or-global-patched.md) | No module-mocking — module-mock means DI is wrong | `CD-26#module-mocking` | `*.test.ts`, `*.test.tsx` | [di-discipline](../methods/lenses/di-discipline.md), [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-27](rules/straight-through-tests.md) | Tests are zero-everything — zero logic, zero branches, zero unpredictability | `CD-27#test-body-logic`, `CD-27#focused-tests`, `CD-27#skipped-tests` | `*.test.ts`, `*.test.tsx` | [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-28](rules/written-out-answers.md) | Tests assert only what the unit is directly responsible for | `CD-28#unit-responsibility` (review) | — | [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-29](rules/tested-where-its-owned.md) | Component/integration tests are the minimum, not the bulk | `CD-29#test-pyramid` (review) | — | [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-30](rules/tested-where-its-owned.md) | Integration tests catch composition bugs only | `CD-30#composition-only` (review) | — | [test-discipline](../methods/lenses/test-discipline.md) |
| [CD-31](typescript/symptoms/coverage-gate.md) | No coverage thresholds | `CD-31#no-coverage-thresholds` (review) | — | [test-discipline](../methods/lenses/test-discipline.md) |
| CD-32 | PII strings redact-by-default in structured logs | `CD-32#pii-redaction` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| CD-33 | Sensitive types brand-redact unconditionally | `CD-33#sensitive-brands` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| CD-34 | Secrets never enter the repo | `CD-34#no-repo-secrets` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| CD-39 | Cite principles by Roman numeral and rules by ID | `CD-39#cite-by-id` (review) | — | none |
| [CD-40](rules/one-word-everywhere.md) | Single-object-argument functions | `CD-40#parameter-count`, `CD-40#named-object-argument` (review) | files the ESLint run includes | [function-first](../methods/lenses/function-first.md) |
| [CD-41](rules/doer-or-orchestrator.md) | Orchestrators contain only orchestration | `CD-41#cognitive-complexity`, `CD-41#function-length`, `CD-41#orchestration-only` (review) | files the ESLint run includes | [decomposition](../methods/lenses/decomposition.md) |
| [CD-42](rules/guard-first.md) | Unhappy paths are early returns; happy path is the final return | `CD-42#useless-else` | files the ESLint run includes | [decomposition](../methods/lenses/decomposition.md) |
| [CD-43](rules/kinds-are-named.md) | Booleans are evaluative, not declarative | `CD-43#boolean-signatures` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| [CD-44](principles/no-hidden-effects.md) | Functions must not mutate fields of parameters they receive | `CD-44#parameter-mutation`, `CD-44#parameter-reassignment` | `.ts`, `.tsx` | [decomposition](../methods/lenses/decomposition.md) |
| [CD-45](principles/no-leak-across-a-boundary.md) | Zod runs exactly once per external-boundary crossing | `CD-45#parse-once` (review) | — | [zod-boundary](../methods/lenses/zod-boundary.md) |
| [CD-46](records.md) | Touching a carved-out file revokes its carve-out — leave it clean | applied to every file carve-out | — | none |
| [CD-47](rules/tested-where-its-owned.md) | Tests are hermetic — no real side effects on anything real | `CD-47#hermetic-git-spawns` | `*.test.{ts,tsx,mjs,js}`, `*.spec.{ts,mjs}` | [test-discipline](../methods/lenses/test-discipline.md) |
