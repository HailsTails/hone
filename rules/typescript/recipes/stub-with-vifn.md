# Stub with vi.fn

```json
{
  "serves": {
    "rule": "written-out-answers"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"these should be vi.fn, with mockResolvedValue, not custom async functions\"; \"Agents take fake to mean whatever they want it to mean right now.\" The framework's double has no body of ours to hold logic.",
    "standing": "accepted"
  }
}
```

- **Method:** Each collaborator is a `vi.fn()` declared as a const inside the test that uses it. Shared boilerplate or a mock builder is allowed where it hides none of three things: a wide interface, an assumption a test rests on, or coupling between tests. A shared double is therefore a symptom, suspect by default, not a breach. Its answer is `mockReturnValue` or `mockResolvedValue` with a written-out value. Each call is checked with `toHaveBeenCalledWith` and a written-out argument.
- **You can tell because:** No double has a body, a branch or a table. Every call the unit makes is asserted.
- **Industry name:** stub and spy; Test Stub (Meszaros, *xUnit Test Patterns*).

A fake is not a recipe. It is a [deviation record](../../record-kinds/deviation.md), and the bar it must meet is: "Moving a fake is only allowed if the test cannot be done with deterministic stubs or hardcoded things."
