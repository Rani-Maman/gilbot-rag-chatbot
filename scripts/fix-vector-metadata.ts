import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Index } from "@upstash/vector";
import { readFileSync } from "fs";
import path from "path";

const RESTAURANTS_PATH = path.join(process.cwd(), "data", "restaurants.json");

async function main() {
  const index = new Index();
  const restaurants = JSON.parse(readFileSync(RESTAURANTS_PATH, "utf-8"));

  // Build a lookup of videoId -> correct grade & restaurantName
  const lookup: Record<string, { grade: number | null; restaurantName: string }> = {};
  for (const r of restaurants) {
    lookup[r.videoId] = { grade: r.grade, restaurantName: r.restaurantName };
  }

  // Fetch all vectors from the index
  console.log("Fetching all vectors from Upstash...");

  // Use range to get all vector IDs
  let cursor = "0";
  let allIds: string[] = [];

  while (true) {
    const result = await index.range({
      cursor,
      limit: 100,
      includeMetadata: true,
    });

    for (const vec of result.vectors) {
      allIds.push(vec.id as string);
      const meta = vec.metadata as Record<string, unknown>;
      const videoId = meta?.videoId as string;

      if (videoId && lookup[videoId]) {
        const correct = lookup[videoId];
        const currentGrade = meta.grade;
        const currentName = meta.restaurantName;

        if (currentGrade !== correct.grade || currentName !== correct.restaurantName) {
          console.log(`UPDATING ${vec.id}: grade ${currentGrade} -> ${correct.grade}, name "${currentName}" -> "${correct.restaurantName}"`);
          await index.update({
            id: vec.id as string,
            metadata: {
              ...meta,
              grade: correct.grade,
              restaurantName: correct.restaurantName,
            },
          });
        }
      }
    }

    if (!result.nextCursor || result.nextCursor === "0") break;
    cursor = result.nextCursor;
  }

  console.log(`\nDone! Scanned ${allIds.length} vectors.`);
}

main().catch(console.error);
