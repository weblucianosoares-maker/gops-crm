import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
  try {
    console.log("Fetching available models from Google AI...");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as any;
    console.log("Available Models:");
    data.models.forEach((m: any) => {
      console.log(`- ${m.name} (${m.displayName})`);
      console.log(`  Capabilities: ${m.supportedGenerationMethods.join(", ")}`);
    });
  } catch (err) {
    console.error("Failed to list models:", err);
  }
}

listModels();
