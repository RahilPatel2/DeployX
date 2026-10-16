# Cloudflare Pages Integration Security & Least-Privilege Guide

**Document Version:** 1.0.0  
**Integration Type:** Cloudflare REST API v4  
**Primary Resource:** Cloudflare Pages Projects & Direct Deployments  
**Security Boundary:** Server-Only Privileged Client

---

## 1. Principle of Minimum Privilege (Least Privilege)

DeployX integrates with Cloudflare Pages to orchestrate project creation and asset deployments for user projects. The platform requires only narrow, scoped permissions.

### Recommended API Token Setup:
Create a custom token at [Cloudflare Dashboard -> My Profile -> API Tokens](https://dash.cloudflare.com/profile/api-tokens):

| Setting | Required Value | Rationale |
| :--- | :--- | :--- |
| **Token Name** | `DeployX-Platform-Pages-Token` | Clear identification in security audits |
| **Permissions** | `Account` -> `Cloudflare Pages` -> `Edit` | Required to create projects, upload assets, and query status |
| **Account Resources** | `Include` -> `Specific account` -> `<Your Cloudflare Account>` | Strict scoping to only the designated account |
| **Zone Resources** | `None` | DeployX does not require access to DNS zones or zone settings |
| **User Resources** | `None` | No access to user profile or billing |
| **Client IP Address Filtering** | (Optional) Egress IP of hosting server | Restricts token usage to server IP |

> [!CAUTION]
> Never use your Cloudflare Global API Key! Global API keys have unrestricted administrative access across your entire Cloudflare account, cannot be scoped, and cannot be easily rotated without invalidating all other integrations.

---

## 2. Server-Side Credential Isolation

1. **Server-Only Execution:**
   - The Cloudflare client (`lib/cloudflare/client.ts`) enforces `typeof window === "undefined"` at module evaluation. If accidentally imported into client components, execution halts immediately with a clear runtime assertion.
2. **Zero Token Exposure to User Code:**
   - Deployed user projects are hosted on Cloudflare's edge network. They do not have access to the DeployX control plane's `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID`.
   - Build scripts and framework detectors run in sandboxed or isolated execution contexts without access to parent environment secrets.
3. **Automated Secret Redaction in Error Messages:**
   - Any raw HTTP error message, headers, or exception trace returned from `api.cloudflare.com` is scrubbed through `redactSensitiveData` before being logged to console or returned to the user.

---

## 3. Deployment Safety & Idempotency

1. **Project Name Sanitization:**
   - Repository names are sanitized to RFC-1035 labels (lowercase alphanumeric, hyphenated, no leading/trailing hyphens, maximum 58 characters) to guarantee valid subdomain provisioning on `*.pages.dev`.
2. **Deployment State Transitions:**
   - Deployments follow an idempotent, monotonic state machine (`QUEUED` -> `BUILDING` -> `DEPLOYING` -> `READY` / `ERROR`). Terminal states cannot be overwritten.
3. **Live URL Extraction:**
   - Live URLs are parsed directly from validated Cloudflare API responses (`result.canonical_deployment.url` or `result.subdomain.pages.dev`). DeployX never hallucinates or invents fake deployment URLs.
