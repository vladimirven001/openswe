# Phase Detection and Human Input Refactoring Plan

## Problem
The current system relies on custom text stoppers (e.g., `[OPENSWE:BLOCKER:...]`) and specific keywords to detect:
1.  Phase transitions (Planning -> Working -> Completed).
2.  Requests for human input (Blockers/Questions).

This is fragile because it depends on the LLM outputting exact strings, which it may fail to do.

## Proposed Solution
Leverage the structured `[tool_call: ...]` logs that `opencode` produces. This is a deterministic signal of the agent's actions.

### Detection Logic
We will modify `src/core/parser.ts` to detect `[tool_call: <name> ...]` patterns.

| Event Type | Detection Rule | Logic |
|------------|----------------|-------|
| **Human Input** | Tool call: `question` or `ask_user` | Transitions status to `needs_attention`. |
| **Build Phase** | Tool call: `edit` or `write` | Transitions phase to `working` (Build). |
| **Done Phase** | Tool call: `finish` (future proof) or `[OPENSWE:DONE]` | Transitions phase to `completed` (Done). |

## Implementation Details

### 1. Modify `src/core/parser.ts`

Update `parseOutputLine` to include a new `TOOL_CALL_REGEX`.

```typescript
const TOOL_CALL_REGEX = /\[tool_call:\s*(\w+)/i

// ... inside parseOutputLine ...

const toolMatch = line.match(TOOL_CALL_REGEX)
if (toolMatch) {
  const toolName = toolMatch[1].toLowerCase()
  
  // Transition to Build/Working phase on code modification
  if (toolName === "edit" || toolName === "write") {
    return { type: "working", line }
  }

  // Detect human input request
  if (toolName === "question" || toolName === "ask_user") {
    return { 
      type: "question", 
      payload: "User input requested via tool", 
      line 
    }
  }
}
```

### 2. Verify `src/core/session.ts`
The `SessionManager` already handles `working` and `question` events correctly:
- `working` -> `updateSessionPhase(sessionId, "working")`
- `question` -> `taskQueue.createFromQuestion(...)`

No changes are needed in `session.ts` if we map to these existing event types.

### 3. UI Updates (Optional but requested)
The user mentioned "Plan, Build, Done" as desired phase names.
While we are keeping the internal types (`planning`, `working`, `completed`), we can update the display labels in `src/components/types.ts` if desired, though the user later said "DO NOT RENAME THE PHASES". So we will strictly stick to detection logic.

## Verification
1.  **Test Plan -> Build**: Start a session. Ask it to write a file. Verify phase switches to "Working" when `[tool_call: write ...]` appears.
2.  **Test Human Input**: Ask the agent to ask a question. Verify status switches to "Needs Attention" when `[tool_call: question ...]` appears.
