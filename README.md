# DeployX

**DeployX** is a modern, full-stack developer deployment platform inspired by Vercel and Netlify. It simulates the experience of a world-class PaaS (Platform as a Service) by providing GitHub integration, deployment pipelines, mock builds, environment variable management, and real-time build logs.

![DeployX Dashboard](https://via.placeholder.com/800x400?text=DeployX+Dashboard)

## Features

- **GitHub OAuth Integration:** Securely authenticate users and directly access their repositories.
- **Repository Import:** Browse and import repositories straight from GitHub.
- **Framework Detection:** Automatically detects frameworks (Next.js, React, Vite) and pre-fills build/install commands.
- **Simulated CI/CD Pipeline:** Watch your project progress through a sophisticated state engine (`QUEUED` -> `CLONING` -> `BUILDING` -> `READY`) over a 30-second pipeline.
- **Terminal UI for Build Logs:** Watch build logs stream into a custom terminal UI in real-time.
- **Automatic Webhooks:** Set up your repo to push to DeployX, and our webhook endpoint automatically parses the commit and triggers a new build.
- **Preview Deployments:** Pushes to `main` create Production deployments, while pushes to other branches create Preview deployments.
- **Instant Rollbacks:** One-click rollback to a previous, successful deployment.
- **Environment Variables:** Securely store and manage environment variables per project.
- **Analytics Dashboard:** Beautiful, mocked line-charts (via Recharts) showing 30-day visitor and pageview traffic.
- **AI Assistant:** A sleek floating AI widget providing context-aware help regarding the platform.

## Architecture

DeployX is built with a modern, high-performance stack designed for zero mandatory spending during its MVP phase:

- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
- **Authentication:** [NextAuth (Auth.js Beta)](https://authjs.dev/) via GitHub OAuth.
- **Database:** [PostgreSQL (Supabase)](https://supabase.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **Charts:** [Recharts](https://recharts.org/)

## Local Development

### Prerequisites

1. Node.js 18+
2. A Supabase project (PostgreSQL)
3. A GitHub OAuth App

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="generate-a-strong-secret-key-here"

# GitHub OAuth
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"

# Supabase
SUPABASE_URL="your_supabase_project_url"
SUPABASE_ANON_KEY="your_supabase_anon_key"
```

### Database Setup

Run the SQL script located in `db/schema/0000_initial.sql` in your Supabase SQL editor to create all the necessary tables (users, projects, deployments, build logs, webhooks, etc.).

### Run the Server

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to access the DeployX dashboard.

## Future Roadmap

While DeployX currently uses a `LocalMockProvider` to safely simulate deployments and logs without executing arbitrary code, the system is designed around a strict `DeploymentProvider` interface. In a production environment, this can be seamlessly swapped out with a real infrastructure provider (e.g., AWS Fargate, Kubernetes, or Docker) to execute real, isolated container builds.

---
*Built as a flagship software engineering portfolio project.*
