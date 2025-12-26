# AI Live Chat Agent - Spur Assignment

A production-ready full-stack AI customer support live chat system built with Node.js, TypeScript, Express, SvelteKit, PostgreSQL, and Google Gemini.

## 🏗️ Architecture Overview

### Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Frontend**: SvelteKit (Svelte 5)
- **Database**: PostgreSQL (or SQLite for local dev)
- **ORM**: Prisma
- **Cache**: Redis (optional)
- **LLM**: Google Gemini

### Project Structure

```
spur-assignment/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry point
│   │   ├── routes/
│   │   │   └── chat.ts           # Chat API endpoint
│   │   ├── db/
│   │   │   └── prisma.ts         # Prisma client singleton
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   │   ├── index.ts      # LLM provider factory
│   │   │   │   └── gemini.ts     # Gemini implementation
│   │   │   └── redis.ts          # Optional Redis cache wrapper
│   │   ├── middleware/
│   │   │   └── rateLimit.ts      # Rate limiting middleware
│   │   └── utils/
│   │       └── sanitize.ts       # Input sanitization utilities
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── .env.example              # Environment variables template
├── frontend/
│   ├── src/
│   │   └── routes/
│   │       └── +page.svelte      # Chat UI component
│   └── svelte.config.js          # SvelteKit configuration
├── DEPLOYMENT.md                 # Detailed deployment guide
├── QUICK_DEPLOY.md               # Quick deployment steps
├── DEPLOYMENT_CHECKLIST.md       # Pre-deployment checklist
└── README.md                     # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL (or use SQLite for local development)
- Redis (optional, for caching)
- Google Gemini API key

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/spur_chat?schema=public"
   # OR for SQLite:
   # DATABASE_URL="file:./dev.db"
   
   GEMINI_API_KEY=your_gemini_api_key_here
   
   REDIS_URL=redis://localhost:6379  # Optional
   PORT=4000
   ```

4. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

5. **Run database migrations:**
   ```bash
   npm run prisma:migrate
   ```

   This will create the `conversations` and `messages` tables.

6. **Start the development server:**
   ```bash
   npm run dev
   ```

   The backend API will be available at `http://localhost:4000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173` (default Vite port)

## 📡 API Endpoints

### POST `/chat/message`

Send a chat message and receive an AI response. Protected by rate limiting (20 requests per minute per IP).

**Request:**
```json
{
  "message": "What is your return policy?",
  "sessionId": "optional-existing-session-id"
}
```

**Response:**
```json
{
  "reply": "We offer a 30-day return & refund policy...",
  "sessionId": "clx1234567890abcdef"
}
```

**Error Responses:**
- `400`: Invalid request (empty message, too long, etc.)
- `429`: Too many requests (rate limit exceeded)
- `500`: Internal server error (graceful error message, no stack traces)

### GET `/chat/history/:sessionId`

Retrieve conversation history for a given session.

**Response:**
```json
{
  "messages": [
    {
      "id": "msg123",
      "sender": "user",
      "text": "Hello",
      "timestamp": "2024-01-01T12:00:00Z",
      "reaction": null
    },
    {
      "id": "msg124",
      "sender": "ai",
      "text": "Hi! How can I help you?",
      "timestamp": "2024-01-01T12:00:01Z",
      "reaction": "thumbs_up"
    }
  ]
}
```

### POST `/chat/message/:messageId/reaction`

Update the reaction on an AI message.

**Request:**
```json
{
  "reaction": "thumbs_up" | "thumbs_down" | null
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg124",
  "reaction": "thumbs_up"
}
```

### GET `/health`

Health check endpoint (exempt from rate limiting). Returns detailed status of database and Redis connectivity.

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "enabled",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Status Codes:**
- `200`: All systems operational
- `503`: Service degraded (database disconnected)

**Fields:**
- `status`: "ok" | "degraded" | "error"
- `database`: "connected" | "disconnected"
- `redis`: "enabled" | "disabled"
- `timestamp`: ISO 8601 timestamp

## 🗄️ Database Schema

### Conversation
- `id` (cuid): Primary key
- `createdAt`: Timestamp

### Message
- `id` (cuid): Primary key
- `conversationId`: Foreign key to Conversation
- `sender`: "user" | "ai"
- `text`: Message content
- `createdAt`: Timestamp
- `reaction`: "thumbs_up" | "thumbs_down" | null (optional)

## 🤖 LLM Integration

### Gemini Provider

The system uses Google's Gemini 2.5 Flash model for generating responses. The implementation includes:

- **System Prompt**: Defines the agent as a helpful e-commerce support agent with FAQ knowledge
- **FAQ Domain Knowledge**:
  - Shipping: Worldwide, 5–7 business days
  - Returns: 30-day return & refund policy
  - Support Hours: 9am–6pm IST, Monday–Saturday
  - Free Shipping: USA orders over $50

- **Prompting Approach**:
  - System prompt sets context and tone
  - Conversation history is formatted as alternating User/Assistant messages
  - Last 20 messages are included for context
  - History is truncated if it exceeds token limits (4,000 input tokens)
  - Responses are capped at 500 output tokens

- **Error Handling & Retry Logic**:
  - Automatic retry with exponential backoff (up to 3 attempts)
  - Non-retryable errors (authentication, validation) fail immediately
  - API failures result in graceful fallback messages
  - 30-second timeout per request
  - No stack traces or internal errors exposed to clients
  - Comprehensive logging for debugging

## 🔄 Redis Caching (Optional)

Redis caching is implemented as an optional layer:

- **Auto-detection**: Only connects if `REDIS_URL` is set
- **No hard dependency**: Application continues without Redis
- **Cache Strategy**: Last 20 messages cached per conversation (1-hour TTL)
- **Failure tolerance**: Cache failures don't affect core functionality

To enable Redis, simply set the `REDIS_URL` environment variable. The application will automatically connect and use it for caching.

## 🛡️ Robustness & Error Handling

The system handles various failure scenarios gracefully:

- **Empty Messages**: Validation error returned to client
- **Very Long Messages**: Truncated to 5,000 characters
- **Network Failures**: Friendly UI error messages with retry suggestions
- **LLM Timeouts**: 30-second timeout with graceful fallback message
- **LLM Retry Logic**: Automatic retry with exponential backoff for transient failures
- **Database Issues**: Error logged, friendly response sent, graceful degradation
- **Redis Failures**: Silent fallback, continues without cache
- **Rate Limiting**: Prevents abuse with per-IP limits (20 requests/minute for chat, 100/15min for general API)

All errors are logged server-side but never expose stack traces or internal details to clients.

## 🎨 Frontend Features

The SvelteKit chat UI includes:

- **Message Display**: Clear distinction between user and AI messages
- **Real-time Updates**: Immediate message rendering
- **Typing Indicator**: Shows "Agent is typing..." during generation
- **Session Persistence**: Session ID stored in localStorage
- **Conversation History**: Automatically loads previous messages when session is restored
- **Message Reactions**: Thumbs up/down feedback on AI responses
- **Auto-scroll**: Automatically scrolls to latest message
- **Error Handling**: User-friendly error messages with timeout handling
- **Input Validation**: Client-side validation for message length (max 5000 characters)
- **Responsive Design**: Modern, clean UI with gradient styling

## 🔧 Development Commands

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🐳 Docker Support

The project includes Docker support for easy deployment and local development.

### Quick Start with Docker Compose

1. **Set environment variables:**
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```

2. **Start all services:**
   ```bash
   docker-compose up
   ```

   This will start:
   - PostgreSQL database on port 5432
   - Redis cache on port 6379
   - Backend API on port 4000
   - Frontend on port 3000

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

### Docker Compose Services

- **postgres**: PostgreSQL 15 database
- **redis**: Redis 7 cache
- **backend**: Node.js backend with Prisma migrations
- **frontend**: SvelteKit frontend served via `serve`

### Building Individual Services

**Backend:**
```bash
cd backend
docker build -t spur-chat-backend .
docker run -p 4000:4000 -e GEMINI_API_KEY=your_key -e DATABASE_URL=your_db_url spur-chat-backend
```

**Frontend:**
```bash
cd frontend
docker build -t spur-chat-frontend .
docker run -p 3000:3000 spur-chat-frontend
```

### Environment Variables for Docker

The `docker-compose.yml` uses environment variables from your shell. Make sure to set:
- `GEMINI_API_KEY`: Your Google Gemini API key

Database credentials are configured in `docker-compose.yml` but can be overridden via environment variables.

## 📝 Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL or SQLite connection string |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `REDIS_URL` | No | Redis connection string (optional) |
| `PORT` | No | Server port (default: 4000) |
| `CORS_ORIGIN` | No | Comma-separated list of allowed origins (e.g., `http://localhost:5173,https://example.com`). If omitted, allows all origins (development only) |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_API_URL` | No | Backend API URL (default: `http://localhost:4000`). Required for production deployment. |

**Note**: In SvelteKit, environment variables prefixed with `PUBLIC_` are exposed to the client. Set this to your production backend URL when deploying.

## 🔐 Security Considerations

- **No hard-coded secrets**: All sensitive values in environment variables
- **Input validation**: All inputs validated using Zod
- **Input sanitization**: User messages are HTML-escaped to prevent XSS attacks
- **Error sanitization**: No stack traces or internal errors exposed
- **Message length limits**: Prevents abuse and token exhaustion
- **Rate Limiting**: Per-IP rate limiting to prevent abuse and DDoS
- **CORS**: Configurable via `CORS_ORIGIN` environment variable (allows all origins in development if not set)

## 🎯 Trade-offs & Design Decisions

### Trade-offs Made

1. **Simple History Format**: Conversation history is formatted as plain text rather than structured messages. This is simpler but less efficient than sending structured message arrays to the LLM API.

2. **Token Estimation**: Using a simple 4 characters = 1 token estimation rather than actual tokenization. This is faster but less accurate.

3. **Session in localStorage**: Frontend session persistence uses localStorage. This works well for single-device usage but doesn't sync across devices.

4. **Redis Optional**: Redis caching is nice-to-have. The system works without it but misses potential performance gains.

5. **Single Conversation Model**: Each conversation is isolated. No user authentication or multi-tenant support.

6. **In-Memory Rate Limiting**: Rate limiting uses in-memory storage (via express-rate-limit). For production at scale, consider Redis-backed rate limiting.

### If I Had More Time...

1. **User Authentication**: Add JWT-based auth to support multiple users and user-specific conversation history

2. **WebSocket Support**: Real-time bidirectional communication instead of polling/polling-based requests

3. **Streaming Responses**: Stream LLM responses token-by-token for better UX

4. **Admin Dashboard**: View all conversations, analytics, and system health

5. **Monitoring & Logging**: Integration with services like Sentry, DataDog, or CloudWatch

6. **Tests**: Comprehensive unit and integration tests

7. **Redis-backed Rate Limiting**: Use Redis for distributed rate limiting across multiple server instances

8. **Multi-LLM Support**: Easy switching between Gemini, OpenAI, Claude, etc. (LLM abstraction is already in place)

9. **Vector Search**: Semantic search over FAQ/knowledge base for better context

10. **Message Search**: Full-text search across conversation history

11. **Export Conversations**: Allow users to export their chat history

12. **Typing Indicators for Users**: Show when user is typing (useful for WebSocket implementation)

### ✅ Recently Implemented

The following features have been implemented:

- ✅ **Rate Limiting**: Per-IP rate limiting with express-rate-limit (20 req/min for chat, 100/15min for general API)
- ✅ **Retry Logic**: Exponential backoff retry for LLM API calls (up to 3 attempts)
- ✅ **Conversation History Loading**: REST API endpoint and frontend integration to load previous messages
- ✅ **Message Reactions**: Users can provide thumbs up/down feedback on AI responses
- ✅ **Docker Support**: Dockerfiles and docker-compose.yml for easy deployment and local development
- ✅ **Enhanced Health Check**: Health endpoint now includes database and Redis connectivity status
- ✅ **Environment Template**: `.env.example` file created for easier setup
- ✅ **CORS Configuration**: Configurable via `CORS_ORIGIN` environment variable
- ✅ **Input Sanitization**: HTML escaping for user messages to prevent XSS attacks
- ✅ **Static Adapter**: Frontend now uses `adapter-static` for consistent Docker builds

## 📋 Pending Items / Known Issues

### TypeScript Type Safety

1. **Type Assertions for Gemini API**: The Gemini API `generateContent` method uses a type assertion (`as any`) due to TypeScript type definition mismatches in the SDK.
   - **Location**: `backend/src/services/llm/gemini.ts`
   - **Status**: ✅ Fixed - Build passes, code works correctly at runtime
   - **Impact**: None - functionality is correct, just bypasses TypeScript checking for this call

2. **Type Assertions for Prisma Reaction Field**: The code uses `as any` type assertions for the `reaction` field due to Prisma type generation timing issues.
   - **Location**: `backend/src/routes/chat.ts` (lines 61, 92, 98)
   - **Status**: ⚠️ Works but could be improved with proper Prisma types
   - **Note**: This is a known issue with Prisma Client regeneration - the field exists in the schema and works at runtime

### Production Readiness

1. **Frontend Docker Build**: ✅ **COMPLETED** - Now uses `@sveltejs/adapter-static` for consistent build output across all platforms.
   - **Status**: ✅ Done
   - **Implementation**: Explicitly configured adapter-static with SPA fallback mode for Docker and static deployments
   - **Build**: Verified - frontend builds successfully with static adapter

2. **Environment Variables Template**: ✅ **COMPLETED** - Created `.env.example` file in backend directory with all required variables.
   - **Status**: ✅ Done

### Testing

1. **No Tests**: The project currently has no unit or integration tests.
   - **Status**: Would add significant value for production readiness

2. **End-to-End Testing**: No E2E tests to verify the full chat flow.

### Documentation

1. **API Documentation**: Consider adding OpenAPI/Swagger documentation for the API endpoints.

2. **Architecture Diagrams**: Visual diagrams would help understand the system architecture.

### Performance & Monitoring

1. **Logging**: Basic console logging exists but could benefit from structured logging (e.g., Winston, Pino).

2. **Metrics**: No application metrics or monitoring setup.

3. **Health Checks**: ✅ **COMPLETED** - Enhanced health check endpoint now includes database and Redis connectivity status.
   - **Status**: ✅ Done
   - **Implementation**: `/health` endpoint returns detailed status for database and Redis

### Security

1. **CORS Configuration**: ✅ **COMPLETED** - Now configurable via `CORS_ORIGIN` environment variable.
   - **Status**: ✅ Done
   - **Implementation**: Set `CORS_ORIGIN` to comma-separated list of allowed origins for production
   - **Default**: Allows all origins if not set (safe for development)

2. **Rate Limiting**: Uses in-memory rate limiting. For distributed systems, Redis-backed rate limiting would be better.

3. **Input Sanitization**: ✅ **COMPLETED** - User messages are now HTML-escaped to prevent XSS attacks.
   - **Status**: ✅ Done
   - **Implementation**: All user messages are sanitized before storage using HTML entity encoding

## 📄 License

This project is created for a take-home assignment.

## 🤝 Contributing

This is an assignment project. Not accepting contributions at this time.
