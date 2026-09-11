# Architecture

## Tech Stack
* **Frontend**: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
* **Backend**: Next.js App Router (Server Actions / API routes)
* **Database**: PostgreSQL (via Supabase)
* **Authentication**: GitHub OAuth
* **Deployments**: Deployment Provider Abstraction (initial implementation via free-tier infrastructure)

## Directory Structure
```
deployx/
├── app/                 # Next.js App Router
├── components/          # React components
├── lib/                 # Core utilities and business logic
├── db/                  # Database schema and migrations
├── docs/                # Project documentation
└── public/              # Static assets
```
