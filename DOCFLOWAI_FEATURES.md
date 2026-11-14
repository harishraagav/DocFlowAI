# DocFlowAI — Complete Feature Documentation

**Version:** 0.0.2
**Type:** AI-powered Visual Studio Code extension
**Publisher:** harishraagavkj

DocFlowAI is an AI-powered VS Code extension that helps developers understand, analyze, visualize, document, and improve software projects directly inside their development environment.

It combines project intelligence, architecture visualization, automated documentation, code assistance, and configurable AI providers in one extension.

---

## 1. Software Architecture & Diagram Generation

DocFlowAI can analyze a software project and generate visual representations of its architecture.

### Features

1. **Generate Full System Architecture Map**
   - Creates a high-level visualization of the project architecture.
   - Helps developers understand major components and their relationships.

2. **Generate Software Component Diagram**
   - Visualizes software components and their interactions.
   - Helps identify the structure of an application.

3. **Generate Data Flow Diagram**
   - Represents how data moves through different parts of a system.
   - Helps understand processing and data relationships.

4. **Generate Sequence Diagram**
   - Visualizes the sequence of interactions between system components.
   - Helps understand execution workflows.

5. **Generate Database ER Diagram**
   - Generates an Entity Relationship diagram.
   - Helps understand database entities and their relationships.

6. **Refresh System Architecture**
   - Regenerates the architecture representation after project changes.

---

## 2. Project Intelligence & Analysis

DocFlowAI provides AI-assisted analysis of the project to help developers understand its structure and technical characteristics.

### Features

7. **Generate Project Overview**
   - Produces a summary of the project.
   - Explains its structure, purpose, and major components.

8. **Detect Technology Stack**
   - Identifies technologies, frameworks, and programming languages used in the project.

9. **Discover APIs**
   - Identifies APIs and relevant API-related structures in the project.

10. **Analyze Project Dependencies**
    - Examines project dependencies.
    - Helps developers understand external packages and relationships.

11. **Analyze Code Quality**
    - Provides AI-assisted analysis of code quality.
    - Highlights potential improvements.

12. **Analyze Change Impact**
    - Helps understand the potential impact of changes within the project.

---

## 3. Automated Documentation Generation

DocFlowAI automates the creation of useful software documentation.

### Features

13. **Generate README**
    - Creates project README documentation.

14. **Generate API Documentation**
    - Generates documentation for project APIs.

15. **Generate Technical Documentation**
    - Produces technical documentation describing the project.

16. **Generate Developer Onboarding Guide**
    - Creates onboarding documentation to help new developers understand the project.

17. **Document Current File**
    - Generates documentation for the currently opened file.

18. **Document Functions**
    - Generates explanations and documentation for functions.

19. **Generate Complete Documentation Bundle**
    - Generates a comprehensive documentation bundle for the project.

---

## 4. AI-Powered Code Assistance

DocFlowAI includes AI-assisted features that help developers understand and improve code.

### Features

20. **Explain Selected Code**
    - Explains selected code in understandable language.
    - Helps developers understand unfamiliar implementations.

21. **Find Code Dependencies**
    - Helps identify dependencies and relationships associated with code.

22. **Suggest Code Improvements**
    - Provides AI-generated suggestions for improving code.

---

## 5. Configurable AI Provider System

DocFlowAI supports multiple AI providers, allowing developers to choose the model and provider that suit their workflow.

### Supported Providers

- **Ollama** — Local AI model execution.
- **Groq** — Cloud-based AI inference.
- **Google Gemini** — Cloud-based AI generation.

### Provider Management

- Switch between supported AI providers.
- Discover available models.
- Select the preferred model.
- Test provider connectivity.
- Configure the Ollama server URL.
- Save and update cloud API keys.
- Remove saved cloud API keys.
- Use a centralized AI provider system across extension commands.

### Secure API Key Management

- Cloud API keys are stored using VS Code SecretStorage.
- API keys are not displayed back in the dashboard after saving.
- Users can update or remove their saved keys.
- API keys are not intended to be stored in extension settings or activity logs.

---

## 6. Interactive DocFlowAI Dashboard

DocFlowAI includes a dedicated dashboard accessible through the VS Code Activity Bar.

The dashboard provides four sections.

### Overview
- Central overview of DocFlowAI.
- Quick access to extension functionality.

### AI Providers
- Configure the active AI provider.
- Discover available models.
- Select models.
- Configure API keys.
- Update or remove API keys.
- Configure the Ollama URL.
- Test provider connections.
- View provider configuration status.

### Tools
- Browse the available DocFlowAI commands.
- Search through the 27 supported commands.
- Access functionality from the dashboard.

### Activity
- View the DocFlowAI activity log.
- Review recorded extension activity.
- Clear the activity log.

---

## 7. Command Palette Integration

All 27 DocFlowAI commands are available through VS Code command functionality.

| No. | Command |
|---:|---|
| 1 | Generate Full System Architecture Map |
| 2 | Generate Software Component Diagram |
| 3 | Generate Data Flow Diagram |
| 4 | Generate Sequence Diagram |
| 5 | Generate Database ER Diagram |
| 6 | Generate Project Overview |
| 7 | Detect Technology Stack |
| 8 | Discover APIs |
| 9 | Analyze Project Dependencies |
| 10 | Analyze Code Quality |
| 11 | Analyze Change Impact |
| 12 | Refresh System Architecture |
| 13 | Generate README |
| 14 | Generate API Documentation |
| 15 | Generate Technical Documentation |
| 16 | Generate Developer Onboarding Guide |
| 17 | Document Current File |
| 18 | Document Functions |
| 19 | Generate Complete Documentation Bundle |
| 20 | Explain Selected Code |
| 21 | Find Code Dependencies |
| 22 | Suggest Code Improvements |
| 23 | Configure AI Provider |
| 24 | Test AI Connection |
| 25 | Remove AI API Key |
| 26 | View Activity Log |
| 27 | Clear Activity Log |

---

## 8. Privacy & Security

DocFlowAI provides different execution options depending on the selected AI provider.

### Local AI — Ollama
- Supports local model execution.
- AI processing can take place on the user's machine through the configured Ollama server.
- Does not require a Groq or Gemini cloud API key.

### Cloud AI — Groq and Gemini
- Requires a user-provided API key.
- Displays a consent notice before switching to a cloud provider.
- Informs users that relevant project context may be sent to the selected third-party AI provider to process requests.

### Credential Protection
- Uses VS Code SecretStorage for cloud API keys.
- Supports updating and removing saved credentials.
- Does not expose saved API keys through the dashboard.

---

## 9. Developer Experience

- Integrated directly into Visual Studio Code.
- Dedicated Activity Bar entry.
- Searchable command dashboard.
- Configurable AI providers and models.
- Centralized AI generation services.
- Automated documentation workflows.
- Architecture visualization.
- Activity tracking.
- Chromium-based browser support for diagram rendering.

---

## 10. Technology & Implementation

DocFlowAI is built using technologies including:

- TypeScript
- Visual Studio Code Extension API
- Webpack
- Node.js
- Ollama API
- Groq API
- Google Gemini API
- VS Code SecretStorage
- @eraserlabs/diagrams

---

## 11. Project Summary

DocFlowAI brings together:

- 27 VS Code commands.
- 3 supported AI providers.
- AI-powered architecture visualization.
- Project analysis and intelligence.
- Automated software documentation.
- AI-assisted code understanding and improvement.
- An interactive four-section dashboard.
- Secure cloud API key management.
- Local AI execution support.
- Activity logging and management.

**DocFlowAI — Understand your code. Visualize your architecture. Automate your documentation.**
