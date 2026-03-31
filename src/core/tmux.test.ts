import { describe, expect, test } from "bun:test"
import { buildTmuxSendKeysCommands, buildTmuxSessionSetupCommands, runTmuxCommand, runTmuxSetupCommand } from "./tmux"
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

	test("redacts literal send-keys payloads in failure output", async () => {
		const stderr = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("can't find pane"))
				controller.close()
			},
		})

		await expect(
			runTmuxCommand(["tmux", "send-keys", "-t", "openswe-demo:0.0", "-l", "ship it"], () => ({
				exited: Promise.resolve(1),
				stderr,
			}))
		).rejects.toThrow('tmux command failed (exit=1) command=["tmux","send-keys","-t","openswe-demo:0.0","-l","<redacted len=7>"] stderr=can\'t find pane')
	})
})

describe("buildTmuxSessionSetupCommands", () => {
	test("uses the correct tmux option scopes", () => {
		expect(buildTmuxSessionSetupCommands("openswe-demo")).toEqual([
			{
				option: "status",
				scope: "session openswe-demo",
				command: ["tmux", "set-option", "-t", "openswe-demo", "status", "off"],
			},
			{
				option: "xterm-keys",
				scope: "window openswe-demo:0",
				command: ["tmux", "set-window-option", "-t", "openswe-demo:0", "xterm-keys", "on"],
			},
			{
				option: "extended-keys",
				scope: "server",
				command: ["tmux", "set-option", "-s", "extended-keys", "on"],
			},
		])
	})
})

describe("runTmuxSetupCommand", () => {
	test("warns instead of throwing when a setup command fails", async () => {
		const warnings: string[] = []
		const stderr = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("invalid option"))
				controller.close()
			},
		})

		await expect(
			runTmuxSetupCommand(
				{
					option: "xterm-keys",
					scope: "window openswe-demo:0",
					command: ["tmux", "set-window-option", "-t", "openswe-demo:0", "xterm-keys", "on"],
				},
				() => ({
					exited: Promise.resolve(1),
					stderr,
				}),
				(message) => warnings.push(message),
			)
		).resolves.toBeUndefined()

		expect(warnings).toEqual([
			'tmux option "xterm-keys" setup failed for window openswe-demo:0: invalid option',
		])
	})
})
