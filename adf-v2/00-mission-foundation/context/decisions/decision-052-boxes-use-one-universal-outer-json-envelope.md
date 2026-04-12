# Decision D-052 - Boxes use one universal outer JSON envelope

Frozen decision:
- every box uses one universal outer JSON envelope
- standard cross-box fields live in that outer envelope
- box-specific content lives inside a nested payload section

Why:
- this gives all governed components one consistent contract shape without flattening away box-specific meaning
- it keeps status, blocked reason, KPI truth, audit references, and checkpoint references in predictable locations across the system
- it reduces later role and workflow drift by freezing the contract shape at the correct high level before exact schema details are defined
