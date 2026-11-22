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
| CD-1 | Symptom | [Untyped value](typescript/symptoms/untyped-value.md) and [Claimed type](typescript/symptoms/claimed-type.md), of [Declared, not asserted](rules/declared-not-asserted.md) |
| CD-2 | Keeps | [Declared, not asserted](rules/declared-not-asserted.md) |
| CD-3 | Cases | [strictest checker setting](cases/sets-how-strictly-the-checker-works.md) |
| CD-4 | Recipe | for the [No leak](principles/no-leak-across-a-boundary.md) case: [Zod at the producer's adapter](typescript/recipes/zod-at-the-producers-adapter.md) |
| CD-5 | Splits | [One word everywhere](rules/one-word-everywhere.md); [Declared, not asserted](rules/declared-not-asserted.md); [records](records.md) |
| CD-6 | Keeps | [One word everywhere](rules/one-word-everywhere.md); casing a [check](typescript/symptoms/name-off-its-casing/naming-convention.md) |
| CD-7 | Splits | [One reason per module](rules/one-reason-per-module.md); [One word everywhere](rules/one-word-everywhere.md); filename case a [check](typescript/symptoms/name-off-its-casing/filename-case.md) |
| CD-7a | Symptom | [Type derived from code](typescript/symptoms/type-derived-from-code.md), of [Outside dependencies stay at boundaries](rules/outside-dependencies-stay-at-boundaries.md) |
| CD-8 | Symptom | [Default on a closed union](typescript/symptoms/default-on-a-closed-union.md), of [Kinds are named](rules/kinds-are-named.md) |
| CD-9 | Keeps | [Failures are values](rules/failures-are-values.md) |
| CD-10 | Splits | [Failures are values](rules/failures-are-values.md); [Straight-through tests](rules/straight-through-tests.md); throw-only-error a [check](typescript/symptoms/thrown-non-error/throw-only-error.md) |
| CD-11 | Recipe | [Result union](typescript/recipes/result-union.md), for [Failures are values](rules/failures-are-values.md) |
| CD-12 | Recipe | [Port in the domain](typescript/recipes/port-in-the-domain.md), for [Ports declared inside](rules/ports-declared-inside.md) |
| CD-13 | Keeps | [Ports declared inside](rules/ports-declared-inside.md) |
| CD-14 | Splits | no-class recipe [Closure factory](typescript/recipes/closure-factory.md); [Outside dependencies stay at boundaries](rules/outside-dependencies-stay-at-boundaries.md); state a [case](cases/keeps-state-or-settings-across-calls.md) |
| CD-15 | Cases | of [No hidden effects](principles/no-hidden-effects.md) |
| CD-16 | Merges | with CD-15 |
| CD-17 | Cases | under [Handed what it uses](rules/handed-what-it-uses.md) and [One reason per module](rules/one-reason-per-module.md) |
| CD-18 | Cases | under [Ports declared inside](rules/ports-declared-inside.md) |
| CD-19 | Splits | [Outside dependencies stay at boundaries](rules/outside-dependencies-stay-at-boundaries.md); [Ports declared inside](rules/ports-declared-inside.md); [construction](cases/builds-the-real-implementations.md) and [ids](cases/needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering.md) cases |
| CD-20 | Merges | with CD-19 |
| CD-21 | Cases | [built at the entry point](cases/builds-the-real-implementations.md) |
| CD-22 | Recipe | [Bounded context generic](typescript/recipes/bounded-context-generic.md), for [Declared, not asserted](rules/declared-not-asserted.md) |
| CD-23 | Keeps | [Tested where it's owned](rules/tested-where-its-owned.md) |
| CD-24 | Merges | with CD-23 |
| CD-25 | Keeps | [Written-out answers](rules/written-out-answers.md) |
| CD-26 | Symptom | [Module or global patched](typescript/symptoms/module-or-global-patched.md), of [Written-out answers](rules/written-out-answers.md), [Ports declared inside](rules/ports-declared-inside.md) |
| CD-27 | Splits | [Straight-through tests](rules/straight-through-tests.md); [Tested where it's owned](rules/tested-where-its-owned.md) |
| CD-28 | Merges | into [Written-out answers](rules/written-out-answers.md) |
| CD-29 | Merges | into [Tested where it's owned](rules/tested-where-its-owned.md) |
| CD-30 | Merges | into [Tested where it's owned](rules/tested-where-its-owned.md) |
| CD-31 | Check | [Coverage gate](typescript/symptoms/coverage-gate.md), of [Tested where it's owned](rules/tested-where-its-owned.md) |
| CD-32 | Outside | outside the 2.0 model (safety), no symptom |
| CD-33 | Outside | outside the 2.0 model (safety), no symptom |
| CD-34 | Outside | outside the 2.0 model (safety), no symptom |
| CD-39 | Outside | outside the 2.0 model (process), no symptom |
| CD-40 | Cases | of [One word everywhere](rules/one-word-everywhere.md), [Handed what it uses](rules/handed-what-it-uses.md) |
| CD-41 | Keeps | [Doer or orchestrator](rules/doer-or-orchestrator.md) |
| CD-42 | Keeps | [Guard first](rules/guard-first.md) |
| CD-43 | Keeps | [Kinds are named](rules/kinds-are-named.md) |
| CD-44 | Cases | of [No hidden effects](principles/no-hidden-effects.md) |
| CD-45 | Cases | of [No leak across a boundary](principles/no-leak-across-a-boundary.md) |
| CD-46 | Outside | [records](records.md) |
| CD-47 | Cases | under [Tested where it's owned](rules/tested-where-its-owned.md) |

## Every mechanical clause

Each mechanical clause and the [symptom](typescript/symptoms.md) it sees.

| Clause | Symptom |
|---|---|
| CD-1 (3 clauses) | [Claimed type](typescript/symptoms/claimed-type.md); [Untyped value](typescript/symptoms/untyped-value.md) |
| CD-2 (2 clauses) | [Claimed type](typescript/symptoms/claimed-type.md) |
| CD-3 (7 clauses) | [Strictness weakened](typescript/symptoms/strictness-weakened.md) |
| CD-5 | [Untracked escape](typescript/symptoms/untracked-escape.md) |
| CD-6#identifier-names | [Shorthand name](typescript/symptoms/shorthand-name.md) |
| CD-6#naming-convention | [Name off its casing](typescript/symptoms/name-off-its-casing.md) |
| CD-7#categorical-paths | [Drawer path](typescript/symptoms/drawer-path.md) |
| CD-7#filename-case | [Name off its casing](typescript/symptoms/name-off-its-casing.md) |
| CD-7a | [Type derived from code](typescript/symptoms/type-derived-from-code.md) |
| CD-8 | [Default on a closed union](typescript/symptoms/default-on-a-closed-union.md) |
| CD-10#throws-in-tests | [Throw or catch in a test](typescript/symptoms/throw-or-catch-in-a-test.md) |
| CD-10#throw-only-error | [Thrown non-error](typescript/symptoms/thrown-non-error.md) |
| CD-14#class-syntax, CD-14#static-only-class | [Authored class or this](typescript/symptoms/authored-class-or-this.md) |
| CD-15 | [Loop keyword](typescript/symptoms/loop-keyword.md) |
| CD-17 | [Date used directly](typescript/symptoms/date-used-directly.md) |
| CD-19 | [Outside import past a boundary](typescript/symptoms/outside-import-past-a-boundary.md) |
| CD-23 | [Unit without a running test](typescript/symptoms/unit-without-a-running-test.md) |
| CD-25 | [Double with a body](typescript/symptoms/double-with-a-body.md) |
| CD-26 | [Module or global patched](typescript/symptoms/module-or-global-patched.md) |
| CD-27#test-body-logic | [Branch in a test](typescript/symptoms/branch-in-a-test.md); [Computed value in a test](typescript/symptoms/computed-value-in-a-test.md); [Rebinding](typescript/symptoms/rebinding.md); [Text past its reader](typescript/symptoms/text-past-its-reader.md) |
| CD-27#focused-tests, CD-27#skipped-tests | [Test switched off](typescript/symptoms/test-switched-off.md) |
| CD-40#parameter-count | [Positional parameters](typescript/symptoms/positional-parameters.md) |
| CD-41#cognitive-complexity | [Tangled function](typescript/symptoms/tangled-function.md) |
| CD-41#function-length | [Long function](typescript/symptoms/long-function.md) |
| CD-42 | [Work inside a condition](typescript/symptoms/work-inside-a-condition.md) |
| CD-43 | [Boolean in a signature](typescript/symptoms/boolean-in-a-signature.md) |
| CD-44#parameter-mutation | [Write into a parameter](typescript/symptoms/write-into-a-parameter.md) |
| CD-44#parameter-reassignment | [Rebinding](typescript/symptoms/rebinding.md) |
| CD-47 | [Inherited environment in a subprocess](typescript/symptoms/inherited-environment-in-a-subprocess.md) |

The test-logic check, CD-27#test-body-logic, also sees the `let` form of [Answer set in a hook](typescript/symptoms/answer-set-in-a-hook.md), and `try`, a form of [Throw or catch in a test](typescript/symptoms/throw-or-catch-in-a-test.md).

Review clauses that demand a method (CD-4, CD-9, CD-11, CD-12, CD-21 and CD-22) map to their [recipes](typescript/recipes.md). The outcome each protects is seen by Schema past its adapter, Throw between our units, Failure shaped as success, Port outside the domain, Adapter built outside the root and Default for a required value.

Sensitive data and citation clauses (CD-32, CD-33, CD-34 and CD-39) are outside the 2.0 model, as safety (CD-32, CD-33 and CD-34) and process (CD-39): they are outside Hone's catalogue, with no item, symptom or check, and no Hone lens applies them.

## Every numbered discipline

Each numbered discipline as version 1 held it: its title, its clause addresses, the files its checks read, and its review lens.

Adopters select clauses in `disciplines.json`. Selecting one clause adopts its discipline, so every mechanical clause of an adopted discipline must be selected, each through one of its checks, or listed as `"not-adopted"`; the check reports the rest as uncovered. Clauses marked (review) are judgement clauses: they cannot be selected and are applied in review with the discipline's review lens, as [ADOPTING.md](../ADOPTING.md#9-apply-the-judgement-rules) describes.

| ID | Title | Clauses | Files checked | Review lens |
| --- | --- | --- | --- | --- |
| CD-1 | No any, ever | `CD-1#any-cast`, `CD-1#explicit-any`, `CD-1#implicit-any-let` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| CD-2 | Closed enumerated list of permitted cast sites | `CD-2#cast-expressions`, `CD-2#non-null-assertions` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| CD-3 | Strict mode flags inherited, never overridden | `CD-3#strict`, `#no-unchecked-indexed-access`, `#exact-optional-property-types`, `#no-implicit-override`, `#no-fallthrough-cases-in-switch`, `#no-property-access-from-index-signature`, `#use-unknown-in-catch-variables` | `tsconfig.json` | [type-soundness](../methods/lenses/type-soundness.md) |
| CD-4 | Zod at every external boundary | `CD-4#boundary-validation` (review) | — | [zod-boundary](../methods/lenses/zod-boundary.md) |
| CD-5 | No comments, no JSDoc | `CD-5#comments-directives` | `.ts`, `.tsx` | [naming](../methods/lenses/naming.md) |
| CD-6 | Meaningful names always — no shorthand, no filler words | `CD-6#identifier-names`, `CD-6#naming-convention` | `.ts`, `.tsx` | [naming](../methods/lenses/naming.md) |
| CD-7 | No categorical filenames or folder names | `CD-7#categorical-paths`, `CD-7#filename-case` | `.ts`, `.tsx` paths | [naming](../methods/lenses/naming.md) |
| CD-7a | No ReturnType<typeof X> for our own codebase | `CD-7a#factory-return-types` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| CD-8 | No default on switch over a closed discriminated union | `CD-8#switch-defaults` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| CD-9 | All operational failures return Result<T, E> | `CD-9#result-failures` (review) | — | [errors-as-data](../methods/lenses/errors-as-data.md) |
| CD-10 | Throws permitted in exactly two contexts | `CD-10#throws-in-tests`, `CD-10#throw-only-error` | `*.test.ts`, `*.test.tsx` | [errors-as-data](../methods/lenses/errors-as-data.md) |
| CD-11 | Operational error envelopes are plain data, not classes | `CD-11#error-envelopes` (review) | — | [errors-as-data](../methods/lenses/errors-as-data.md) |
| CD-12 | Repositories are the primary storage abstraction | `CD-12#repository-ports` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| CD-13 | Kernel layer boundaries are non-negotiable | `CD-13#layer-boundaries` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| CD-14 | Zero class authoring; classes only at external-library call sites | `CD-14#class-syntax`, `CD-14#static-only-class`, `CD-14#library-construction` (review) | TypeScript, not `.d.ts` | [function-first](../methods/lenses/function-first.md) |
| CD-15 | Iteration is functional transformation, never an imperative loop | `CD-15#loops` | `.ts`, `.tsx` | [function-first](../methods/lenses/function-first.md) |
| CD-16 | No counted for loops | see CD-15 | — | [function-first](../methods/lenses/function-first.md) |
| CD-17 | Clock is the only time source | `CD-17#clock-sources` | `.ts`, `.tsx` | [di-discipline](../methods/lenses/di-discipline.md), [test-discipline](../methods/lenses/test-discipline.md) |
| CD-18 | Process-lifecycle operations arrive through an injected port | `CD-18#process-lifecycle-ports` (review) | — | [di-discipline](../methods/lenses/di-discipline.md) |
| CD-19 | External dependencies confined to wrapping ports at the boundary | `CD-19#import-boundaries` | `.ts`, `.tsx` | [function-first](../methods/lenses/function-first.md) |
| CD-20 | Runtime stdlib imports arrive through injected ports | see CD-19 | — | [di-discipline](../methods/lenses/di-discipline.md) |
| CD-21 | Every injected port ships a default production factory | `CD-21#default-factories` (review) | — | [di-discipline](../methods/lenses/di-discipline.md) |
| CD-22 | Middleware generic context constraint | `CD-22#middleware-context` (review) | — | [di-discipline](../methods/lenses/di-discipline.md) |
| CD-23 | Every unit has a co-located test sibling | `CD-23#export-test-sibling` | production `.ts`, `.tsx` | [test-discipline](../methods/lenses/test-discipline.md) |
| CD-24 | Every file is unit-tested | see CD-23 | — | [test-discipline](../methods/lenses/test-discipline.md) |
| CD-25 | Unit tests replace everything outside the unit with test doubles | `CD-25#dependency-isolation` | `*.test.ts`, `*.test.tsx` | [di-discipline](../methods/lenses/di-discipline.md), [test-discipline](../methods/lenses/test-discipline.md) |
| CD-26 | No module-mocking — module-mock means DI is wrong | `CD-26#module-mocking` | `*.test.ts`, `*.test.tsx` | [di-discipline](../methods/lenses/di-discipline.md), [test-discipline](../methods/lenses/test-discipline.md) |
| CD-27 | Tests are zero-everything — zero logic, zero branches, zero unpredictability | `CD-27#test-body-logic`, `CD-27#focused-tests`, `CD-27#skipped-tests` | `*.test.ts`, `*.test.tsx` | [test-discipline](../methods/lenses/test-discipline.md) |
| CD-28 | Tests assert only what the unit is directly responsible for | `CD-28#unit-responsibility` (review) | — | [test-discipline](../methods/lenses/test-discipline.md) |
| CD-29 | Component/integration tests are the minimum, not the bulk | `CD-29#test-pyramid` (review) | — | [test-discipline](../methods/lenses/test-discipline.md) |
| CD-30 | Integration tests catch composition bugs only | `CD-30#composition-only` (review) | — | [test-discipline](../methods/lenses/test-discipline.md) |
| CD-31 | No coverage thresholds | `CD-31#no-coverage-thresholds` (review) | — | [test-discipline](../methods/lenses/test-discipline.md) |
| CD-32 | PII strings redact-by-default in structured logs | `CD-32#pii-redaction` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| CD-33 | Sensitive types brand-redact unconditionally | `CD-33#sensitive-brands` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| CD-34 | Secrets never enter the repo | `CD-34#no-repo-secrets` (review) | — | [clean-architecture](../methods/lenses/clean-architecture.md) |
| CD-39 | Cite principles by Roman numeral and rules by ID | `CD-39#cite-by-id` (review) | — | none |
| CD-40 | Single-object-argument functions | `CD-40#parameter-count`, `CD-40#named-object-argument` (review) | files the ESLint run includes | [function-first](../methods/lenses/function-first.md) |
| CD-41 | Orchestrators contain only orchestration | `CD-41#cognitive-complexity`, `CD-41#function-length`, `CD-41#orchestration-only` (review) | files the ESLint run includes | [decomposition](../methods/lenses/decomposition.md) |
| CD-42 | Unhappy paths are early returns; happy path is the final return | `CD-42#useless-else` | files the ESLint run includes | [decomposition](../methods/lenses/decomposition.md) |
| CD-43 | Booleans are evaluative, not declarative | `CD-43#boolean-signatures` | `.ts`, `.tsx` | [type-soundness](../methods/lenses/type-soundness.md) |
| CD-44 | Functions must not mutate fields of parameters they receive | `CD-44#parameter-mutation`, `CD-44#parameter-reassignment` | `.ts`, `.tsx` | [decomposition](../methods/lenses/decomposition.md) |
| CD-45 | Zod runs exactly once per external-boundary crossing | `CD-45#parse-once` (review) | — | [zod-boundary](../methods/lenses/zod-boundary.md) |
| CD-46 | Touching a carved-out file revokes its carve-out — leave it clean | applied to every file carve-out | — | none |
| CD-47 | Tests are hermetic — no real side effects on anything real | `CD-47#hermetic-git-spawns` | `*.test.{ts,tsx,mjs,js}`, `*.spec.{ts,mjs}` | [test-discipline](../methods/lenses/test-discipline.md) |
