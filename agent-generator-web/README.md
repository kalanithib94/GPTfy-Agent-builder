# GPTfy Agent Generator (Vercel)

Standalone Next.js app: **Salesforce OAuth** → **namespace-aware GPTfy metadata checks** → **use-case → Markdown spec** (optional: extend with OpenAI for full artifact generation).

## Features

- **Connect org** — Authorization Code flow (production or sandbox).
- **Connection check** — Tries object API names in order: unprefixed, `ccai__`, `ccai_qa__` (managed package vs unpackaged dev org).
- **Field checks** — Key suffixes on `AI_Prompt__c`, `AI_Agent__c`, `AI_Connection__c`, `AI_Agent_Skill__c` aligned with `scripts/Deploy-GptfyUseCasePipeline.ps1`.
- **Generator** — Use case + pipeline parameters → **full bundle**: Apex class + meta.xml, `*_PromptCommand.json`, `AGENT_SYSTEM_PROMPT.txt`, `AGENT_DESCRIPTION.txt`, `INTENTS_CONFIG.md`, `FullConfig_AnonymousApex.apex` stub, `DEPLOY.md`.
- **ZIP export** — Repo-style layout under `use-cases/<DeveloperName>/` and `force-app/main/default/classes/`.
- **OpenAI** — If `OPENAI_API_KEY` is set, generates implementation via `gpt-4o-mini` (override with `OPENAI_MODEL`). Otherwise uses a **template** handler with a `health_Check_Agent` skill you can extend.

## Salesforce Connected App

1. Setup → App Manager → New Connected App.
2. Enable OAuth, callback URL:  
   `https://<your-vercel-domain>/api/salesforce/callback`  
   (local: `http://localhost:3000/api/salesforce/callback`).
3. Selected OAuth scopes: **Access and manage your data (api)**, **Perform requests at any time (refresh_token, offline_access)**, **Access your basic information (openid)**.
4. Copy **Consumer Key** → `SALESFORCE_CLIENT_ID`, **Consumer Secret** → `SALESFORCE_CLIENT_SECRET`.

### User / profile for **Publish to org**

The signing-in user must be allowed to:

- Use the **Metadata API** to deploy Apex (e.g. **Modify Metadata Through Metadata API Functions**, or a profile like System Administrator).
- **Author Apex** (or deploy to an org that allows your change set path).
- Create/update **GPTfy** custom objects: `AI_Prompt__c`, `AI_Agent__c`, `AI_Agent_Skill__c`, `AI_Agent_Intent__c`, `AI_Intent_Action__c`, `AI_Intent_Action_Detail__c`, plus read `AI_Connection__c` and `AI_Data_Extraction_Mapping__c`.

If Metadata deploy fails, use **Generate only** + **Download ZIP** and deploy with Salesforce CLI from your repo.

## API (server)

| Route | Purpose |
|-------|---------|
| `POST /api/pipeline/run` | Body = same as generate form. Generates bundle + deploys to connected org. |
| `POST /api/deploy/to-org` | Body `{ bundle }` — deploys an existing bundle JSON. |
| `POST /api/generate/full` | Generate bundle only (no org writes beyond validation cache). |

## Environment variables (Vercel / `.env.local`)

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | **≥ 32 characters** (required by iron-session). |
| `SALESFORCE_CLIENT_ID` | Connected App consumer key. |
| `SALESFORCE_CLIENT_SECRET` | Connected App secret (server only). |
| `SALESFORCE_CALLBACK_URL` | Must exactly match Connected App callback URL. |
| `OPENAI_API_KEY` | Optional; not used by default (extend `/api/generate/preview` if needed). |

## Local development

```bash
cd agent-generator-web
cp .env.example .env.local
# fill variables
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel via GitHub

1. **Push** this repository to GitHub (this monorepo includes `agent-generator-web/` at a subpath).
2. In [Vercel](https://vercel.com) → **Add New…** → **Project** → **Import** the GitHub repo that contains this project.
3. Under **Configure Project**, set **Root Directory** to **`agent-generator-web`** (Required — the Next.js app is not at the repo root).
4. Add **Environment Variables** (Production): `SESSION_SECRET`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_CALLBACK_URL` (your `https://…vercel.app/api/salesforce/callback`), optional `OPENAI_API_KEY`.
5. **Deploy**. Every push to the connected branch triggers a new deployment.
6. If you already had a CLI-linked project, open that project → **Settings** → **Git** → **Connect Git Repository** to attach the same repo and root directory instead of creating a duplicate.
7. Update the Salesforce **Connected App** callback URL to match production.

## Security notes (public app)

- Tokens are stored in an **encrypted HTTP-only session cookie** (iron-session), not in browser localStorage.
- **Refresh tokens** are powerful: use a dedicated Connected App, consider **IP restrictions** or **per-org** Connected Apps for production.
- Add **rate limiting** (e.g. Vercel Firewall, Upstash) before wide launch.
- **Publish to org** deploys Apex and GPTfy records in Salesforce; review permissions and test in a sandbox first.

## Namespace behavior

| Org type | Typical object API name |
|----------|-------------------------|
| Unpackaged / scratch (your dev org) | `AI_Prompt__c`, … |
| Managed package subscriber | `ccai__AI_Prompt__c` or `ccai_qa__AI_Prompt__c` |

The validator attempts describes in that order until one succeeds, then checks field API names by **suffix** so `ccai__Prompt_Command__c` and `Prompt_Command__c` both match.

## Related repo docs

- `docs/SALES_TASK_CAPTURE_BASELINE.md`
- `docs/COMPLETE_USE_CASE_GENERATION_GUIDE.md`
- `scripts/Deploy-GptfyUseCasePipeline.ps1`
