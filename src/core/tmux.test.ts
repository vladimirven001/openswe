import { describe, expect, test } from "bun:test"
import { buildTmuxSendKeysCommands, runTmuxCommand } from "./tmux"
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
			{ type: "key", key: "up" },
			{ type: "key", key: "down" },
			{ type: "key", key: "left" },
			{ type: "key", key: "right" },
		]

		expect(buildTmuxSendKeysCommands("session:0.0", input)).toEqual([
			["tmux", "send-keys", "-t", "session:0.0", "Enter"],
			["tmux", "send-keys", "-t", "session:0.0", "BSpace"],
			["tmux", "send-keys", "-t", "session:0.0", "Tab"],
			["tmux", "send-keys", "-t", "session:0.0", "Escape"],
			["tmux", "send-keys", "-t", "session:0.0", "Up"],
			["tmux", "send-keys", "-t", "session:0.0", "Down"],
			["tmux", "send-keys", "-t", "session:0.0", "Left"],
			["tmux", "send-keys", "-t", "session:0.0", "Right"],
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

describe("runTmuxCommand", () => {
	test("does not throw when command exits successfully", async () => {
		await expect(
			runTmuxCommand(["tmux", "send-keys", "-t", "openswe-demo:0.0", "hello"], () => ({
				exited: Promise.resolve(0),
				stderr: null,
			}))
		).resolves.toBeUndefined()
	})

	test("throws with exit code and stderr when command fails", async () => {
		const stderr = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("can't find pane"))
				controller.close()
			},
		})

		await expect(
			runTmuxCommand(["tmux", "send-keys", "-t", "openswe-demo:0.0", "hello"], () => ({
				exited: Promise.resolve(1),
				stderr,
			}))
		).rejects.toThrow('tmux command failed (exit=1) command=["tmux","send-keys","-t","openswe-demo:0.0","hello"] stderr=can\'t find pane')
	})
})
