# The type checker proves it

```json
{}
```

- **Must hold:** Every fact the code relies on about a value is proven by the type checker.
- **Protects:** A wrong shape, an unhandled case or an unhandled failure fails the build, not production.
- **Reason to change:** A type gains a case or changes shape.
- **Breach:** At the declaration that admits too much. Shows at uses: casts.
- **Source:** Minsky makes illegal states unrepresentable; King parses once at the edge, so the types carry the proof.
- **Quoted reasons:** On failures as values: "sounds like a rule of the type checker in a way. As it makes the output clear to type system instead of hidden in throws".
