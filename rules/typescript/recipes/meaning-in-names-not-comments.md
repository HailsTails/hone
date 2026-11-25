# Meaning in names, not comments

```json
{
  "serves": [
    {
      "rule": "one-word-everywhere"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"If the code isn't self explanatory that's the problem. You shouldn't need usage notes at all.\"",
    "standing": "accepted"
  }
}
```

- **Method:** What a comment would say goes into a name, a type or a union. The only annotations are a tracked pointer such as `(#42)` and a tool directive covered by a record.
- **You can tell because:** No comment or JSDoc in our code.
- **Industry name:** none; ours. It is stricter than Martin's *Clean Code*, which keeps a section on good comments.

Casing is a check that runs the adopter's own lint. It is not a recipe. Basic logic in the language's own constructs is a case under the principle; its recipe is the native array and object methods, chosen because an outside dependency's language for them is "language obscuring standard operations".
