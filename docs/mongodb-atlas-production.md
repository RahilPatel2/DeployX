# MongoDB Atlas Production Configuration & Security Guide

**Document Version:** 1.0.0  
**Cluster Architecture:** MongoDB Atlas Replica Set (AWS/GCP)  
**Database Isolation:** Dedicated `deployx_db` (Isolated from test environments and external databases)

---

## 1. Database Isolation & Tenancy Principles

DeployX operates in a dedicated database named `deployx_db`. All application collections (`users`, `projects`, `deployments`, `activities`, `integrations`) reside strictly within this database namespace.

### Strict Rules:
- **No Cross-Database Contamination:** DeployX will **never** write to default databases such as `test`, `admin`, or external project databases (such as Roamly).
- **Explicit Database Selection:** The application explicitly specifies `dbName: "deployx_db"` in connection options, regardless of whether a database name is appended to the connection string URI.

---

## 2. Least-Privilege Atlas Database User Configuration

In MongoDB Atlas (**Database Access** -> **Database Users**), create a dedicated application user with least-privilege permissions.

### Recommended Configuration:
- **Authentication Method:** Password (SCRAM-SHA-256)
- **Username:** `deployx_app_user`
- **Built-in Role:** **Do NOT use `atlasAdmin` or `readWriteAnyDatabase`**.
- **Custom Role Privileges:**
  - Database: `deployx_db`
  - Collection: * (All collections within `deployx_db`)
  - Actions: `readWrite` (`find`, `insert`, `update`, `delete`, `createCollection`, `createIndex`)

> [!SECURITY NOTE]
> Never grant `dropDatabase`, `serverStatus`, or access to other database namespaces to the DeployX production user.

---

## 3. Network Access & IP Access Lists

In MongoDB Atlas (**Network Access** -> **IP Access List**):

### Production Hosting Strategies:
1. **Container / Static IP Hosting (Railway / Render / AWS):**
   - Retrieve your hosting provider's dedicated outbound/egress IPv4 addresses.
   - Add only those specific `/32` IP addresses to the Atlas IP Access List with descriptions (e.g., `DeployX Production Egress 1`).
2. **Serverless Hosting (Vercel / AWS Lambda):**
   - Serverless platforms dynamically allocate IPs across extensive cloud provider ranges.
   - **Recommended:** Connect via the official **Vercel MongoDB Atlas Integration**, which securely provisions VPC/network peering or scoped access.
   - **Alternative:** If VPC peering is unavailable on free-tier clusters and `0.0.0.0/0` (Anywhere) must be temporarily permitted, you **MUST**:
     - Enforce a 64+ character cryptographically random database password.
     - Enforce TLS 1.3 encryption in transit.
     - Restrict the database user permissions strictly to `deployx_db`.
     - Regularly audit Atlas access logs.

---

## 4. Serverless Connection Pooling & Timeout Controls

Because DeployX runs in a modern serverless / Node.js App Router environment, connection pooling is tuned to avoid connection starvation:

```typescript
const opts: mongoose.ConnectOptions = {
  bufferCommands: false,
  dbName: "deployx_db",
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 1,
};
```

- **Global Connection Cache:** `global.__mongooseCache` reuses the active Mongoose connection across hot serverless lambdas.
- **Max Pool Size (10):** Limits peak connections per container, preventing Atlas connection limits from being exceeded during traffic spikes.
- **Sanitized Logging:** All connection failure errors are passed through `redactSensitiveData` before logging to prevent credential leakage in deployment logs.

---

## 5. Required Compound Production Indexes

Ensure the following compound indexes exist on `deployx_db` for optimal query execution:

### Collection: `projects`
- `{ userId: 1, name: 1 }` (Unique) — Enforces per-user project name uniqueness.
- `{ userId: 1, createdAt: -1 }` — Dashboard project listings.
- `{ userId: 1, framework: 1, createdAt: -1 }` — Framework filtering.

### Collection: `deployments`
- `{ projectId: 1, createdAt: -1 }` — Project deployment history.
- `{ userId: 1, createdAt: -1 }` — Global user deployment stream.
- `{ userId: 1, status: 1 }` — Active deployment dashboard metrics.
- `{ projectId: 1, status: 1, createdAt: -1 }` — Latest deployment per project.

### Collection: `activities`
- `{ userId: 1, createdAt: -1 }` — User activity feed pagination.
