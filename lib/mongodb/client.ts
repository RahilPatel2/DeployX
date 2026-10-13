import mongoose from "mongoose";

if (typeof window !== "undefined") {
  throw new Error("connectToDatabase must only be called from server-side code.");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.__mongooseCache || { conn: null, promise: null };
if (!global.__mongooseCache) {
  global.__mongooseCache = cached;
}

/**
 * Derives a direct Atlas replica-set connection URI from the standard SRV URI.
 * This resolves Windows / local DNS SRV lookup failures (querySrv ECONNREFUSED)
 * without hardcoding credentials into source code.
 */
function getDirectFallbackUri(srvUri: string, dbName: string): string | null {
  try {
    const parsed = new URL(srvUri.replace(/^mongodb\+srv:\/\//, "http://"));
    const user = decodeURIComponent(parsed.username);
    const pass = decodeURIComponent(parsed.password);
    const auth = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : "";
    
    if (parsed.hostname.includes("roamly-db.l3hyd4o.mongodb.net")) {
      const hosts = "ac-jppbdlv-shard-00-00.l3hyd4o.mongodb.net:27017,ac-jppbdlv-shard-00-01.l3hyd4o.mongodb.net:27017,ac-jppbdlv-shard-00-02.l3hyd4o.mongodb.net:27017";
      return `mongodb://${auth}${hosts}/${dbName}?ssl=true&replicaSet=atlas-6k0qvj-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Roamly-db`;
    }
  } catch {
    // Return null if URI parsing fails
  }
  return null;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "deployx_db";

  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined in .env.local");
  }

  // Reuse existing active connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      dbName,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
    };

    cached.promise = (async () => {
      try {
        const m = await mongoose.connect(uri, opts);
        console.log(`[MongoDB] Connected successfully to database: ${dbName}`);
        return m;
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        const isDnsError =
          (errMessage.includes("querySrv") || errMessage.includes("ECONNREFUSED")) &&
          uri.startsWith("mongodb+srv://");

        if (isDnsError) {
          const directUri = getDirectFallbackUri(uri, dbName);
          if (directUri) {
            console.warn("[MongoDB] SRV lookup failed on local DNS. Falling back to direct replica set hosts...");
            const m = await mongoose.connect(directUri, opts);
            console.log(`[MongoDB] Connected successfully via replica set fallback to database: ${dbName}`);
            return m;
          }
        }

        // Clean up cached promise on error so subsequent attempts can retry
        cached.promise = null;
        cached.conn = null;
        console.error("[MongoDB] Connection failure:", errMessage);
        throw err;
      }
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: unknown) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
