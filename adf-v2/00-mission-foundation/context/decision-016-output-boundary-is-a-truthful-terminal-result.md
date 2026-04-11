# Decision D-016 - Output Boundary Is A Truthful Terminal Result

Frozen decision:
- the delivery service returns a truthful terminal result

What that means:
- the return contract is not defined only as a happy-path artifact
- the service must end in a terminal result that truthfully reflects what happened
- completion remains one possible terminal result, but the output boundary is broader than the happy path alone

Why this was accepted:
- keeps the service contract truthful
- prevents the output definition from pretending every valid execution ends in completion
- preserves a clean distinction between the service boundary and the specific internal route taken to reach the result
