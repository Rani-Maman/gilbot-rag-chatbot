import { google } from "@ai-sdk/google";

export const chatModel = google("gemini-2.5-flash");
export const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");
