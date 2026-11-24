# Authorised location

```json
{
  "phrase": "an authorised location"
}
```

- **Recorded in:** **An authorised location** is in `hone-records/authorised-locations/<symptom>.json`: `answers`, `file`, `case` and `owes`, naming the case the file is and the principle it owes, and a `whyChain`. It says the symptom is correct in that file. `hone authorise` writes one from the arguments it is given. Each file is a document `{ "version": 2, "records": [...] }`; `answers` names `<symptom>#<check>`. Where the symptom's correct use binds an outside party, `outsideParty` names the package or `node:` module.
  An `authorised-location` follows the why-chain contract: exactly five `{ "why", "because", "evidence" }` steps chained cause to cause, then `rootCause`, `rootEvidence`, `readback` and `owner`. The contract lists what Hone refuses and what review still judges:

  ```json
  "whyChain": {
    "whys": [
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." }
    ],
    "rootCause": "...",
    "rootEvidence": "...",
    "readback": "...",
    "owner": "..."
  }
  ```
