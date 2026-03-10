import { describe, expect, test } from "bun:test"
import { buildTmuxSendKeysCommands } from "./tmux"
import type { ProcessInputChunk } from "./process-manager"

describe("buildTmuxSendKeysCommands", () => {
	test("passes literal text via a dedicated tmux -l command", () => {
		const input: ProcessInputChunk[] = [
			{ type: "text", text: "hello" },
		]

		expect(buildTmuxSendKeysCommands("session:0.0", input)).toEqual([
			["tmux", "send-keys", "-t", "session:0.0", "-l", "hello"],
		])
	})

	test("maps special keys to dedicated tmux key commands", () => {
		const input: ProcessInputChunk[] = [
			{ type: "key", key: "enter" },
			{ type: "key", key: "backspace" },
			{ type: "key", key: "tab" },
			{ type: "key", key: "escape" },
		]

		expect(buildTmuxSendKeysCommands("session:0.0", input)).toEqual([
			["tmux", "send-keys", "-t", "session:0.0", "Enter"],
			["tmux", "send-keys", "-t", "session:0.0", "BSpace"],
			["tmux", "send-keys", "-t", "session:0.0", "Tab"],
			["tmux", "send-keys", "-t", "session:0.0", "Escape"],
		])
	})

	test("preserves chunk ordering for mixed input without interleaving -l", () => {
		const input: ProcessInputChunk[] = [
			{ type: "text", text: "git status" },
			{ type: "key", key: "enter" },
			{ type: "text", text: "next" },
			{ type: "key", key: "tab" },
		]

		expect(buildTmuxSendKeysCommands("session:0.0", input)).toEqual([
			["tmux", "send-keys", "-t", "session:0.0", "-l", "git status"],
			["tmux", "send-keys", "-t", "session:0.0", "Enter"],
			["tmux", "send-keys", "-t", "session:0.0", "-l", "next"],
			["tmux", "send-keys", "-t", "session:0.0", "Tab"],
		])
	})

	test("ignores empty text chunks", () => {
		const input: ProcessInputChunk[] = [
			{ type: "text", text: "" },
			{ type: "key", key: "enter" },
		]

		expect(buildTmuxSendKeysCommands("session:0.0", input)).toEqual([
			["tmux", "send-keys", "-t", "session:0.0", "Enter"],
		])
	})
})
