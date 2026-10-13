import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import connectToDatabase from "./lib/mongodb/client";
import { User, Project, Deployment, Integration, Activity, Notification, Domain, UserSettings } from "./models";

async function syncAllIndexes() {
  console.log("Connecting to database to sync indexes...");
  const m = await connectToDatabase();
  console.log("Connected to:", m.connection.db?.databaseName);

  const models = [
    { name: "User", model: User },
    { name: "Project", model: Project },
    { name: "Deployment", model: Deployment },
    { name: "Integration", model: Integration },
    { name: "Activity", model: Activity },
    { name: "Notification", model: Notification },
    { name: "Domain", model: Domain },
    { name: "UserSettings", model: UserSettings },
  ];

  for (const { name, model } of models) {
    try {
      console.log(`Syncing indexes for ${name}...`);
      await model.createIndexes();
      const indexes = await model.collection.indexes();
      console.log(`✓ ${name} indexes:`, indexes.map(idx => idx.name));
    } catch (err: any) {
      console.error(`✗ Error syncing indexes for ${name}:`, err.message);
    }
  }

  await m.disconnect();
  console.log("Index synchronization complete.");
}

syncAllIndexes().catch(err => {
  console.error("Index sync script failed:", err);
  process.exit(1);
});
