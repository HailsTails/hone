# Tagged union and exhaustive switch

```json
{
  "serves": [
    {
      "rule": "kinds-are-named"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"boolean inputs are a smell, disallowed\"; \"no boolean inputs, breaks clean code\".",
    "standing": "accepted"
  }
}
```

- **Method:** Kinds are a string-literal tag on a union. Choosing is a `switch` with one case per kind and no `default`, so the checker proves every kind is handled. A mode or state is a literal union (`"compact" | "full"`), never a `boolean`.
- **You can tell because:** No `default:` on a closed union. No boolean parameter or field stands for a state.
- **Industry name:** algebraic data type; exhaustiveness checking (TypeScript Handbook), with no `default` branch.
