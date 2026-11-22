# DI-discipline lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every rule whose `lenses` fact or `Review lens` line names `di-discipline`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection
procedure, and the output shape. It names no specific rule numbers, file paths,
type names, or library names; those live in the loaded rules and differ per
codebase.

## Concept

This lens defends **dependency injection through composition** on both faces of
the code: every technical binding a unit needs — wall-clock time, process and
signal lifecycle, standard-library capabilities (filesystem, crypto, path, net),
and third-party services — arrives through a named port the unit receives as a
constructor parameter or function argument, never reached for through a global,
an ambient import, or the module system. The port's interface is declared in
the domain, in a module of its own; one entry-point module builds every
adapter and passes each one in, and tests inject a test double of the same shape. The test face is the
mirror image: a unit test replaces *everything* outside the unit's boundary with a
test double, and it delivers those doubles the same way production delivers the
real ones — through the
unit's own signature — so the unit is byte-identical under test and under
production and never knows which it received. The moment a test reaches for the
module system to control a dependency (replace an import, overwrite a global,
monkey-patch a binding), the unit's DI is wrong: the dependency was not a port.

Test-double names follow the loaded rules' definitions, which use Meszaros's
taxonomy: a dummy is passed but never used, a stub returns canned answers, a spy
also records its calls, a mock verifies expectations set on it, and a fake is a
working lightweight implementation such as an in-memory repository. "Module
mock" is the test runner's name for module-system interception, not a mock in
that sense.

Across codebases the concept recurs under different names (constructor
injection, hexagonal ports-and-adapters, "no ambient singletons", "depend on
abstractions"). The loaded rules tell you this codebase's exact shape: which
capabilities are named ports, the single permitted site for each ambient
binding (the adapter), the default-adapter naming convention, any
type-level constraint on context-consuming middleware, and the closed list of
banned module-interception mechanisms. Read them first; they override any default
intuition.

## Loading the ruleset

1. Resolve the rules: the rule and principle items, `rules/rules/*.md` and `rules/principles/*.md`, in the Hone install (the folder holding `core/` and `rules/`), and the rule pages, `rules/*/README.md`, in each rule set the repository's `disciplines.json` names under `ruleSets`.
2. Keep the items whose `lenses` fact names `di-discipline`, and the rule-set pages whose `Review lens` line names it. **If no rule pages can be read at all, STOP and return CANNOT-REVIEW naming the rule-page paths you resolved** — an unloadable ruleset is never a codebase without discipline, and reviewing zero rules would emit a PASS that means nothing.
3. Read each kept page in full together with its check pages (for a Hone item, `rules/typescript/symptoms/<symptom>/<check>.md` of each symptom that may indicate it; for a rule set's page, its sibling `CHECKS.md` with its `## Exceptions` section) and any examples, and the repository's `discipline-exceptions.json` entries for that discipline: those recorded exceptions (authorised locations and carve-outs) are the closed exception list — anything outside them is a finding. Where a rule names the single permitted site for an ambient binding (a factory file, a port-module directory), that is the *only* permitted site; everywhere else the same call is a violation.
4. If no item or rule page names this lens, report that the codebase declares no DI discipline and produce an empty finding set — do not invent rules.

## Inspection procedure

This lens reads two faces and reports them separately: the **production side**
(are bindings ports, wired from defaults, threaded to the units that need them)
and the **test side** (are dependencies replaced by test doubles through the unit's own seam, or
reached for through the module system). Walk the diff for both.

### Production side

- **Ambient binding outside its permitted site.** For each capability the rules
  confine to a single factory (time construction, process/signal lifecycle, each
  standard-library module), find every direct call to the raw global or stdlib
  symbol. A hit inside the named factory module is the abstraction boundary —
  pass. A hit anywhere else is a violation: the unit must instead receive a port
  and call it. The raw symbols to grep are codebase knowledge — derive them from
  the rules' literal text (the rule pages name them) and from the imports in
  the diff, not a fixed list.
- **Consumer-signature gap.** A function or factory that *produces* a value from
  an ambient capability (a timestamp, a unique id, a path join, a signal
  handler) but does NOT take the corresponding port as a parameter is a
  violation-in-waiting even if it currently delegates to a helper that itself
  holds the raw call. The composition pathway must terminate at an injected port,
  not at a buried global.
- **Adapter built outside the root.** One entry-point module builds every
  adapter and passes each one in. A call to an adapter's factory anywhere but
  the entry point is a finding: the calling unit builds what it should be
  passed. No port is declared in an adapter's module or in its consumer's.
- **Composition-root threading.** The boot path (the service-run entrypoint, the
  app start module, the kernel composition) must build each adapter and
  pass the port into the unit that declared it. A unit that *declares* a port
  parameter but is never wired to one in the boot path is a threading violation;
  a unit outside the boot path that builds an adapter itself is
  the same gap from the other end.
- **Type-level context constraint.** Where the rules require context-consuming
  middleware (or any generic that reads kernel-shipped context fields) to bind
  its context type to the base-context constraint, an unbounded generic that
  nonetheless reads those fields is a violation. The fix is the constraint, never
  a runtime guard or an optional/fallback option — the constraint is what makes
  pipeline composition provably correct at compile time. When such middleware
  also carries a raw-global fallback for the field it should read from context,
  that fallback is a separate ambient-binding finding on the same line.

### Test side

- **Module-system interception.** Every substitution mechanism that reaches the
  module system rather than the unit's signature is a finding the instant it
  appears — no further analysis of test outcome, library lineage, or local
  ergonomics is needed. This covers module mocks, deferred module mocks, hoisted
  mock infrastructure, global stubs (and their cleanup), the jest-API
  equivalents, direct property assignment or property-descriptor patching on an
  imported binding, proxy wrappers around a real module, HTTP-interception
  libraries standing in for an injected client, and older rewire-style loaders.
  The remediation is always identical: lift the replaced dependency into the unit's
  signature as a port, supply the production default at the composition root, and
  inject a test double directly in the test.
- **The spy edge case — discriminate by attachment target.** A spy is the one
  mechanism that requires per-call classification. A spy attached to a method on
  a test double the test itself constructed and passed through the unit's seam is
  *observation* — permitted; it reads interaction without replacing anything. A
  spy attached to a method on an imported module (replacing or even merely
  observing its real behaviour) is *module-system reach* — the same shape as a
  module mock, a violation. The discriminator is solely **what object the spy is
  attached to**: a DI-delivered test double (permitted) or an imported binding
  (violation).
- **Test doubles through the seam are not module interception.** A test that
  constructs a stub or spy as an object literal, a factory-built stub, or a
  recording spy function, and delivers it through the unit's constructor or
  argument, is the exact pattern the discipline channels toward — not a finding. In common speech "mock" covers both a double
  passed through the seam and module interception. In the taxonomy a mock is only
  a double that verifies expectations set on it, and module interception is not a
  double at all: the rules permit doubles through the seam and forbid
  interception. The affordance is the port's type; no library wraps it.
- **Boundary gap that forces module interception.** If a dependency the test
  needs to control is *not in the unit's signature*, that is a structural finding
  even before any interception appears: the unit needs a port added before
  DI-clean testing is possible. A test-only subclass overriding a method, or a
  test-only env/flag the unit reads to choose double-vs-real, are both this gap
  surfacing — the double should
  arrive through the seam, and (for the env/flag case) the unit must not know it
  is under test.

For each candidate on either side, decide finding vs non-finding strictly
against the loaded rules and their carve-outs — never against this file's prose
or a remembered version of some other codebase's rule. When a mechanism appears
that the rules' enumeration does not cover, surface it explicitly rather than
deciding it silently — extending the closed list is an amendment surface, not an
agent-time call.

## Letter-vs-intent

The lens's catch-rate lives where the code reads injected but a dependency still
arrives ambiently. A unit whose signature declares a port yet whose body holds a
raw global call on a "convenience" path; an adapter present but the boot
path constructing the port inline beside it; a middleware generic that compiles
because its context happens to carry the field, yet is unbound so a different
pipeline would crash; a spy that looks like clean observation but is attached to
an imported module; a stub that is actually wired through module
interception rather than the seam. A finding here must explain *how the code reads
DI-clean yet the dependency is still reached for ambiently*, grounded in the
specific loaded rule. Vague phrasings ("tight coupling", "hard to test") are the
lens's own failure mode.

## Output shape

Report **two-sided** counts the review asks for: a production-side
block (ambient-binding violations by capability, adapters built outside the root,
threading gaps, unbound context generics) and a test-side block
(module-interception violations by mechanism, spy classifications, structural
boundary gaps). Every finding is
`file:line | quoted code | <rule-id> | defect-named`, citing the loaded rule by
its name and the clause address [Every numbered discipline](../../rules/numbers.md#every-numbered-discipline) gives it (for example `CD-9#result-failures`, a review clause of [Failures are values](../../rules/rules/failures-are-values.md)), and — for a test-side mock — naming the port
shape the remediating refactor would lift into the unit's signature. State the
rule-page paths you resolved and which rule ids you loaded under this lens.
