# Linear GitHub Agent

A TypeScript server application that integrates Linear's Agents API with GitHub Codespaces to automatically create development environments for Linear issues.

## Features

- 🚀 **Automatic Codespace Creation**: Responds to Linear agent requests by spinning up GitHub Codespaces
- 📋 **Issue Management**: Automatically marks Linear issues as "In Progress" and provides status updates
- 🔗 **Seamless Integration**: Attaches Codespace links directly to Linear issues
- ⚙️ **Configurable Setup**: Customizable devcontainer configuration with Claude Desktop preparation
- 🔒 **Secure**: Webhook signature verification and proper authentication
- 📊 **Monitoring**: Health checks, logging, and status endpoints

## Architecture

```
Linear Issue → Agent Request → Webhook → TypeScript Server → GitHub Codespace → Claude Desktop Setup
     ↑                                           ↓
     └─── Status Updates & Attachments ←────────┘
```

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- TypeScript
- Linear account with Agents API access
- GitHub account with Codespaces enabled
- Repository with GitHub Codespaces permissions

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd linear-github-agent
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

### Configuration

#### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `LINEAR_API_KEY` | Your Linear API key | `lin_api_...` |
| `GITHUB_TOKEN` | GitHub Personal Access Token with codespace permissions | `ghp_...` |
| `WEBHOOK_SECRET` | Secret for webhook signature verification | `your-secure-secret` |

#### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `LOG_LEVEL` | `info` | Logging level |
| `DEFAULT_CODESPACE_MACHINE` | `standardLinux32gb` | Default Codespace machine type |
| `CODESPACE_IDLE_TIMEOUT_MINUTES` | `30` | Codespace idle timeout |
| `IN_PROGRESS_STATE_NAMES` | `In Progress,Started,Working` | Linear states to mark as in-progress |

### Setup Instructions

#### 1. Linear Setup

1. **Get your Linear API key:**
   - Go to Linear Settings → API
   - Create a new Personal API Key
   - Copy the key to your `.env` file

2. **Configure team repository:**
   - In Linear, go to Team Settings → Git
   - Set up GitHub repository integration
   - Ensure the repository path is correctly configured

3. **Set up webhook:**
   - Go to Linear Settings → API → Webhooks
   - Create a new webhook pointing to your server: `https://your-server.com/webhook/linear`
   - Set the secret to match your `WEBHOOK_SECRET`
   - Enable "Agent Request" events

#### 2. GitHub Setup

1. **Create Personal Access Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Create a token with scopes: `repo`, `workflow`, `codespace`
   - Copy the token to your `.env` file

2. **Enable Codespaces:**
   - Ensure Codespaces are enabled for your repositories
   - Check that you have sufficient Codespace hours/storage

#### 3. Repository Setup

Ensure your repositories have or will have a `.devcontainer` directory. The agent will automatically create/update:
- `.devcontainer/devcontainer.json`: Container configuration
- `.devcontainer/setup-claude.sh`: Claude setup script

## Usage

### Development

```bash
# Start in development mode with auto-reload
npm run dev

# Or start with ts-node directly
npm run start:dev
```

### Production

```bash
# Build and start
npm run build
npm start
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with service status |
| `/status` | GET | Server status and configuration |
| `/webhook/linear` | POST | Linear webhook endpoint |
| `/agent/progress/:issueId` | GET | Get agent progress for an issue |

### Example Workflow

1. **Linear Issue Created**: A new issue is created in Linear
2. **Agent Request**: Linear sends an agent request webhook
3. **Immediate Response**: Server responds to Linear with "starting work" message
4. **Issue Update**: Issue is marked as "In Progress"
5. **Codespace Creation**: GitHub Codespace is created with proper configuration
6. **Environment Setup**: Devcontainer is configured with Claude integration
7. **Final Update**: Codespace link is attached to the Linear issue

## Development

### Project Structure

```
src/
├── handlers/
│   └── agent-request.ts    # Main orchestration logic
├── services/
│   ├── linear.ts          # Linear API integration
│   └── github.ts          # GitHub/Codespace management
├── types/
│   ├── linear.ts          # Linear API types
│   └── github.ts          # GitHub API types
├── utils/
│   ├── config.ts          # Configuration management
│   └── logger.ts          # Logging utilities
└── server.ts              # Express server setup
```

### Available Scripts

```bash
npm run build       # Build TypeScript to JavaScript
npm run dev         # Development mode with auto-reload
npm start           # Start production server
npm run start:dev   # Start with ts-node
npm run clean       # Remove build artifacts
npm run typecheck   # Type checking without build
```

### Adding Features

The architecture is designed for easy extension:

1. **New API integrations**: Add services in `src/services/`
2. **New webhook events**: Extend handlers in `src/handlers/`
3. **New endpoints**: Add routes in `src/server.ts`

## Future Enhancements

### Claude Integration

The current implementation prepares for future Claude Desktop integration:

- Environment variables for prompts and context
- Setup scripts in Codespaces
- Placeholder for bidirectional communication

### Planned Features

- Real-time progress updates from Codespace to Linear
- Claude tool call reporting
- Automatic task completion detection
- Custom devcontainer templates per team
- Advanced error recovery

## Deployment

### Using Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

### Using Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Environment Variables for Production

Remember to set all required environment variables in your deployment platform:

- `LINEAR_API_KEY`
- `GITHUB_TOKEN`
- `WEBHOOK_SECRET`
- `NODE_ENV=production`

## Troubleshooting

### Common Issues

1. **Webhook not receiving events:**
   - Check webhook URL is publicly accessible
   - Verify webhook secret matches
   - Check Linear webhook configuration

2. **Codespace creation fails:**
   - Verify GitHub token has codespace permissions
   - Check repository exists and is accessible
   - Ensure Codespaces are enabled for the repository

3. **Linear API errors:**
   - Verify API key is valid and has required permissions
   - Check team repository configuration
   - Ensure issue and team exist

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

Check health endpoint:
```bash
curl http://localhost:3000/health
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.