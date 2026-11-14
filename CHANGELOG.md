# Changelog

All notable changes to DocFlowAI are documented in this file.

## [0.0.2] - 2026-11-14

### Added
- Support for three AI providers: Ollama, Groq, and Google Gemini.
- AI provider selection and model configuration.
- Automatic model discovery for supported providers.
- AI connection testing.
- Secure cloud API key storage using VS Code SecretStorage.
- API key update and removal functionality.
- Configurable Ollama server URL.
- Dedicated DocFlowAI Activity Bar dashboard.
- Dashboard sections for Overview, AI Providers, Tools, and Activity.
- Searchable interface for all 27 DocFlowAI commands.
- Cloud provider consent notice before switching to Groq or Gemini.
- Automated extension test configuration.

### Improved
- Centralized AI provider management.
- Consistent AI generation across existing commands.
- Dashboard-based provider and model configuration.
- Documentation updated to cover all supported AI providers.
- Privacy documentation updated to explain local and cloud processing.

### Fixed
- Groq JSON-mode request compatibility.
- AI provider model discovery and connection handling.
- Dashboard webview registration and activation.
- TypeScript test compilation with required DOM type definitions.

## [0.0.1] - 2026-11-13

### Added
- Initial public release of DocFlowAI.
- System architecture, component, data-flow, sequence, and ER diagram generation.
- Project overview, technology-stack detection, API discovery, code-quality analysis, dependency analysis, and change-impact analysis.
- README, API, technical, onboarding, and current-file documentation generation.
- Selected-code explanation, dependency tracing, and function documentation.
- Code-improvement suggestions and complete documentation bundle generation.
- Architecture refresh and activity-log commands.
