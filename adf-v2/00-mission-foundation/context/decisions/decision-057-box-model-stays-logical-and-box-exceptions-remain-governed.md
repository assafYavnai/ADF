# Decision D-057 - Box model stays logical and box exceptions remain governed

Frozen decision:
- `BOXED-COMPONENT-MODEL.md` defines the logical governed component structure, not physical repository layout, source-control evolution policy, or implementation workflow policy
- core governed execution units are boxes
- approved shared system tools or substrate may exist as a separate governed class and are not forced into the box type merely because boxes depend on them

Why:
- this keeps the box model at the correct abstraction level
- it prevents repository or workflow policy from leaking into the runtime component definition
- it preserves the boxed execution model without overconstraining framework-level governed assets
