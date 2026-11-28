# The spirit of the rules

## What the friction is for

Every rule here is deliberate friction. None of it is arbitrary. Each rule makes the path of least resistance the good one, so the easy outcome and the good outcome are the same outcome. Each rule also holds the present self to account for the future self who inherits the code.

The friction is absolute on purpose. An escape inside a rule is a hole, and a hole justifies not thinking the design through. One permitted escape becomes the reason for the next.

A finding is rarely about the line it names. It is a signal about the design around that line: a boundary that is missing, an earlier choice that forces the workaround, a port wider than its callers need. Listen to what the friction is telling you. The real problem is almost never the checker.

## When the check is red

Take this chain, in order.

1. **Measure.** Count the sites for the failing check. Group them by folder, by the value or dependency involved, and by who wrote them when.
2. **Ask what each group points at.** Read the symptom's "May indicate" and "Breach usually sits" lines on [the symptoms page](typescript/symptoms.md) and match each group against them. Most groups share one cause.
3. **Then decide.** Name the cause, where it lives, the forward goal, and the first step that unlocks it. Fix the cause and the sites go with it.

Exclusions and settings are not the first move. Reaching for one before step 2 hides the signal before anyone has read it. A count that looks like noise is usually one missing boundary seen from many places.

## Debt, not noise

On first adoption of an existing codebase, a high count is debt made visible. It is not evidence the rule is wrong for the codebase. Write an [assessment](../ADOPTING.md#5a-write-the-assessment) for each check with a high count. It names the cause, where it applies, the goal and the steps toward it. Debt records hold those findings while the steps are taken. Touching the file [forfeits the debt](records.md#debt).

## Boundaries are where exceptions belong

Some code has to touch the outside: a library, the runtime, raw input. Those places are boundaries. A clean boundary is the cheap, authorised place for what the rules forbid elsewhere: one file, recorded once, small enough to read whole. The rest of the code then needs no escape. If an exception keeps wanting to spread, the boundary is in the wrong place or does not exist yet.

## Not adopted, not run, held as debt, escaped

When a check cannot run clean, declare how the repository will treat it.

1. **Not adopted.** The rule does not apply to this codebase. A tech lead declares that, in the open.
2. **Adopted, engine not run.** The rule binds, but its mechanical check is not a true measure of the rule's intent in this codebase, or cannot work here for a technical reason. The check is set aside; the intent is not. It is still owed, through review.
3. **Held as debt.** The rule binds and the check still runs. Record existing findings as debt file by file and use the assessment to say how the repository will pay it down.
4. **An escape at a site.** The rule is adopted, its check is sound, and one place steps around it. That keeps the rule's name and loses its effect. It is the hole that justifies not thinking the design through.

Choose 1, 2 or 3 deliberately, with reasons. Do not do 4.

## Tests are code

Tests are not exempt. A test that needs a cast, a test double with logic, a module intercept or a branch is reporting on the unit's seams. The test is the unit's first consumer. The fix usually belongs in the unit's design, not in the test.

## Older than these rules

Each rule encodes lessons programmers learned before us and wrote down under names you can look up: the SOLID principles, ports and adapters, "parse, don't validate", making illegal states unrepresentable, narrow integration tests, the kinds of test double, and others. [The sources page](sources.md) names the source behind each principle, rule and recipe, and how the item relates to it. Read them to learn the pattern and the reasoning, not only the rule.

## Who does what

Each symptom on [the symptoms page](typescript/symptoms.md) names the cases it may indicate and where the breach usually sits, so a reader can tell which one they have. The repository's own assessment then sharpens that to what is specific to the codebase and its intentions: which cause applies, where, the forward goal and the steps. It does not repeat the rule.
