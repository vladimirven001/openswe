import { render, useKeyboard } from "@opentui/solid"
import { createSignal } from "solid-js"

function App() {
  useKeyboard((e) => { if (e.name === 'q') process.exit(0) })
  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="row">
        <text>Type</text>
        <text>{` Search`}</text>
      </box>
      <box flexDirection="row">
        <text>n</text>
        <text>{` New`}</text>
      </box>
      <box flexDirection="row" gap={1}>
        <text>Type</text>
        <text>Search</text>
      </box>
    </box>
  )
}

render(() => <App />)
