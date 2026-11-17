# Syntra

*Connect the work. Automate the process.*

Syntra is a **concept / demo** visual operations platform. All data is fictional (`src/lib/data`); there is no backend, authentication, billing or real integrations.

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Framer Motion · Lucide

## Run
```bash
npm install
npm run dev     # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

## Structure
- `src/app/(app)/*` — routes: dashboard, workflows, workflows/[id], processes, automations, analytics, team, settings
- `src/components/workflow/*` — the interactive Workflow Canvas (nodes, connectors, detail panel)
- `src/components/shell/*` — responsive app shell and page header
- `src/lib/data/*`, `src/lib/types.ts` — typed demo data; swap for real data sources later
