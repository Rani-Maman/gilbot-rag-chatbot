import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { Index } from "@upstash/vector";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";

const TRANSCRIPTS_DIR = path.join(process.cwd(), "data", "transcripts");
const RESTAURANTS_PATH = path.join(process.cwd(), "data", "restaurants.json");
const PROGRESS_PATH = path.join(process.cwd(), "data", "embed_progress.json");

interface ChunkMetadata {
  videoId: string;
  restaurantName: string;
  grade: number | null;
  chunkIndex: number;
  videoUrl: string;
  title: string;
  content: string;
}

const index = new Index<ChunkMetadata>();
const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");

function chunkText(
  text: string,
  maxChunkSize = 600,
  overlap = 100
): string[] {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (
      currentChunk.length + sentence.length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(" ");
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(" ") + " " + sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!existsSync(TRANSCRIPTS_DIR)) {
    console.error("Run 02-fetch-transcripts.ts first!");
    process.exit(1);
  }

  // Load progress to skip already-embedded videos
  let processedIds: Set<string> = new Set();
  if (existsSync(PROGRESS_PATH)) {
    const progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8"));
    processedIds = new Set(progress);
  }

  // Load restaurant metadata
  let restaurantMap = new Map<
    string,
    { restaurantName: string; grade: number | null }
  >();
  if (existsSync(RESTAURANTS_PATH)) {
    const restaurants = JSON.parse(readFileSync(RESTAURANTS_PATH, "utf-8"));
    for (const r of restaurants) {
      restaurantMap.set(r.videoId, {
        restaurantName: r.restaurantName,
        grade: r.grade,
      });
    }
  }

  const files = readdirSync(TRANSCRIPTS_DIR).filter((f) => f.endsWith(".json"));
  const remaining = files.filter(
    (f) => !processedIds.has(f.replace(".json", ""))
  );

  console.log(
    `Processing ${remaining.length} remaining transcripts (${processedIds.size} already done)...`
  );

  if (remaining.length === 0) {
    console.log("All transcripts already embedded!");
    return;
  }

  let totalChunks = 0;

  for (const file of remaining) {
    const filePath = path.join(TRANSCRIPTS_DIR, file);
    const transcript = JSON.parse(readFileSync(filePath, "utf-8"));
    const restaurant = restaurantMap.get(transcript.videoId);

    const chunks = chunkText(transcript.fullText);
    console.log(
      `${transcript.videoId}: ${chunks.length} chunks (${transcript.title})`
    );

    try {
      // Embed all chunks for this video in one batch (usually < 15 chunks)
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: chunks,
        maxRetries: 0,
        providerOptions: {
          google: { outputDimensionality: 768 },
        },
      });

      const vectors = embeddings.map((embedding, i) => ({
        id: `${transcript.videoId}-chunk-${i}`,
        vector: embedding,
        metadata: {
          videoId: transcript.videoId,
          restaurantName: restaurant?.restaurantName ?? transcript.title,
          grade: restaurant?.grade ?? null,
          chunkIndex: i,
          videoUrl: `https://www.youtube.com/watch?v=${transcript.videoId}`,
          title: transcript.title,
          content: chunks[i],
        } satisfies ChunkMetadata,
      }));

      await index.upsert(vectors);
      totalChunks += vectors.length;

      // Save progress
      processedIds.add(transcript.videoId);
      writeFileSync(
        PROGRESS_PATH,
        JSON.stringify([...processedIds], null, 2)
      );
      console.log(`  -> Upserted ${vectors.length} vectors`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${message.slice(0, 150)}`);
      console.log("  Saving progress and stopping. Re-run after a minute.");
      break;
    }

    // Rate limit: embedding free tier is 100 RPM, stay safe
    await sleep(2000);
  }

  console.log(`\nUpserted ${totalChunks} chunks this run.`);
  console.log(`Total processed: ${processedIds.size}/${files.length}`);
}

main().catch(console.error);
