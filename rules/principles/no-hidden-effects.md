# No hidden effects

```json
{}
```

- **Must hold:** A unit changes nothing: it gives back the value it returns and calls ports passed in to it.
- **Protects:** Every effect is visible at the call site, and no unit works by holding state and changing it.
- **Reason to change:** What a call affects changes.
- **Breach:** In the function that writes to something it was not passed, changes its input, or changes a value of its own after making it. Shows as tests that patch a global to see an effect.
- **Source:** This is Bernhardt's functional core, imperative shell: decisions stay pure and effects stay in sight.
- **Quoted reasons:** "If the unit calls something we check it calls it."
