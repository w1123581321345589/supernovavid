# SupernovaVid - Autonomous YouTube Thumbnail Optimization SaaS

## Overview
SupernovaVid is a FULLY AUTONOMOUS YouTube thumbnail optimization system that extracts transcripts, generates AI thumbnails, runs A/B tests, and optimizes 4-5x daily until finding the winning thumbnail at 95% confidence. Features payment-gated signup with monthly subscriptions ($59 Launch for 10 campaigns/month, $149 Scale for unlimited).

## Current State
**Last Updated:** December 15, 2024

### Completed Features
- Full database schema (users, sessions, campaigns, campaign_thumbnails, optimization_runs, performance_snapshots, templates, thumbnails, ab_tests, test_variants, test_runs, activity_logs, analysis_jobs, hook_insights)
- Replit Auth integration for user authentication
- Gemini AI service for thumbnail generation and video hook analysis
- YouTube OAuth integration for channel connection and thumbnail rotation
- Campaign pipeline (analyzing, generating, testing, optimizing, settled)
- Real-time WebSocket updates with live connection indicators
- Scheduler service running optimization cycles every 30 minutes
- Statistics calculator with 95% confidence interval
- **Video Analyzer** - Extracts viral moments from YouTube transcripts with:
  - Timestamps, hook titles, thumbnail text, viral scores
  - Strategy explanations for each hook
  - Direct "Generate Thumbnail" action per hook
- Payment-gated access with Stripe subscription integration
- Complete frontend:
  - Landing page with monthly pricing ($59/$149)
  - Dashboard with campaigns overview and YouTube connection
  - Video Analyzer page for viral hook extraction
  - CampaignCreate, CampaignList, CampaignDetail pages
  - Thumbnails page with generation capability
  - A/B Tests management
  - Templates library with search/filtering
  - Settings page

### User Preferences
- Monthly billing only (no annual option displayed)

### Pending Features
- End-to-end pipeline testing
- Edge case handling and error recovery
- Production-ready error messages

## Architecture

### Stack
- **Frontend:** React + Vite + TanStack Query + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Replit Auth with OpenID Connect
- **AI:** Google Gemini AI (via Replit integration)

### Project Structure
```
├── client/src/
│   ├── pages/           # Route components
│   ├── components/      # UI components
│   ├── hooks/           # Custom hooks (useAuth)
│   └── lib/             # Query client, utilities
├── server/
│   ├── index.ts         # Express server entry
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Database operations
│   ├── replitAuth.ts    # Auth middleware
│   └── gemini.ts        # AI generation service
└── shared/
    └── schema.ts        # Database schema & types
```

### Key Files
- `shared/schema.ts` - Database models and Zod schemas
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - Database CRUD operations
- `server/gemini.ts` - Gemini AI integration
- `client/src/App.tsx` - App entry with auth flow
- `client/src/hooks/useAuth.ts` - Auth hook

### API Endpoints
- `GET/POST /api/thumbnails` - Manage thumbnails
- `GET/POST /api/tests` - Manage A/B tests
- `GET/POST /api/templates` - Manage templates
- `GET/POST /api/generation-jobs` - AI generation jobs
- `GET /api/stats` - User statistics
- `GET /api/auth/user` - Current user info
- `POST /api/analyze` - Start video analysis job
- `GET /api/analyze/:jobId` - Get job status and hook insights
- `GET /api/analyze` - List user's analysis history

## Database Commands
- `npm run db:push` - Push schema changes to database
- `npm run dev` - Start development server

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key
- `GOOGLE_AI_API_KEY` - Gemini API key (via Replit integration)

## User Preferences
- Modern, clean UI following Linear/Canva design patterns
- SupernovaVid branding with Sparkles icon
- Dark/light mode support
