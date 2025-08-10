# Linear GitHub Agent

A TypeScript server application that integrates Linear's Agent API with GitHub Codespaces to automatically spin up development environments when Linear issues are assigned to the agent.

## Features

- 🔗 **Linear Integration**: Responds to Linear Agent requests via webhooks
- 🚀 **GitHub Codespaces**: Automatically creates and configures development environments
- 🤖 **Claude Integration**: Sets up Claude Code in Codespaces for AI-assisted development
- 📝 **Real-time Updates**: Provides status updates back to Linear issues
- 🔒 **Secure**: Webhook signature verification and comprehensive error handling
- 📊 **Logging**: Structured logging for monitoring and debugging

## How It Works

1. **Webhook Trigger**: Linear sends an agent request via webhook
2. **Immediate Response**: Agent responds that work is starting
3. **Issue Update**: Marks the Linear issue as "In Progress"
4. **Repository Detection**: Extracts repository info from Linear team settings
5. **Codespace Creation**: Spins up a GitHub Codespace for the repository
6. **Environment Setup**: Configures devcontainer with Claude Code
7. **Link Attachment**: Attaches Codespace link to the Linear issue
8. **Ready Notification**: Notifies when the environment is ready

## Prerequisites

- Node.js 18+ and npm
- Linear account with Agent API access
- GitHub account with Codespaces access
- Required API keys (see Environment Variables)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd linear-github-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `LINEAR_API_KEY` | Linear API key for your workspace | ✅ |
| `GITHUB_TOKEN` | GitHub Personal Access Token with Codespaces scope | ✅ |
| `WEBHOOK_SECRET` | Secret for verifying Linear webhook signatures | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |
| `NODE_ENV` | Environment (development/production) | ❌ |
| `DEFAULT_CODESPACE_MACHINE` | Default Codespace machine type | ❌ |
| `CODESPACE_IDLE_TIMEOUT_MINUTES` | Auto-stop timeout for Codespaces | ❌ |

## Usage

### Development

```bash
# Start in development mode with hot reload
npm run dev

# Or start with ts-node
npm run start:dev
```

### Production

```bash
# Build and start
npm run build
npm start
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Development mode with hot reload
- `npm start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run clean` - Clean build artifacts

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /status` - Application status and metrics
- `POST /webhook/linear` - Linear webhook endpoint (configured in Linear)
- `GET /agent/progress/:issueId` - Get agent progress for an issue
- `GET /codespaces` - List user's Codespaces
- `GET /codespaces/:name` - Get specific Codespace details

## Linear Setup

1. **Create an Agent** in your Linear workspace
2. **Configure webhook URL**: `https://your-domain.com/webhook/linear`
3. **Set webhook secret** in both Linear and your `.env` file
4. **Configure team repository** in Linear team settings

## GitHub Setup

1. **Generate Personal Access Token** with `codespaces` scope
2. **Configure repository access** for the repositories you want to use
3. **Set up devcontainer** in your repositories (optional - agent will create basic setup)

## Docker Deployment

```bash
# Build image
docker build -t linear-github-agent .

# Run container
docker run -p 3000:3000 --env-file .env linear-github-agent
```

## Development

### Project Structure

```
src/
├── handlers/          # Request handlers
├── services/          # External service integrations
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── server.ts          # Main server application
```

### Type Safety

This project uses strict TypeScript configuration with comprehensive type definitions for:
- Linear API responses and webhooks
- GitHub API interactions
- Configuration and environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper types
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Common Issues

**Webhook not receiving requests**
- Verify webhook URL is accessible
- Check Linear webhook configuration
- Ensure webhook secret matches

**Codespace creation fails**
- Verify GitHub token has Codespaces scope
- Check repository access permissions
- Ensure repository exists and is accessible

**TypeScript compilation errors**
- Run `npm run typecheck` for detailed errors
- Ensure all dependencies are installed
- Check tsconfig.json configuration

### Logs

Check application logs for detailed error information:
```bash
# Development
npm run dev

# Production (logs to console)
npm start
```

## Security

- Webhook signatures are verified using HMAC
- Environment variables for sensitive data
- Input validation on all endpoints
- Rate limiting recommended for production

## License

MIT License - see LICENSE file for details