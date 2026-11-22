# External behaviour sits at a boundary

```json
{}
```

- **Must hold:** Business logic calls only other business logic, ports passed in to it, and operations that depend on nothing but their arguments and change nothing.
- **Protects:** A change in a service, a runtime, a clock or a protocol never edits business logic.
- **Reason to change:** The thing we call changes its behaviour.
- **Breach:** In the business-logic file that makes the call. Shows as a vendor or adapter import in business logic, a module mock, or a result that differs per machine.
- **Source:** This is Cockburn's ports and adapters, and Martin's rule that dependencies point inwards.
- **Quoted reasons:** "Http fetch library for example has complexity to bind." "date creates non determinism and leaks the world in."
