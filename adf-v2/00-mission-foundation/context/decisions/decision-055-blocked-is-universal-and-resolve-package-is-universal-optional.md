# Decision D-055 - Blocked is universal and resolve package is universal-optional

Frozen decision:
- `blocked` is a universal field family in the outer box envelope for all boxes
- `resolve package` is universal-optional: it appears only for boxes that support governed continuation after blocking

Why:
- this preserves one truthful blocked-reporting shape across the whole system
- it avoids forcing fake or meaningless resolve content on boxes that cannot continue from the current state
- it keeps continuation support explicit and governed without weakening the shared contract structure
