# SupernovaVid

Autonomous YouTube Thumbnail Optimization SaaS

SupernovaVid automatically optimizes your YouTube thumbnails to maximize clicks and views. The platform uses AI to analyze videos, generate thumbnails, and run continuous A/B tests directly on YouTube until finding the winning thumbnail at 95% statistical confidence.

## Features

### Video Analyzer
- Extract viral hooks from any YouTube video
- Get timestamps, hook titles, thumbnail text suggestions
- AI-powered strategy explanations for each viral moment

### AI Thumbnail Generation
- Create click-worthy thumbnails based on proven viral patterns
- Multiple style options and customization
- Batch generation for A/B testing

### Autonomous A/B Testing
- Runs 4-5x daily automatically
- Tests thumbnails directly on your YouTube videos
- Stops when reaching 95% statistical confidence
- No manual intervention required

### Real-time Analytics
- Track CTR improvements across all campaigns
- Monitor test performance and winner selection
- View historical data and trends

## Pricing

- **Launch Plan** - $59/month: 10 campaigns per month
- **Scale Plan** - $149/month: Unlimited campaigns

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Gemini for video analysis and content generation
- **Auth**: Replit Auth (OpenID Connect)
- **Payments**: Stripe

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Stripe account (for payments)
- Google AI API key (for Gemini)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/supernovavid.git
cd supernovavid
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
DATABASE_URL=your_postgres_connection_string
SESSION_SECRET=your_session_secret
```

4. Push database schema
```bash
npm run db:push
```

5. Start the development server
```bash
npm run dev
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities
├── server/                 # Express backend
│   ├── routes.ts          # API endpoints
│   ├── storage.ts         # Database operations
│   ├── gemini.ts          # AI integration
│   └── youtube.ts         # YouTube API
├── shared/                 # Shared code
│   └── schema.ts          # Database schema & types
└── scripts/               # Utility scripts
```

## API Endpoints

- `GET/POST /api/thumbnails` - Manage thumbnails
- `GET/POST /api/campaigns` - Manage A/B test campaigns
- `POST /api/analyze` - Start video analysis job
- `GET /api/analyze/:jobId` - Get analysis job status
- `GET /api/stats` - User statistics
- `GET /api/auth/user` - Current user info

## License

MIT

## Support

For support, please open an issue on GitHub or contact support@supernovavid.com
