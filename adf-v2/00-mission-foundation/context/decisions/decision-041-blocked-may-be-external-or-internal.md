# Decision D-041 - Blocked May Be External Or Internal

Frozen decision:
- `blocked` does not mean only waiting on something external to the system
- `blocked` may also represent an internally detected terminal failure when the system cannot truthfully complete from the current state without explicit resolution

What that means:
- blocked reasons may come from outside the system, such as missing input or waiting for user verification
- blocked reasons may also come from inside the system, such as a failure state that prevents truthful completion
- the unifying meaning is that the system cannot certify completion from the current state without some explicit resolution

Why this was accepted:
- this keeps the terminal model truthful
- it avoids creating a separate top-level state when the real meaning is still that completion cannot be certified from the current state
