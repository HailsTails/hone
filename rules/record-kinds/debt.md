# Debt

```json
{
  "phrase": "debt"
}
```

- **Recorded in:** **Debt** is in `hone-records/debt/<symptom>.json`: `answers`, `file` and an optional `note`, a note to future developers on what the debt signals, which nothing reads. It says a finding in one file is owed. It needs no case and no why-chain; forfeiture is what holds it: it is forfeited once its file is touched. Each file is a document `{ "version": 2, "records": [...] }`; `answers` names the symptom, or `<symptom>#<check>` to reach one check of it.
- **Rule:** A suppression or exemption is inherited debt held at rest, not a standing licence: it buys "leave this file alone", nothing more. The moment a change edits an exempt file, that file forfeits its exemption — the change must bring the whole file into compliance for the exempted rule (the new lines and the pre-existing ones the exemption was masking) and remove the exemption entry, in the same change. There is no partial credit and no extracting the touched code into a clean helper while the exempt file stays dirty. If full compliance is out of scope, the move is to not touch the file. This rule governs how every other exemption decays and can never itself be exempted.
- **Spirit:**
  - **What the friction is for.** A carve-out holds debt at rest. Without decay, it becomes a permanent licence. The friction makes touching a carved file the moment the debt is paid, so debt shrinks wherever work happens.
  - **What a finding points at.** Match the forfeitures against these causes.
    - *Debt in a file that changes often.* The carve-out keeps being forfeited. That file is where paying the debt is cheapest; pay it.
    - *A file too big to bring into compliance.* Touching it means rewriting it, so it has too many jobs. Leave it untouched until a change can take the whole file, and plan that change.
    - *Workarounds that avoid touching.* Code is extracted to avoid the file. That leaves the debt and the workaround; the rule forbids it.
  - **Where to go.** Carve-outs only shrink. Each touched file leaves clean.
  - **Reactions to distrust.**
    - "It's a one-line change." The carve-out bought "leave this file alone". A one-line change is not leaving it alone.
  - **Principles behind it.**
    - *The boy-scout rule.* Leave the code cleaner than you found it.
    - *Technical debt* (Ward Cunningham). Debt not paid down accrues interest on every change.
- **How it is checked:** Nothing selects it: the check applies it to every debt in `hone-records/debt/`. Run `hone check` with `--base-revision`, and a debt whose `file` changed since that revision is forfeited, so its findings come back until the file is clean. `hone prune-debt` removes the debt a run shows paid, stale or forfeited. Without `--base-revision`, debt cannot be checked for forfeiture and the report says so; `"forfeiture": "elsewhere"` in `hone.config.json`, or `--forfeiture elsewhere`, leaves it to another run.
