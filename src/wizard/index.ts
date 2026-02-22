/**
 * Wizard module
 *
 * First-run wizard for project setup using @clack/prompts.
 */

// Re-export prompts (individual components)
export {
  // Prompt functions
  promptRepoInput,
  promptAiBackend,
  promptAiBackendWithValidation,
  promptAdoptRepo,
  // Utility functions
  isCancelled,
  intro,
  outro,
  note,
  handleCancel,
  spinner,
  log,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  // Types
  type AIBackendChoice,
} from "./prompts"

// Re-export flows (orchestrated wizard sequences)
export {
  // Flow functions
  runEmptyDirectoryWizard,
  runExistingRepoWizard,
  runReconfigureWizard,
  // Types
  type WizardResult,
} from "./flows"
