# Decision D-058 - System obligations and box model are aligned sibling foundation docs

Frozen decision:
- `SYSTEM-OBLIGATIONS.md` and `BOXED-COMPONENT-MODEL.md` should be treated as aligned sibling foundation documents
- `SYSTEM-OBLIGATIONS.md` defines the universal guarantee layer
- `BOXED-COMPONENT-MODEL.md` defines the logical common carrier shape for those guarantees
- neither document should be written as though the other were already a lower-layer implementation detail

Why:
- this removes the unstable dependency wording between the two drafts
- it makes freeze order less ambiguous
- it keeps the guarantee layer and carrier-shape layer distinct without splitting them into conflicting abstractions
