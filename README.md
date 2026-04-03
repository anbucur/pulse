# Pulse - Modern Dating & Social App

A full-featured dating and social networking application with rich profiles, AI-powered features, and privacy-focused communication.

## Features

### Rich User Profiles
- **Basic Info**: Display name, age, gender, bio, location
- **Physical Attributes**: Height, body type, hair/eye color, ethnicity
- **Sexual Profile**: Orientation, relationship style, role/position, experience level
- **Kink Profile**: Interests with levels, limits, dynamics
- **Lifestyle**: Education, occupation, habits (smoking, drinking, exercise, diet)
- **Personality**: MBTI, love languages, attachment style, communication style
- **Interests & Tags**: Hobbies, interests, searchable tags
- **Privacy Controls**: Per-field privacy settings (public/connections/private)
- **Verification**: Photo-based verification system
- **Broadcast**: Share current vibe with nearby users

### Five Killer Features

1. **Compatibility Matrix** - AI-powered multi-dimensional compatibility scoring with radar chart visualization
2. **Consent Protocol** - Structured boundaries sharing before meeting
3. **Vibe Check** - Temporal mood/intent status on profiles
4. **Encrypted Burner Chat** - Temporary E2E chat rooms with auto-destruct
5. **Social Proof References** - Anonymous post-date references

## Tech Stack

### Backend
- Node.js + Express - REST API server
- PostgreSQL - Primary database
- MinIO - S3-compatible object storage
- Valkey (Redis) - Caching and session management
- Meilisearch - Full-text search
- WebSocket - Real-time chat
- JWT + bcrypt - Authentication

### Frontend
- React + TypeScript - UI framework
- Vite - Build tool
- Tailwind CSS - Styling
- Recharts - Data visualization
- Lucide Icons - Icon set

### Infrastructure
- Docker Compose - Local development
- Nginx - Reverse proxy

## Quick Start

### Using Docker Compose (Recommended)

1. Clone and configure:
```bash
cp .env.example .env
# Edit .env with your configuration
```

2. Start all services:
```bash
docker-compose up -d
```

3. Access the app at http://localhost:3000

### Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Start dependencies (PostgreSQL, Redis, MinIO, Meilisearch)

3. Run database migrations:
```bash
npm run db:migrate
```

4. Start the development server:
```bash
npm run dev
```

## Environment Variables

See `.env.example` for all required environment variables.

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Main application |
| postgres | 5432 | PostgreSQL database |
| minio | 9000, 9001 | Object storage (API, Console) |
| valkey | 6379 | Redis-compatible cache |
| meilisearch | 7700 | Full-text search |
| nginx | 80, 443 | Reverse proxy |

## License

Proprietary - All rights reserved
