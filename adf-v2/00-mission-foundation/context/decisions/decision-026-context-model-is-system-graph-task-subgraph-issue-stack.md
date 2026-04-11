# Decision D-026 - Context Model Is System Graph, Task Subgraph, Issue Stack

Frozen decision:
- below `Layer 0`, the CTO working context model is:
  - `Layer 1` = system graph
  - `Layer 2` = current task subgraph
  - `Layer 3` = current issue stack

What that means:
- the full system context is graph-shaped because many parts relate to many others
- the current task is the focused active slice of that wider system graph
- the deepest issue layer is stack-shaped because local dives are temporary and naturally FILO

Why this was accepted:
- keeps the wider system in view while allowing narrow task focus
- prevents local issue handling from replacing the current task or the full system frame
- matches the need for both dependency awareness and temporary deep dives
