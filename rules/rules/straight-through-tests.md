# Straight-through tests

```json
{
  "principle": "tests-are-ours",
  "standing": "accepted"
}
```

- **What must hold:** A test runs straight through: each case is distinct and complete, its input and expected output are written out in it as typed values, nothing in the test builds or picks them, nothing in it branches or catches, and no code of ours runs but the code under test.
- **Source:** Meszaros names branching in a test Conditional Test Logic; this rule removes it.
