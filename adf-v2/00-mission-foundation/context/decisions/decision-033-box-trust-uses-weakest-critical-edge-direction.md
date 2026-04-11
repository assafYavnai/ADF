# Decision D-033 - Box Trust Uses Weakest Critical Edge Direction

Frozen decision:
- the direction for box-trust aggregation is weakest critical edge, not average

What that means:
- one critical weak edge can make a box unsafe to rely on
- simple averaging is not truthful enough for fire-and-forget use
- the exact definition of `critical edge` is still open

Why this was accepted:
- it is simple
- it matches real delegation risk better than averaging
- it preserves a conservative and trustworthy executive view upward
