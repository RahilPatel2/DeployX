import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

// Fallback direct replica set URI for Windows/local networks where SRV lookups fail (querySrv ECONNREFUSED)
const DIRECT_FALLBACK_URI =
  "mongodb://rahilpatel5182_db_user:0KHtgxhSNrow6KVR@ac-jppbdlv-shard-00-00.l3hyd4o.mongodb.net:27017,ac-jppbdlv-shard-00-01.l3hyd4o.mongodb.net:27017,ac-jppbdlv-shard-00-02.l3hyd4o.mongodb.net:27017/roamly?ssl=true&replicaSet=atlas-6k0qvj-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Roamly-db";

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var mongoose: any;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      dbName: process.env.MONGODB_DB || "deployx_db",
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    };

    cached.promise = (async () => {
      try {
        const m = await mongoose.connect(MONGODB_URI!, opts);
        console.log("MongoDB connection: successful (connected to " + (process.env.MONGODB_DB || "deployx_db") + ")");
        return m;
      } catch (err: any) {
        if (
          (err?.message?.includes("querySrv") || err?.message?.includes("ECONNREFUSED")) &&
          MONGODB_URI!.includes("mongodb+srv://")
        ) {
          console.warn("MongoDB SRV lookup failed on local DNS. Falling back to direct Atlas replica set hosts...");
          const m = await mongoose.connect(DIRECT_FALLBACK_URI, opts);
          console.log("MongoDB connection: successful via direct replica set (connected to " + (process.env.MONGODB_DB || "deployx_db") + ")");
          return m;
        }
        throw err;
      }
    })();
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    console.error("MongoDB connection failed:", (e as any)?.message || e);
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
