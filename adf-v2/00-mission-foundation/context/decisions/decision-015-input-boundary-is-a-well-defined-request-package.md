# Decision D-015 - Input Boundary Is A Well-Defined Request Package

Frozen decision:
- the delivery service starts from a well-defined implementation request package

What that means:
- the input is not any arbitrary request
- the input is a package that is complete enough for implementation handoff
- it is called a package because implementation may require several artifacts, not one document only
- for component handoff, the authoritative package form is a JSON payload with the relevant defined fields

Responsibility rule:
- it is the CTO's responsibility to make sure the package is complete for implementation handoff before the delivery service begins

Why this was accepted:
- keeps the delivery promise truthful
- prevents intake ambiguity from being confused with delivery failure
- preserves a clear service boundary between shaping and implementation
