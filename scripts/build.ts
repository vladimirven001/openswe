/**
 * Build script for creating standalone executables
 * Uses the solid plugin for JSX transformation
 */
import { rename, mkdir } from "fs/promises"
import solidTransformPlugin from "@opentui/solid/bun-plugin"

const target = process.argv[2] as
	| "bun-darwin-arm64"
	| "bun-darwin-x64"
	| "bun-linux-x64"
	| "bun-linux-arm64"
	| undefined

const targetSuffix = target?.replace("bun-", "") ?? "native"
const outputName = `openswe-${targetSuffix}`

console.log(`Building for target: ${targetSuffix}`)

await mkdir("./dist", { recursive: true })

const result = await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: target ?? "bun",
	compile: true,
	plugins: [solidTransformPlugin],
	minify: true,
})

if (!result.success) {
	console.error("Build failed:")
	for (const log of result.logs) {
		console.error(log)
	}
	process.exit(1)
}

// Rename the output file (compile creates a file named after the entrypoint folder)
await rename("./dist/src", `./dist/${outputName}`)

console.log(`Build successful: dist/${outputName}`)
