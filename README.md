# DocFlowAI

**AI-powered continuous documentation generator for Visual Studio Code.**

DocFlowAI helps developers understand, document, and visualize an existing codebase from inside VS Code. It combines project analysis, diagram generation, code explanations, and documentation generation in one extension.

## Features

### Architecture and diagrams
- Generate a system architecture map
- Generate software component diagrams
- Generate data-flow diagrams
- Generate sequence diagrams
- Generate database ER diagrams
- Refresh the system architecture

### Project intelligence
- Generate a project overview
- Detect the technology stack
- Discover APIs
- Analyze project dependencies
- Analyze code quality
- Analyze change impact
- Find dependencies for code

### Documentation
- Generate a README
- Generate API documentation
- Generate technical documentation
- Generate a developer onboarding guide
- Document the currently open file
- Document functions
- Generate a complete documentation bundle

### Code assistance
- Explain selected code
- Suggest code improvements
- View and clear the DocFlowAI activity log

## Requirements

DocFlowAI currently uses local tools for analysis and rendering:

1. **Visual Studio Code** — use a version compatible with the `engines.vscode` value in this extension's `package.json`.
2. **Node.js and npm** — required only when building or developing the extension, not for normal use after installation.
3. **Ollama** — install and run Ollama locally.
4. **The configured Ollama model** — the current default is `llama3.2`. Pull it before using AI-powered commands:

   ```bash
   ollama pull llama3.2
   ```

5. **A Chromium-based browser executable** — Chrome, Chromium, or Edge may be used by the diagram renderer. Make sure a supported browser is installed and discoverable by the renderer.

The extension communicates with the local Ollama service. Keep Ollama running when using AI-powered features.

## Getting started

1. Install DocFlowAI in VS Code.
2. Install and start Ollama.
3. Pull the model:

   ```bash
   ollama pull llama3.2
   ```

4. Open a project folder in VS Code.
5. Open the Command Palette with `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS).
6. Search for `DocFlowAI` and select the command you want to run.

Some commands work on the selected code or currently open file; others analyze the opened workspace. Open a project folder before running workspace-level analysis.

## Commands

All commands are available from the VS Code Command Palette. Search for `DocFlowAI` to see the available actions, including:

- Generate Full System Architecture Map
- Generate Software Component Diagram
- Generate Data Flow Diagram
- Generate Sequence Diagram
- Generate Database ER Diagram
- Generate Project Overview
- Detect Technology Stack
- Discover APIs
- Analyze Project Dependencies
- Analyze Code Quality
- Analyze Change Impact
- Generate README
- Generate API Documentation
- Generate Technical Documentation
- Generate Developer Onboarding Guide
- Document Current File
- Explain Selected Code
- Find Code Dependencies
- Document Functions
- Suggest Code Improvements
- Generate Complete Documentation Bundle
- Refresh System Architecture
- View Activity Log
- Clear Activity Log

## Privacy and local processing

AI requests are sent to the local Ollama service configured by the extension. Project source files are analyzed locally by the extension; do not assume that generated analysis is infallible. Review generated documentation and recommendations before using them in production.

## Known limitations

- AI-generated explanations and documentation can contain inaccuracies. Verify important technical details.
- Code analysis is based on the source files and patterns the extension can inspect; it is not a substitute for a full compiler, security audit, or formal static-analysis suite.
- Diagram quality depends on the structure and information available in the scanned project.
- AI-powered commands require the local Ollama service and configured model to be available.
- Diagram rendering requires a supported Chromium-based browser executable.

## Development

```bash
npm install
npm run compile
```

To create a production build:

```bash
npm run package
```

To package the extension as a VSIX (after installing `@vscode/vsce`):

```bash
vsce package
```

## Feedback

For bug reports, feature requests, and support, use the issue tracker configured by the project maintainer.
