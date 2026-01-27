# Fix CLI --model Flag Implementation

The `--model` flag is currently ignored by the application. This plan details the steps to correctly implement and wire up the `--model` CLI argument.

## 1. Update Configuration Types
**File:** `src/config/types.ts`

- Add `model` property to `CLIOverrides` interface.

```typescript
export interface CLIOverrides {
  backend?: AIBackend
  model?: string // Add this
  debug?: boolean
}
```

## 2. Implement Configuration Override Logic
**File:** `src/config/index.ts`

- Update `applyCLIOverrides` function to handle the `model` property.
- The logic should update the model configuration for the *active* backend (either the default or the one overridden by `--backend`).

```typescript
function applyCLIOverrides(config: GlobalConfig, cli: CLIOverrides): GlobalConfig {
  const result = structuredClone(config)

  if (cli.backend !== undefined) {
    result.ai.backend = cli.backend
  }

  // Add this block
  if (cli.model !== undefined) {
    const activeBackend = result.ai.backend
    if (activeBackend === "opencode") {
      result.ai.opencode.model = cli.model
    } else if (activeBackend === "claude") {
      result.ai.claude.model = cli.model
    }
  }

  if (cli.debug === true) {
    result.advanced.logLevel = "debug"
  }

  return result
}
```

## 3. Update CLI Entry Point
**File:** `src/index.ts`

- Update `CLIArgs` interface to include `model`.
- Add `.option("model", ...)` to `yargs` configuration.
- Pass `argv.model` to `loadConfig`.

```typescript
// Update CLIArgs interface
interface CLIArgs {
  // ...
  model?: string // Add this
  // ...
}

// Update yargs chain
// ...
.option("model", {
  type: "string",
  description: "AI model to use (e.g. claude-3-5-sonnet-20240620)",
})
// ...

// Update main function
const config = await loadConfig({
  backend: argv.backend as AIBackend | undefined,
  model: argv.model, // Add this
  debug: argv.debug,
})
```

## verification
1. Run `bun run src/index.ts --help` and verify `--model` is listed.
2. Run with `--model` and verify in logs (using `--debug`) that the correct model is loaded into configuration.
