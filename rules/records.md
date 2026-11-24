# Records

A record is how a person, or the tool for legacy debt, answers a symptom at a place. "That's why checks have authorised locations and disables. They are imperfect and allow for the correct usage of each thing that is by default a symptom of not thinking it through." A record is more work than the fix.

Today's record formats are listed [beside the kinds](#todays-formats-and-the-kinds).

## The kinds

Four kinds cover everything. They are the model Hone's records take on with 2.0, which is not released yet: Deviation and Dependency record have no format today, and the others are written today in the formats [beside the kinds](#todays-formats-and-the-kinds), which say what each still lacks.

### Authorised location

- **Answers:** A symptom whose correct use a case makes right at one place. Each symptom's correct uses are on [the symptoms page](typescript/symptoms.md).
- **States:** The symptom and check; the site; for Outside import past a boundary, the outside party; the case that makes it correct here and the rule or principle that case owes; a why-chain whose root, if it changed, would remove the need; an owner. It is refused on a symptom with no authorised-location correct use. Otherwise what it lacks is [noted](#what-is-noted-never-refused), and a note changes no verdict. A why that only restates the symptom is [refused](#what-is-refused).
- **Scope:** One symptom at one site: a file, or a span within it.
- **Stale or paid when:** Stale when the symptom is no longer at the site. A vendored edit is also re-tested when the vendored version moves. A person removes it.
- **Industry name:** suppression with justification, as .NET's `SuppressMessage` justification does.

### Deviation

- **Answers:** A method other than a recipe, where the rule still holds: a fake in place of Stub with vi.fn, or any other recipe.
- **Must state:** The recipe by name; the reason it was chosen, as its recipe states it; why that reason does not hold at this site, with evidence; how the rule still holds.
- **Scope:** One recipe at one site.
- **Stale or paid when:** Stale when the symptom is gone. Review owes "the reason holds again".
- **Industry name:** a deviation record: aviation's alternative means of compliance, held to a stricter proof.

### Debt

- **Answers:** Any symptom at a site, a known breach not yet paid.
- **Must state:** The symptom and the site. Nothing more: "All debt is debt. Reason doesn't matter."
- **Scope:** One symptom in one file.
- **Stale or paid when:** Forfeited once the file is touched, so the change pays it. Moving a file without changing its content does not touch it. Stale when the symptom is gone. Removed by the tool when the file is gone, or when its check measured the file and found the debt paid.
- **Industry name:** a baseline with a ratchet. Record-debt is the baseline, and forfeit-on-touch is the ratchet. A lint baseline, as in ESLint bulk suppressions, that ratchets down.

### Dependency record

- **Answers:** Outside dependencies justified, and Dependency without a record.
- **Must state:** The outside dependency; the native way weighed; why it fell short. For a peer dependency, the risk to whoever runs it.
- **Scope:** One direct outside dependency.
- **Stale or paid when:** Stale when the dependency is removed.
- **Industry name:** an architecture decision record (Nygard). An architecture decision record for each dependency.

### Who may create each one without a person

Only the tool, and only debt, for findings the base revision already held ("record-debt", today). Every other kind is written by a person or an agent, and does the reasoning itself.

### Merged into the kinds, or not a kind

- **Site-level record for one symptom:** merged. Every kind names a symptom, not a whole clause, so a record can say "this symptom, here".
- **Conformist:** a Conformist statement is the root of an authorised location's why-chain.
- **Drift record:** merged into Authorised location, on the symptom Edit inside vendored code. Its case: "justified as additional drift as impossible to apply as an extension instead". It states when it should be dropped.
- **Inline suppression:** not a kind. It is where a record shows at the site. An inline disable or a tool directive is held only by a record of its symptom at that site.
- **Tracked pointer:** not a record. It is an allowed annotation.
- **Safety opt-in:** outside the cases. It is not in this model.
- **Clause-wide carve-out:** not a record. A rule a codebase does not want everywhere is not adopted: "Yes opting out means this codebase is not beholden to the rule flat out. Which is any tech leads choice to make for a codebase."

## What is not a record

- **Scope.** "Exclude is any codebases choice to say this is not in scope. It's never bound by any rules."
- **Adopter config:** layer folders, casing, test-file naming and folder-scoped conventions. Hone does not read these as config yet. "A simple manifest of top level folders is config. Not hand kept manifest." A folder setting never switches a rule off.
- **A threshold.** "Line and complexity are symptoms that flag many things." Where a symptom fires is a check setting.
- **A named ban.** "Lodash is banned. Personal rule." No record makes it correct. Existing use is still held as debt, like any symptom: "All rules have to allow the checks to be debt. As existing repos need the opportunity to adopt and improve. Debt is debt. Not blockers."
- **A tracked pointer.** A TODO is tracked when it holds a reference to an issue or spec, in the form the adopter's config declares for its tracker (`#42`, `owner/repo#42`, `PROJ-7`), and nothing else. It is a pointer, not an explanation. A TODO beside a breach does not hold the breach: the breach still needs a record of its own.

## What is refused

An authorised location is refused on a symptom with no authorised-location correct use; otherwise what it lacks is [noted](#what-is-noted-never-refused). Its why-chain must still be a reason. A record file that cannot be read at all is refused, whatever it holds. Every other record must contain what its kind states. Anything less is refused, as follows.

| Refused | Why | Does Hone refuse it from the form today? |
|---|---|---|
| An authorised location whose why only restates the symptom ("needed here", "the check flags this") | The why-chain's purpose: "to ensure an agent has thought deeply about what its doing". | Yes, as today: the why-chain checks refuse stock restatements and answers with no new cause, the record is listed under invalid records and the run fails. A reworded restatement is left to review. |
| A deviation that only shows another method works | "The proof of burden is on the deviation to show that the reason it was chosen no longer holds." | Not yet enforced. In the model the form must name the recipe and use its reason's words; whether the reason fails here is left to review. |
| A fake with no showing that a stub cannot do the test | "Moving a fake is only allowed if the test cannot be done with deterministic stubs or hardcoded things." | No; review. |
| A deviation or a dependency record that makes a named ban correct. Debt is not refused. | "Lodash is banned." and "Debt is debt. Not blockers." | Not yet enforced. |
| Debt written by the tool for a file the base did not hold | today's `new-file` | Yes, as today. |
| A record standing in for a design fix, where friction points at the design | "if we have such a complex test that needs exemption we have a code architecture problem" | No; review. A machine can show records clustering on one symptom or one cause. Only review rules on it. |
| An option that weakens the whole run (`--rule`, `-c`) | today | Yes, as today: it cannot be recorded. |
| An authorised location on a symptom with no authorised-location correct use | No correct use, so nothing to authorise. | Yes, by `hone authorise` and the reader. One carried from version 1 is kept. |

This is a list of what each record must contain. It is not a ladder of exceptions.

## What is noted, never refused

An authorised location answers a check that is wrong at that place, so the form accepts it for any symptom with an authorised-location correct use: "while authorised location in spirit isn't supposed to be allowed. It's mechanically always allowed as our checks for symptoms is never assumed perfect." In the model, what it lacks is a note beside it. A note changes no verdict; review rules on it.

- **A case that is missing, or not in the [case list](cases.md).** A thought-through use names its case. Whether the case is true is left to review. Today's tool does not read a case name.
## The cost side

**What holds today:**
- An authorised location costs a five-step why-chain with a root check and an owner, or only its reason while `fileExceptionWhyChains` is `"optional"`.
- Debt is visible in every report, fails the run when it forfeits on touch, and fails when stale.
- An unrecorded inline disable fails the run.
- The diff of the records is the review.
- Hotfixes do not block on debt: forfeiture can be assessed elsewhere ("blocking a hot fix on debt is not suitable practice").

**What the model adds:**
- A thought-through record names its case and the rule owed. It no longer answers only "why this file".
- A deviation must engage the recipe's own reason.
- Records are per symptom, so a record cannot quietly hold a new form of a clause, and paying one symptom is visible.
- Records are counted per symptom and cause. That makes friction measurable ("Always look for what friction is trying to tell us"), without a new step.

**What an agent gets when it cannot fix:** two honest exits, debt (visible, and it forfeits) or a thought-through record (it costs the reasoning). Neither is "give up and ask": "telling agents to give up and ask me has in experience made them just never even try and increased my workload".

## Which kind answers which method

Which kind answers each symptom is on [the symptoms page](typescript/symptoms.md), as that symptom's correct uses.

| Method | Kind |
|---|---|
| A fake | Deviation from Stub with vi.fn |
| A fresh scratch in an integration test | Not a record: it is the recipe |
| A real file, subprocess or temp directory in a unit test | Debt. It breaks Tested where it's owned, which is a rule, not a recipe. |
| A stream drain | Authorised location |
| A throw at the edge | Authorised location |
| Any other method in place of a recipe | Deviation |

## Today's formats and the kinds

Records today are written in these formats. Each answers one of the kinds.

| Today | Kind | What differs from the kind |
|---|---|---|
| `authorised-location` (clause, file, reason, whyChain) | Authorised location, one per outside party for Outside import past a boundary | Names a clause, not a symptom. The site is a file. It does not name the case, the rule owed or the outside party. |
| `file-carve-out` (clause, file, optional reason) | Debt | Names a clause, not a symptom. One record on the test-logic clause covers up to four symptoms. |
| `clause-wide-carve-out` | Not a record: the clause is not adopted | Today it is a record that keeps the clause running, with its why-chain; with 2.0 it becomes the check marked not adopted. |
| `provenance` (imported) | The same kind, imported | Nothing. |
| Legacy why-chains | The kind of the record that holds them | Accepted while unchanged against the base. |
| Inline disables and `@ts-*` directives | Held by a record of their symptom | The record names the clause, not the symptom. |
| — | Deviation, Dependency record | No format yet. |
