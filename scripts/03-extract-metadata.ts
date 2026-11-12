import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";

const TRANSCRIPTS_DIR = path.join(process.cwd(), "data", "transcripts");
const OUTPUT_PATH = path.join(process.cwd(), "data", "restaurants.json");

const RestaurantSchema = z.object({
  restaurantName: z.string().describe("The name of the restaurant reviewed"),
  grade: z
    .number()
    .nullable()
    .describe(
      "The numeric grade (1-10, can be decimal like 7.5) given by Niv Gilboa, or null if no grade was given"
    ),
  cuisine: z
    .string()
    .nullable()
    .describe("Type of cuisine if mentioned (e.g., Italian, Asian, Israeli)"),
  location: z
    .string()
    .nullable()
    .describe("City or area if mentioned (e.g., Tel Aviv, Jerusalem, Haifa)"),
  isReview: z
    .boolean()
    .describe(
      "Whether this video is actually a restaurant review (vs. other content like vlogs, Q&A, etc.)"
    ),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!existsSync(TRANSCRIPTS_DIR)) {
    console.error("Run 02-fetch-transcripts.ts first!");
    process.exit(1);
  }

  const files = readdirSync(TRANSCRIPTS_DIR).filter((f) => f.endsWith(".json"));

  // Load existing results to skip already processed
  let results: any[] = [];
  if (existsSync(OUTPUT_PATH)) {
    results = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
  }
  const processedIds = new Set(results.map((r: any) => r.videoId));

  const remaining = files.filter((f) => !processedIds.has(f.replace(".json", "")));
  console.log(`Processing ${remaining.length} remaining transcripts (${results.length} already done)...`);
  if (remaining.length === 0) {
    console.log("All transcripts already processed!");
    return;
  }

  for (const file of remaining) {
    const filePath = path.join(TRANSCRIPTS_DIR, file);
    const transcript = JSON.parse(readFileSync(filePath, "utf-8"));

    // Take first 500 chars (intro) + last 2000 chars (where the grade usually is)
    const intro = transcript.fullText.slice(0, 500);
    const outro = transcript.fullText.slice(-2000);
    const textForExtraction = `${intro}\n...\n${outro}`;

    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash-lite"),
        maxRetries: 0,
        schema: RestaurantSchema,
        prompt: `You are analyzing a Hebrew YouTube transcript from Israeli food critic Niv Gilboa.
The video title is: "${transcript.title}"

Extract the restaurant name and the grade he gave (usually a number between 1-10, said near the end of the review).
He often says "הציון הוא" (the grade is) or similar phrases before giving the grade.
If this is not a restaurant review video (e.g., it's a vlog, Q&A, compilation), set isReview to false.

Transcript excerpt:
${textForExtraction}`,
      });

      const entry = {
        videoId: transcript.videoId,
        title: transcript.title,
        restaurantName: object.restaurantName,
        grade: object.grade,
        cuisine: object.cuisine,
        location: object.location,
        videoUrl: `https://www.youtube.com/watch?v=${transcript.videoId}`,
        isReview: object.isReview,
      };

      results.push(entry);
      console.log(
        `${object.isReview ? "REVIEW" : "SKIP"}: ${object.restaurantName} - Grade: ${object.grade ?? "N/A"} (${transcript.title})`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ERROR: ${transcript.videoId} - ${message}`);
    }

    // Rate limit for Gemini free tier (20 RPM = 1 every 3s, but add safety margin)
    await sleep(10000);
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(
    `\nSaved ${results.length} entries to ${OUTPUT_PATH}`
  );

  const reviews = results.filter((r) => r.isReview);
  console.log(`  Reviews: ${reviews.length}`);
  console.log(`  Non-reviews: ${results.length - reviews.length}`);
}

main().catch(console.error);
