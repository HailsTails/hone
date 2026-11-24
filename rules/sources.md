# Sources

Each row names one source, the claim it makes, and how the item relates to it.

Relations:
- **SAME**: the source says what the item says.
- **STRICTER**: the item demands more than the source, and the row says where.
- **NARROWER**: the item covers less ground than the source.
- **WIDER**: the item covers more ground than the source.
- **CONFLICTS**: the source teaches the opposite.
- **NO SOURCE**: the item is ours, with no industry source behind it.

A CONFLICTS source sits beside an item's main source, never in place of it. Stricter rows are intended: "my rules are stricter than most because leaving any trade off or judgement based calls to llm leads to the easiest option locally".

## Principles

| Item | Source and its claim | Relation |
|---|---|---|
| [Tests are ours](principles.md#tests-are-ours) | Freeman, Pryce, Mackinnon, Walnes, "Mock Roles, not Objects", OOPSLA 2004, §4.1: do not mock types you do not own; wrap them thinly. [jmock.org/oopsla2004.pdf](http://www.jmock.org/oopsla2004.pdf) | SAME |
| [One place decides](principles.md#one-place-decides) | Parnas, "On the Criteria…", CACM 15(12), 1972: each module hides one design decision likely to change. Martin, [SRP (2014)](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html): "Gather together the things that change for the same reasons." | SAME |
| [No hidden effects](principles.md#no-hidden-effects) | Bernhardt, [Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell); Seemann, [Impureim sandwich (2020)](https://blog.ploeh.dk/2020/03/02/impureim-sandwich/): pure decisions sit between effects that are kept apart. | SAME |
| [External behaviour sits at a boundary](principles.md#external-behaviour-sits-at-a-boundary) | Cockburn, [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/): the application talks to the outside only through ports, with an adapter per outside party. Martin, [The Clean Architecture (2012)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html): source dependencies point only inwards. | SAME |
| [No leak across a boundary](principles.md#no-leak-across-a-boundary) | Evans, [Getting Started with DDD When Surrounded by Legacy Systems (2013)](https://domainlanguage.com/wp-content/uploads/2016/04/GettingStartedWithDDDWhenSurroundedByLegacySystemsV1.pdf): an anticorruption layer's interface is "entirely in terms of the downstream model". | STRICTER: Evans speaks of data coming in; ours also covers failures, in both directions |
| [The type checker proves it](principles.md#the-type-checker-proves-it) | Minsky, [Effective ML Revisited](https://blog.janestreet.com/effective-ml-revisited/): make illegal states unrepresentable. King, [Parse, don't validate (2019)](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/). | SAME |
| [Our code reads in the common language](principles.md#our-code-reads-in-the-common-language) | Fowler, [UbiquitousLanguage](https://martinfowler.com/bliki/UbiquitousLanguage.html), after Evans: one shared vocabulary used by developers, domain experts and the code. | WIDER: Evans keeps one language per bounded context ([BoundedContext](https://martinfowler.com/bliki/BoundedContext.html)); ours holds across the whole codebase |
| [Outside risk is carried on purpose](principles.md#outside-risk-is-carried-on-purpose) | [Twelve-Factor II, Dependencies](https://12factor.net/dependencies): declare and isolate every dependency. [OpenSSF Scorecard, Pinned-Dependencies](https://github.com/ossf/scorecard/blob/main/docs/checks.md). [NTIA SBOM minimum elements (2021)](https://www.ntia.gov/report/2021/minimum-elements-software-bill-materials-sbom). | SAME, made from three sources |

## Rules

| Item | Source and its claim | Relation |
|---|---|---|
| [Written-out answers](rules.md#written-out-answers) | Meszaros, *xUnit Test Patterns* (2007), [Literal Value](http://xunitpatterns.com/Literal%20Value.html): "Use literal constants for object attributes and assertions." | SAME (conflict: Khorikov, below) |
| [Straight-through tests](rules.md#straight-through-tests) | Meszaros, [Conditional Test Logic](http://xunitpatterns.com/Conditional%20Test%20Logic.html): branches and loops in a test are a smell. | SAME (conflict: Meszaros's Test Utility Method, below) |
| [Tested where it's owned](rules.md#tested-where-its-owned) | Fowler, [IntegrationTest](https://martinfowler.com/bliki/IntegrationTest.html): a narrow integration test exercises only our code that talks to a separate service. GOOS 2004 §4.5: do not use mocks to test boundary objects. | SAME |
| [Doer or orchestrator](rules.md#doer-or-orchestrator) | Westphal, [Radical Object-Orientation #06](https://radicalobjectorientation.substack.com/p/radical-object-orientation-06-intelligent): "operation and integration must be strictly separated" (the IOSP). | SAME (conflict: Ousterhout, below) |
| [Handed what it uses](rules.md#handed-what-it-uses) | Fowler, [Inversion of Control Containers and the DI pattern (2004)](https://martinfowler.com/articles/injection.html); Martin, DIP, *C++ Report* 1996: both sides depend on abstractions. | SAME |
| [Guard first](rules.md#guard-first) | Fowler, [Replace Nested Conditional with Guard Clauses](https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html). | STRICTER: a refactoring you may choose becomes a requirement |
| [One reason per module](rules.md#one-reason-per-module) | Martin, [SRP (2014)](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html): one reason to change, and "This principle is about people." | SAME |
| [Outside dependencies stay at boundaries](rules.md#outside-dependencies-stay-at-boundaries) | GOOS 2004 §4.1: do not mock runtime or library types; "write thin wrappers". Cockburn: an adapter per outside party. | STRICTER: every outside dependency is wrapped, not only those a test would mock |
| [Ports declared inside](rules.md#ports-declared-inside) | Martin, DIP 1996: "Abstractions should not depend upon details." Martin 2012: the use case calls an interface "in the inner circle". | SAME |
| [Failures are values](rules.md#failures-are-values) | Wlaschin, [Against Railway-Oriented Programming](https://fsharpforfunandprofit.com/posts/against-railway-oriented-programming/): expected domain failures are values. | SAME (conflict: Clean Code, below) |
| [Declared, not asserted](rules.md#declared-not-asserted) | King 2019: parse into a type that proves the check, instead of validating and discarding. | SAME |
| [Kinds are named](rules.md#kinds-are-named) | Minsky: variants named in the type; Wlaschin, [single-case unions](https://fsharpforfunandprofit.com/posts/designing-with-types-single-case-dus/). | SAME (conflict: OCP and Replace Conditional with Polymorphism, below) |
| [One word everywhere](rules.md#one-word-everywhere) | Fowler, UbiquitousLanguage (Evans). | STRICTER: one word across the codebase, not per bounded context |
| [Outside dependencies justified](rules.md#outside-dependencies-justified) | Nearest parallel: Nygard, [Documenting Architecture Decisions (2011)](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions). No source requires a written reason for each dependency. | NO SOURCE |
| [Fixed versions](rules.md#fixed-versions) | OpenSSF Scorecard, Pinned-Dependencies: "explicitly set to a specific hash instead of allowing a mutable version or range". | SAME (Scorecard goes further, to hashes) |
| [Tools live in the repo](rules.md#tools-live-in-the-repo) | Twelve-Factor II: "never relies on implicit existence of system-wide packages"; vendor any needed tools. | SAME |
| [Upstream stays untouched](rules.md#upstream-stays-untouched) | Martin, [OCP (2014)](https://blog.cleancoder.com/uncle-bob/2014/05/12/TheOpenClosedPrinciple.html): open for extension, closed for modification. | NARROWER: OCP covers all modules; this rule covers outside code |
| [Shipped risk declared](rules.md#shipped-risk-declared) (proposed) | NTIA SBOM: "a formal record containing the details and supply chain relationships of various components". | SAME |

## Recipes

| Item | Source and its claim | Relation |
|---|---|---|
| [Stub with vi.fn](typescript/recipes.md#stub-with-vi-fn) | Meszaros, [Test Stub](http://xunitpatterns.com/Test%20Stub.html). Martin, [The Little Mocker (2014)](https://blog.cleancoder.com/uncle-bob/2014/05/14/TheLittleMocker.html). GOOS §4.6: "Mock objects are still stubs"; adding behaviour signals misplaced responsibility. | SAME |
| [Ports in the argument](typescript/recipes.md#ports-in-the-argument) | Fowler 2004, DI article (constructor injection); Seemann, [Pure DI (2014)](https://blog.ploeh.dk/2014/06/10/pure-di/). | NARROWER: one of Fowler's three injection forms |
| [it.each over typed rows](typescript/recipes.md#it-each-over-typed-rows) | Meszaros, [Parameterized Test](http://xunitpatterns.com/Parameterized%20Test.html). | STRICTER: rows typed and hard-coded |
| [Assert to narrow](typescript/recipes.md#assert-to-narrow) | Meszaros, [Guard Assertion](http://xunitpatterns.com/Guard%20Assertion.html): "Replace an if statement in a test with an assertion…" | SAME |
| [Whole written-out expectation](typescript/recipes.md#whole-written-out-expectation) | Meszaros, Literal Value. | SAME |
| [Failure asserted as a value](typescript/recipes.md#failure-asserted-as-a-value) | Follows from Failures are values. No test-pattern name found. | NO SOURCE |
| [Companion test file](typescript/recipes.md#companion-test-file) | Go [`testing`](https://pkg.go.dev/testing): test files are named with `_test.go` beside the package. | SAME (parallel) |
| [Integration test suffix](typescript/recipes.md#integration-test-suffix) | Maven Failsafe [default includes](https://maven.apache.org/surefire/maven-failsafe-plugin/examples/inclusion-exclusion.html): `**/*IT.java`, `**/IT*.java`, `**/*ITCase.java`. | SAME (parallel) |
| [Integration test owns its scratch](typescript/recipes.md#integration-test-owns-its-scratch) | Meszaros, [Fresh Fixture](http://xunitpatterns.com/Fresh%20Fixture.html): avoids Erratic Test. | SAME |
| [Composed orchestrator](typescript/recipes.md#composed-orchestrator) | Westphal IOSP: an integration only calls other functions. | SAME |
| [Functional iteration](typescript/recipes.md#functional-iteration) | Fowler, [Collection Pipeline](https://martinfowler.com/articles/collection-pipeline/); [Replace Loop with Pipeline](https://refactoring.com/catalog/replaceLoopWithPipeline.html). | SAME |
| [One argument object](typescript/recipes.md#one-argument-object) | Fowler, [Introduce Parameter Object](https://refactoring.com/catalog/introduceParameterObject.html). | STRICTER: always one object; "for agents the goal is always 1" |
| [Narrow ports](typescript/recipes.md#narrow-ports) | Fowler, [RoleInterface](https://martinfowler.com/bliki/RoleInterface.html): defined by one interaction between supplier and consumer. | SAME |
| [Entity module](typescript/recipes.md#entity-module) | Fowler, [EvansClassification](https://martinfowler.com/bliki/EvansClassification.html): an entity has "a distinct identity that runs through time". | NARROWER: one module per entity is a placement Evans does not prescribe |
| [Guard clauses](typescript/recipes.md#guard-clauses) | Fowler, Replace Nested Conditional with Guard Clauses. | SAME |
| [Screaming folders](typescript/recipes.md#screaming-folders) | Martin, [Screaming Architecture (2011)](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html): the top-level structure names the use cases, not the framework. | SAME |
| [Copy, never write in](typescript/recipes.md#copy-never-write-in) | Fowler, [ValueObject](https://martinfowler.com/bliki/ValueObject.html): value objects should be immutable. | SAME |
| [Closure factory](typescript/recipes.md#closure-factory) | Crockford, [Private Members in JavaScript](https://www.crockford.com/javascript/private.html): privileged methods over closure state. | SAME (conflict: Evans's mutable entities) |
| [Adapter per outside party](typescript/recipes.md#adapter-per-outside-party) | Cockburn, Hexagonal Architecture. | SAME |
| [Port in a module of its own](typescript/recipes.md#port-in-a-module-of-its-own) | Martin DIP 1996; Martin 2012: the output port sits in the inner circle, implemented outside. Evans 2013: ACL-backed repository. | SAME on ownership |
| [World values through a port](typescript/recipes.md#world-values-through-a-port) | Seemann, [Volatile Dependencies](https://learn.microsoft.com/en-us/archive/blogs/ploeh/volatile-dependencies): time and randomness are volatile and go behind an abstraction. | STRICTER: Seemann exempts stable dependencies; ours does not |
| [Composition root](typescript/recipes.md#composition-root) | Seemann, [Composition Root (2011)](https://blog.ploeh.dk/2011/07/28/CompositionRoot/). | SAME |
| [Zod at the producer's adapter](typescript/recipes.md#zod-at-the-producers-adapter) | King 2019; Evans 2013: "ideally the translator should just translate". | SAME |
| [Map out at the adapter](typescript/recipes.md#map-out-at-the-adapter) | Evans 2013, ACL. | SAME |
| [Failure mapping at the adapter](typescript/recipes.md#failure-mapping-at-the-adapter) | Evans 2013, ACL. | STRICTER: the ACL is applied to failures too |
| [Result union](typescript/recipes.md#result-union) | Wlaschin, Against ROP. | SAME |
| [Named, exported type](typescript/recipes.md#named-exported-type) | No source found. | NO SOURCE |
| [Fix the declaration, not the value](typescript/recipes.md#fix-the-declaration-not-the-value) | No source found; nearest is King 2019. | NO SOURCE |
| [Constrained context generic](typescript/recipes.md#constrained-context-generic) | No source found. | NO SOURCE |
| [Shared strict base config](typescript/recipes.md#shared-strict-base-config) | No source found; a tool feature, not a named practice. | NO SOURCE |
| [Tagged union and exhaustive switch](typescript/recipes.md#tagged-union-and-exhaustive-switch) | TypeScript Handbook, [Narrowing: exhaustiveness checking](https://www.typescriptlang.org/docs/handbook/2/narrowing.html): a `default` branch assigns to `never`. | STRICTER: this recipe has no `default` branch |
| [Domain vocabulary list](typescript/recipes.md#domain-vocabulary-list) | Fowler, UbiquitousLanguage. | SAME |
| [Whole words](typescript/recipes.md#whole-words) | Google, [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html): names "must be descriptive and clear to a new reader". | STRICTER: Google allows short names in scopes of 10 lines or fewer |
| [Meaning in names, not comments](typescript/recipes.md#meaning-in-names-not-comments) | Martin, *Clean Code* 2nd ed. (2025) contents: ch. 5 Comments keeps a "Good Comments" section. | STRICTER than Martin (conflict: Ousterhout, below) |
| [Dependency record](typescript/recipes.md#dependency-record) | Nygard 2011, ADR. | SAME |
| [Exact pins and a lock file](typescript/recipes.md#exact-pins-and-a-lock-file) | OpenSSF Scorecard, Pinned-Dependencies. | SAME |
| [Repo scripts only](typescript/recipes.md#repo-scripts-only) | Twelve-Factor II. | SAME |
| [Extension outside the vendored code](typescript/recipes.md#extension-outside-the-vendored-code) | Martin, OCP 2014. | SAME |
| [Declared, not bundled](typescript/recipes.md#declared-not-bundled) (proposed) | Twelve-Factor II: declare dependencies explicitly. | SAME |

## Record kinds

| Item | Source and its claim | Relation |
|---|---|---|
| [Authorised location](records.md#authorised-location) | Microsoft, [SuppressMessageAttribute.Justification](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.codeanalysis.suppressmessageattribute.justification): "the justification for suppressing the code analysis message". | SAME |
| [Deviation](records.md#deviation) | EASA, [FAQ 19026](https://www.easa.europa.eu/en/faq/19026): an alternative means of compliance must show it meets "the intent of the IR". | STRICTER: a deviation must show the recipe's reason fails at this site; meeting the rule another way is not enough |
| [Debt](records.md#debt) | ESLint, [bulk suppressions](https://eslint.org/docs/latest/use/suppressions): existing violations "will not be reported", new ones are. Martin, [The Boy Scout Rule](https://github.com/97-things/97-things-every-programmer-should-know/blob/master/en/thing_08/README.md): leave it "a little bit better". | STRICTER: touching the file forfeits the whole file's debt |
| [Boundary record](records.md#boundary-record) | Evans 2013: an ACL presents a clean interface in the downstream model; the ACL-backed repository. | SAME |
| [Dependency record](records.md#dependency-record) | Nygard 2011; NTIA SBOM. | SAME |

## The model

| Item | Source and its claim | Relation |
|---|---|---|
| Rule with its reasoning and its check | [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines): each rule has reason, example, alternative, exception and enforcement; "programmers find it hard to follow rules they don't understand". | STRICTER: our rules carry no exception clause; departures are records |
| Recipe as acceptable means of compliance | EASA [AMC FAQ](https://www.easa.europa.eu/en/faq/19026): AMC are non-binding, one way to comply. | STRICTER: the burden falls on the deviation to show the recipe's reason no longer holds |
| Symptom | Fowler, [CodeSmell](https://martinfowler.com/bliki/CodeSmell.html): "a surface indication that usually corresponds to a deeper problem". | SAME |
| Check | Thoughtworks Radar, [Architectural fitness function](https://www.thoughtworks.com/radar/techniques/architectural-fitness-function): "provides an objective integrity assessment of some architectural characteristics". | SAME |
| Case | Fowler, [Writing Software Patterns](https://martinfowler.com/articles/writingPatterns.html): the Coplien form has "Problem, Context, Forces, and Solution". | SAME |
| Record | Nygard 2011, ADR. | SAME |
| Cross-language rules with a language layer | [SEI CERT coding standards](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/front-matter/introduction/how-this-coding-standard-is-organized): per-language standards, each with noncompliant and compliant examples. | SAME (parallel) |
| Two addresses per finding | No source found. | NO SOURCE |
| The chain: symptom, case, why, reason to change | No source found. Pieces only: smell to deeper problem (Fowler); problem and context (pattern form). | NO SOURCE |

## Conflicts stated openly

| Topic | Item | The source's teaching | Our position |
|---|---|---|---|
| Classical against mockist testing | [Written-out answers](rules.md#written-out-answers) | Khorikov, [When to mock](https://enterprisecraftsmanship.com/posts/when-to-mock/): "Only unmanaged dependencies should be replaced with mocks"; use real collaborators inside. | "Stubbing most critical aspect is pure unit tests. Following the principle of failure is as fragile as the unit alone." |
| Small functions | [Doer or orchestrator](rules.md#doer-or-orchestrator) | Ousterhout, [APOSD vs Clean Code](https://github.com/johnousterhout/aposd-vs-clean-code): splitting "makes the code harder to understand". | "Functions with no outside influence should take 1… for agents the goal is always 1." |
| Comments | [Meaning in names, not comments](typescript/recipes.md#meaning-in-names-not-comments) | Ousterhout (same debate): comments "add enormous value". Martin: "I'm not hostile to comments in general." | "Good comments in my opinion or an escape hatch for poor choices almost always. And in AI world a default mess." |
| Exceptions | [Failures are values](rules.md#failures-are-values) | *Clean Code* 2nd ed. ch. 8: "Prefer Exceptions to Returning Error Codes". | "It potentially a js quirk more than a complete rule. As throwing is a mess of classes and type obscuring and control flow strangeness." |
| Polymorphism over switch | [Kinds are named](rules.md#kinds-are-named) | Fowler, Replace Conditional with Polymorphism; Martin, OCP. | "polymorphism implies object oriented. Without it and with js you get piles of shotgun validation and nested complexity." |
| Test helpers | [Straight-through tests](rules.md#straight-through-tests) | Meszaros, [Test Utility Method](http://xunitpatterns.com/Test%20Utility%20Method.html): reduces test duplication. | "test "helpers" are a problem overall as a concept" |

## Unexplored concepts

None of these is closed off.

- **Aggregates** ([Fowler](https://martinfowler.com/bliki/DDD_Aggregate.html)): would extend One reason per module and Entity module, adding a consistency boundary.
- **Bounded contexts and context maps**: would extend No leak across a boundary and One word everywhere, scoping the language per context.
- **Open-Closed**: would extend Upstream stays untouched to our own modules.
- **Liskov substitution**: would extend Ports declared inside, so any adapter honours the port's contract.
- **Tell, Don't Ask** ([Fowler](https://martinfowler.com/bliki/TellDontAsk.html)): would extend Doer or orchestrator.
- **Walking skeleton** (GOOS): would extend Tests are ours, with an end-to-end slice first.
- **Humble Object** ([Meszaros](http://xunitpatterns.com/Humble%20Object.html)): would extend Tested where it's owned, keeping the untestable shell thin.
- **Domain events**: would extend No hidden effects, making a change an explicit value.
