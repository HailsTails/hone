# Disciplines assessment

What this repository's checks are telling us, and where the code is going. Each clause section sharpens what the symptoms page says for this codebase; it does not repeat the rule. Read a clause's section before changing code to make its check pass.

## Rules adopted

- `<discipline ID>`: <why it matters in this codebase, in one line>

## Clauses not adopted

The rule does not apply to this codebase.

- `<clause address>`: <why it does not apply>

## Clauses adopted, mechanism not run

The rule binds, but its check is not a true measure of the intent here, or cannot work here. Review carries the intent.

- `<clause address>`: <why the check does not fit here>; <how review covers the intent>

## Judgement rules adopted

Applied in review with the lens each rule item names.

- `<clause address>`: <lens>

## <clause address>

- **Cause here:** <a case or breach site from the symptom's "May indicate" or "Breach usually sits", named as the symptoms page names it>. <How it shows in this codebase.>
- **Sites:** <count> at <commit>, in <folders or files>. For example <file:line>, <file:line>.
- **Forward goal:** <the cleaner design, in this codebase's terms>.
- **Steps:** 1. <the step that unlocks the rest> 2. <the next step>
- **Debt:** held by <owner>; recorded as <how it is recorded in discipline-exceptions.json>, or none.

Repeat **Cause here** and **Sites** for each cause the sites show. Write one section per clause whose findings are not all fixed in the change that adopts it, with the clause address alone as its heading.
