# DocFlowAI

**AI-powered continuous documentation generator for Visual Studio Code.**

DocFlowAI helps developers understand, document, and visualize existing codebases directly inside VS Code. It combines project analysis, diagram generation, code explanations, and documentation generation in one extension.

With support for Ollama, Groq, and Google Gemini, you can choose the AI provider and model that best fits your workflow.

## Features

### Architecture and diagrams
- Generate a full system architecture map
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
- Find dependencies for selected code

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

### AI provider management
- Choose between Ollama, Groq, and Google Gemini
- Discover available models
- Select the model you want to use
- Configure and update cloud API keys
- Store API keys securely using VS Code SecretStorage
- Test provider connectivity
- Configure the Ollama server URL

### Activity and dashboard
- Access the DocFlowAI dashboard from the Activity Bar
- Browse the Overview, AI Providers, Tools, and Activity sections
- Search the available commands
- View and clear the DocFlowAI activity log

## AI Providers

DocFlowAI supports three AI providers.

| Provider | Description | API key |
|---|---|---|
| Ollama | Run supported models locally using Ollama | Not required |
| Groq | Use models available through the Groq API | Required |
| Google Gemini | Use models available through the Gemini API | Required |

You can change providers and models through the DocFlowAI dashboard or the provider configuration commands.

### Ollama

1. Install Ollama from https://ollama.com/.
2. Start the Ollama service.
3. Pull a model. The default model is `llama3.2`.

   ```bash
   ollama pull llama3.2
   ```

4. Make sure the Ollama service is running.
5. Open the DocFlowAI dashboard and select Ollama.

The default Ollama server URL is:

```text
http://localhost:11434
```

You can change the server URL and select another discovered model through the dashboard.

### Groq

1. Create an account at https://console.groq.com/.
2. Generate an API key.
3. Open the DocFlowAI dashboard.
4. Navigate to AI Providers and select Groq.
5. Enter and save your API key.
6. Discover available models and select one.
7. Use Test Connection to verify the configuration.

### Google Gemini

1. Get an API key from https://aistudio.google.com/apikey.
2. Open the DocFlowAI dashboard.
3. Navigate to AI Providers and select Gemini.
4. Enter and save your API key.
5. Discover available models and select one.
6. Use Test Connection to verify the configuration.

### API key security

- Groq and Gemini API keys are stored using VS Code SecretStorage.
- API keys are not displayed in the dashboard after saving.
- The dashboard displays whether a key is configured, not the key itself.
- You can update or remove saved API keys through the dashboard.
- Never share your API keys or commit them to source control.

When switching to a cloud provider, DocFlowAI displays a consent notice. Requests sent to Groq or Gemini may include relevant prompts, selected code, or project context required for the requested operation. This information is processed by the selected third-party provider under its own policies.

When using Ollama, AI requests are sent to the configured Ollama server, which can run locally on your machine.

## Getting started

1. Install DocFlowAI in VS Code.
2. Open a project folder in VS Code.
3. Open the DocFlowAI dashboard using its Activity Bar icon.
4. Navigate to AI Providers.
5. Choose Ollama, Groq, or Gemini and configure the required settings.
6. Test the provider connection.
7. Navigate to Tools or open the Command Palette.
8. Search for DocFlowAI and select the command you want to run.

Some commands work on selected code or the currently open file, while others analyze the opened workspace. Open a project folder before running workspace-level analysis.

## Dashboard

The DocFlowAI dashboard provides four sections:

- **Overview:** Access the extension and its main capabilities.
- **AI Providers:** Configure providers, API keys, models, and connections.
- **Tools:** Browse and search available DocFlowAI commands.
- **Activity:** Access and manage the activity log.

## Commands

All commands are available through the VS Code Command Palette. Search for `DocFlowAI` to find the available actions.

### Architecture and project analysis
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
- Refresh System Architecture

### Documentation
- Generate README
- Generate API Documentation
- Generate Technical Documentation
- Generate Developer Onboarding Guide
- Document Current File
- Document Functions
- Generate Complete Documentation Bundle

### Code assistance
- Explain Selected Code
- Find Code Dependencies
- Suggest Code Improvements

### Provider management
- Configure AI Provider
- Test AI Connection
- Remove AI API Key

### Activity
- View Activity Log
- Clear Activity Log

## Requirements

1. **Visual Studio Code:** Use a version compatible with the `engines.vscode` requirement in `package.json`.
2. **AI provider:** Configure at least one supported provider: Ollama, Groq, or Google Gemini.
3. **API key:** Required for Groq and Gemini. Not required for Ollama.
4. **Chromium-based browser:** The diagram renderer may require a supported browser executable such as Chrome, Chromium, or Edge. Make sure it is installed and discoverable by the renderer.

Node.js and npm are required only for extension development and building, not normal use after installation.

## Privacy and local processing

DocFlowAI supports both local and cloud-based AI processing.

- With Ollama, requests are sent to the configured Ollama server.
- With Groq or Gemini, relevant prompts and project context may be sent to the selected provider.
- Cloud providers process submitted information under their respective privacy policies and terms.
- API keys are stored using VS Code SecretStorage.

Review the consent notice before using a cloud provider. Avoid sending credentials, private keys, confidential source code, or other sensitive information to third-party AI services.

AI-generated explanations, documentation, and recommendations should be reviewed before being used in production.

## Known limitations

- AI-generated explanations and documentation can contain inaccuracies. Verify important technical details.
- Code analysis depends on the source files and patterns the extension can inspect.
- The extension is not a substitute for a full compiler, security audit, or formal static-analysis suite.
- Diagram quality depends on the structure and information available in the scanned project.
- AI-powered commands require the selected provider and configured model to be available.
- Cloud providers require valid API keys and network connectivity.
- Diagram rendering requires a supported Chromium-based browser executable.

## Development

Clone the repository:

```bash
git clone https://github.com/harishraagav/DocFlowAI.git
cd DocFlowAI
```

Install dependencies:

```bash
npm install
```

Compile the extension:

```bash
npm run compile
```

Run tests:

```bash
npm test
```

Run lint checks:

```bash
npm run lint
```

Create a production build:

```bash
npm run package
```

Package the extension as a VSIX:

```bash
vsce package
```

## Feedback and contributions

For bug reports, feature requests, and support, use the project's GitHub issue tracker:

https://github.com/harishraagav/DocFlowAI/issues

## License

See the [LICENSE](LICENSE) file for license information.
