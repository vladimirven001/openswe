# Implementation Plan - Session Takeover Mode

## Goal
Implement a full "Takeover Mode" that allows users to enter a running Opencode session, interact with the process via stdin, and view the output in a full-screen terminal view. This addresses the user's need to "enter opencode" upon pressing Enter on a session.

## Proposed Changes

### 1. New Component: `SessionTerminal`
Create `src/components/SessionTerminal.tsx` to handle the interactive terminal view.
- **Props**: `session`, `lines`, `onExit`
- **Render**: Full-screen output using `<scrollbox>` (similar to Preview but maximized).
- **Input Handling**: Use `useKeyboard` to capture keys and forward them to the PTY session via `SessionManager`.
- **Exit**: Handle `Ctrl+C` or `Esc` (or specific binding) to call `onExit` and return to dashboard.

### 2. Update `App.tsx`
- Add `viewMode` state: `"dashboard" | "takeover"`.
- Modify `return` key handler:
  - If session is `queued`/`paused`, start it (keep existing logic).
  - Set `viewMode` to `"takeover"`.
- Render logic:
  - If `viewMode === "takeover"`, render `<SessionTerminal>` instead of `<SessionList>` + `<Preview>`.
  - Pass `onExit={() => setViewMode("dashboard")}` to `SessionTerminal`.

### 3. Input Forwarding Logic
- Since `opentui` abstracts keyboard events, we will map common keys to PTY input.
- `onData` listener on `process.stdin` (if feasible without conflict) or mapping `useKeyboard` events.
- *Note*: For now, we'll map `useKeyboard` events to strings passed to `ptySession.write()`.

## Verification
- Select an issue -> Session Queued.
- Press Enter -> Session Active -> View switches to Terminal.
- Type in Terminal -> Input forwarded to Opencode (if interactive).
- Output from Opencode -> Appears in Terminal.
- Press `Ctrl+D` (or mapped exit key) -> Returns to Dashboard.

## File Changes
- `src/components/SessionTerminal.tsx` (Create)
- `src/components/index.ts` (Export new component)
- `src/components/App.tsx` (Modify)
