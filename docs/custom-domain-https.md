# Custom Domain Routing, HTTPS & DNS Configuration Guide

**Document Version:** 1.0.0  
**Transport Security:** TLS 1.3 / HTTPS Strict Transport Security (HSTS)  
**Target Canonical Pattern:** `https://deployx.yourdomain.com` (or `https://yourdomain.com`)

---

## 1. Domain Routing Strategy

DeployX distinguishes between two domain tiers:

1. **DeployX Control Plane Domain:**
   - The administration dashboard where developers log in, import repositories, and inspect logs.
   - Example: `https://deployx.yourdomain.com` or `https://app.yourdomain.com`.
   - Requires valid GitHub OAuth callback registration: `${NEXT_PUBLIC_APP_URL}/api/integrations/github/callback`.

2. **Deployed User Application Domains:**
   - Domains pointing to projects built and published by DeployX.
   - Handled directly by Cloudflare Pages (`*.pages.dev` or custom domains registered per project via Cloudflare DNS).

---

## 2. DNS Record Setup (Control Plane)

Depending on where the DeployX control plane is hosted, configure the following DNS records in your domain registrar / DNS manager (Cloudflare, AWS Route53, Namecheap, GoDaddy):

### Option A: Subdomain Setup (`deployx.yourdomain.com`) — Recommended
- **Record Type:** `CNAME`
- **Host / Name:** `deployx`
- **Target / Value:** `<your-hosting-target>` (e.g., `cname.vercel-dns.com` on Vercel, or `<app>.railway.app` on Railway)
- **TTL:** `Auto` (or `300` seconds)
- **Proxy Status (Cloudflare DNS):** `Proxied` (Orange Cloud) or `DNS Only`

### Option B: Apex Domain Setup (`yourdomain.com` + `www`)
- **Apex Record:** `A` or `ALIAS` / `ANAME` record pointing to the hosting provider's IP addresses.
- **WWW Record:** `CNAME` pointing to the apex domain or host target.
- **Redirect Rule:** Always choose one canonical version (e.g. apex `https://yourdomain.com`) and configure a permanent 301 redirect for the other (`https://www.yourdomain.com` -> `https://yourdomain.com`) to prevent session cookie partitioning.

---

## 3. HTTPS & TLS Certificate Automation

1. **Automatic Certificate Provisioning:**
   - Modern hosting platforms (Vercel, Railway, Render, Cloudflare) provision managed Let's Encrypt / DigiCert certificates automatically once DNS propagates.
   - Verification occurs via HTTP-01 or DNS-01 ACME challenge.
2. **Strict Transport Security (HSTS):**
   - DeployX actively sends the following header on all production HTTP responses:
     ```http
     Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
     ```
   - This prevents protocol downgrade attacks and cookie interception.
3. **Preventing Redirect Loops:**
   - Reverse proxies and CDNs terminate SSL at the edge and communicate with the backend over HTTP.
   - DeployX inspects `x-forwarded-proto: https` (`lib/network/canonical.ts`) rather than forcing an internal redirect loop when the request was already TLS-secured at the edge.

---

## 4. Verification Checklist

Before marking custom domain active in production:
- [ ] Run `dig +short CNAME deployx.yourdomain.com` to confirm DNS propagation.
- [ ] Verify `curl -I https://deployx.yourdomain.com/api/health` returns HTTP 200 with `Strict-Transport-Security`.
- [ ] Confirm `NEXT_PUBLIC_APP_URL` in hosting environment settings matches the exact custom domain (without trailing slash).
- [ ] Update the GitHub OAuth App Authorization callback URL to match: `https://deployx.yourdomain.com/api/integrations/github/callback`.
