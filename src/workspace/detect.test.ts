import { mkdtemp, mkdir } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { describe, expect, test } from "bun:test"
import { detectWorkspace } from "./detect"

async function createTempDir(name: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `${name}-`))
}

describe("detectWorkspace", () => {
  test("detects existing project in an ancestor directory", async () => {
    const base = await createTempDir("openswe-detect-project")
    const projectRoot = join(base, "project")
    const nested = join(projectRoot, "nested")

    await mkdir(join(projectRoot, ".openswe"), { recursive: true })
    await mkdir(nested, { recursive: true })

    const result = await detectWorkspace(nested)

    expect(result.type).toBe("existing-project")
    expect(result.projectRoot).toBe(projectRoot)
  })

  test("detects git repo in an ancestor directory", async () => {
    const base = await createTempDir("openswe-detect-git")
    const repoRoot = join(base, "repo")
    const nested = join(repoRoot, "nested")

    await mkdir(join(repoRoot, ".git"), { recursive: true })
    await mkdir(nested, { recursive: true })

    const result = await detectWorkspace(nested)

    expect(result.type).toBe("existing-repo")
    expect(result.projectRoot).toBe(repoRoot)
  })

  test("returns empty when no markers are found", async () => {
    const base = await createTempDir("openswe-detect-empty")
    const nested = join(base, "child")

    await mkdir(nested, { recursive: true })

    const result = await detectWorkspace(nested)

    expect(result.type).toBe("empty")
    expect(result.projectRoot).toBe(nested)
  })
})
