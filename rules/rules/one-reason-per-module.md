# One reason per module

```json
{
  "principle": "one-place-decides",
  "standing": "accepted"
}
```

- **What must hold:** A module holds exactly the code that changes for one reason.
- **Source:** This is Martin's Single Responsibility Principle: one reason to change.

Building every real implementation in one place at start-up is a case: Doer or orchestrator plus Ports declared inside give it. DRY is held here: "dry is true but it must be held with reasons to change not "same functional code right now"".
