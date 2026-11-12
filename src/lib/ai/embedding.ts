import { embed } from "ai";
import { Index } from "@upstash/vector";
import { embeddingModel } from "./models";

type ChunkMetadata = Record<string, unknown> & {
  videoId: string;
  restaurantName: string;
  grade: number | null;
  chunkIndex: number;
  videoUrl: string;
  title: string;
  content: string;
};

const index = new Index<ChunkMetadata>();

export async function findRelevantContent(query: string, topK = 5) {
  const { embedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: {
      google: { outputDimensionality: 768 },
    },
  });

  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return results.map((r) => ({
    content: r.metadata?.content ?? "",
    restaurantName: r.metadata?.restaurantName ?? "",
    grade: r.metadata?.grade ?? null,
    videoUrl: r.metadata?.videoUrl ?? "",
    title: r.metadata?.title ?? "",
    score: r.score,
  }));
}
