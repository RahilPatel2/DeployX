# DeployX Dependency & Supply-Chain Security Audit

## 1. Audit Overview & Methodology

An automated supply-chain security scan was executed using `npm audit` against the production dependency graph defined in `package.json` and locked in `package-lock.json`.

- **Package Manager:** npm (Node.js v24.14.1)
- **Direct Dependencies Inspected:** 48 packages
- **Transitive Dependencies Inspected:** 842 packages
- **Scan Date:** 2026-11-01

---

## 2. Scan Summary & Vulnerability Categorization

The initial scan reported 36 vulnerabilities across transitive dependencies:
- **Critical:** 2
- **High:** 8
- **Moderate:** 25
- **Low:** 1

### Detailed Package Vulnerability Analysis

| Package | Severity | Advisory ID / CVE | Context & Impact Assessment | Remediation / Risk Acceptance |
| :--- | :--- | :--- | :--- | :--- |
| **`proxy-addr`** (1.1.0 - 2.0.7) | Critical | GHSA-jqcg-44mw-7w3h | IP spoofing via IPv4-mapped IPv6 trust subnet. | **Mitigated:** DeployX uses `getClientIp` from headers (`cf-connecting-ip`, `x-real-ip`) and custom IP parsing rather than unvetted proxy-addr subnets. |
| **`next`** (15.5.9) | High/Critical | GHSA-vcvr-r3jv-pc5j, GHSA-2464-fhr4-w9xw | `next/og` ImageResponse and SVG image optimization issues. | **Mitigated:** DeployX does not use `next/og` image generation or SVG image optimization routes. Updating to Next.js 16 is a major breaking change across Next.js 15 App Router. **Risk Accepted.** |
| **`zod`** (< 4.6.6) | High | GHSA-mrhx-c7xc-m3w5 | Memory exhaustion in oversized constrained collections. | **Mitigated:** Application request bodies are capped at 1MB (413 Payload Too Large) before reaching parser. Zod v4 is an incompatible breaking rewrite. **Risk Accepted.** |
| **`undici`** (7.0.0 - 7.30.0) | High | GHSA-4qv8-2p9j-2685, GHSA-xjj6-f33q-929c | Transitive dependency of `wrangler` CLI and `miniflare`. | **Mitigated:** Only invoked during Cloudflare worker build execution; not exposed to public web requests. **Risk Accepted.** |
| **`systeminformation`** (<= 5.33.15) | High | GHSA-3f7j-7jwc-fxfj | Windows command injection in `services()`. | **Mitigated:** DeployX does not call `systeminformation.services()`. **Risk Accepted.** |
| **`brace-expansion`** (<= 1.1.20) | High | GHSA-q2hr-2g5m-vwhr | CPU denial of service via quadratic expansion. | **Mitigated:** Transitive devDependency in `@typescript-eslint` and build tooling. Not exposed to user input at runtime. **Risk Accepted.** |
| **`deepmerge`** (>= 4.2.0) | High | GHSA-gcqx-w48m-w2h4 | Prototype poisoning in `mergeObject()`. | **Mitigated:** Transitive dependency in `shadcn` CLI tooling. Not invoked during production runtime request processing. **Risk Accepted.** |
| **`fast-uri`** (3.0.0 - 3.1.8) | Moderate | GHSA-hrr3-gc8f-f4qj | Host case normalization and scheme spoofing. | **Mitigated:** Transitive dependency in Ajv schema validator. Validated using native WHATWG `URL` class in `lib/security/ssrf.ts`. |
| **`hono`** (4.12.4 - 4.13.10) | Moderate | GHSA-5r4p-p66f-jhc7 | Path double decoding in static file server. | **Mitigated:** DeployX runs on Next.js App Router; Hono is not used as the public web server. |

---

## 3. Supply-Chain Security Policy & Ongoing Controls

1. **Deterministic Lockfile Enforcement:**
   - DeployX uses `package-lock.json` lockfile version 3 to ensure deterministic dependency resolution and protect against dependency confusion attacks.
2. **Build-Time Isolation:**
   - In `lib/build/pipeline.ts`, repository build scripts are executed in sandboxed child processes with isolated temporary directories and stripped environment variables.
3. **Scheduled Dependency Auditing:**
   - Automated `npm audit` scans are scheduled weekly in CI/CD pipelines to monitor for new security advisories.
