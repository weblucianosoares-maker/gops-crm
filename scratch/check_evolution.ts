import { evolutionService } from './src/lib/evolution';

async function check() {
  console.log("Checking Evolution API connection...");
  try {
    const status = await evolutionService.getConnectionStatus();
    console.log("Status:", JSON.stringify(status, null, 2));
  } catch (e) {
    console.error("Connection check failed:", e);
  }
}

check();
