# DocFlowAI — Features 17–23

This update adds seven feature groups to the existing extension without introducing new npm dependencies.

## Feature 17 — Explain Code

**Command:** `DocFlowAI: Explain Selected Code` (`docflowai.explainCode`)

Explains the selected editor text, or the entire active file when there is no selection. It uses the active document's language ID and optional full-file context, then writes a Markdown report under `DocFlowAI_Code_Explanations/`.

## Feature 18 — Find Code Dependencies

**Command:** `DocFlowAI: Find Code Dependencies` (`docflowai.findDependencies`)

Scans the active file's import statements and follows resolvable internal imports through the scanned workspace. The report is deterministic and distinguishes internal files from references that did not resolve to scanned workspace files. It does not claim every unresolved import is an external package.

## Feature 19 — Document Functions

**Command:** `DocFlowAI: Document Functions` (`docflowai.documentFunctions`)

Detects function/method declarations in the active file, presents a Quick Pick, and generates documentation for the selected function. Python extraction is indentation-based; brace-language extraction is a lightweight brace-counting approximation. Output is written under `DocFlowAI_Function_Documentation/`.

## Feature 20 — Suggest Code Improvements

**Command:** `DocFlowAI: Suggest Code Improvements` (`docflowai.suggestCodeImprovements`)

Reviews selected code or the whole active file with Ollama. Its prompt requires concrete source evidence, separates findings from optional improvements, and discourages unsupported vulnerability/runtime claims. Output is written under `DocFlowAI_Code_Improvements/`.

## Feature 21 — Complete Documentation Bundle

**Command:** `DocFlowAI: Generate Complete Documentation Bundle` (`docflowai.generateDocumentationBundle`)

Scans the workspace once and sequentially attempts to generate:

- Project overview and technology stack
- API discovery and API documentation
- Dependency and code-quality reports
- `README_DocFlowAI.md` (so an existing `README.md` is not overwritten)
- Technical documentation and developer onboarding guide
- System architecture, component, data-flow, sequence, and database/storage diagrams

Each task is isolated. A failed task is recorded and does not stop the other tasks. Diagram generation checks the local Chrome/Edge renderer once; if that is unavailable, diagram tasks are marked skipped while the text documentation continues. The bundle index is saved as `DocFlowAI_Documentation_Bundle.md`.

## Feature 22 — Refresh Architecture

**Command:** `DocFlowAI: Refresh System Architecture` (`docflowai.refreshArchitecture`)

Rescans the current workspace, reruns the existing architecture analyzer, rebuilds the Eraser diagram and refreshes the PNG, JSON and Markdown artifacts.

## Feature 23 — Activity Log

**Commands:**

- `DocFlowAI: View Activity Log` (`docflowai.viewActivityLog`)
- `DocFlowAI: Clear Activity Log` (`docflowai.clearActivityLog`)

A workspace file watcher records creation and updates of known DocFlowAI artifacts in `DocFlowAI_Activity_Log.md`. Log writes are serialized to avoid concurrent updates overwriting each other. The log can be opened or cleared from the Command Palette.

## Implementation notes and limitations

- All AI-generated features use the existing local Ollama client and current configured model (`llama3.2`).
- No new runtime or development dependency was added; `package-lock.json` therefore remains unchanged.
- Import and function extraction use lightweight patterns, not complete language ASTs. Dynamic imports, unusual syntax, reflection, generated modules and declarations split across unsupported patterns may be missed.
- Code explanations and suggestions are model-generated and should be reviewed before being treated as authoritative.
- Diagram PNG generation requires a discoverable Chrome or Edge executable, following the existing Eraser renderer configuration.
- Activity tracking begins after the extension activates and observes known generated artifacts; it is not a complete audit of every command or arbitrary workspace file change.
