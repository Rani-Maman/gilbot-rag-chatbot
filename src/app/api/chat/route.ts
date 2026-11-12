import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/ai/models";
import { findRelevantContent } from "@/lib/ai/embedding";
import {
  getHighestGraded,
  getLowestGraded,
  getAverageGrade,
  getRestaurantByName,
  getRestaurantsByLocation,
  getAllRestaurants,
} from "@/lib/data/restaurants";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: chatModel,
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    maxRetries: 0,
    stopWhen: stepCountIs(3),
    tools: {
      getReviewContent: tool({
        description:
          "Search through Niv Gilboa's YouTube review transcripts to find relevant content about restaurants, food, or specific reviews. Use this for questions about what Niv said, thought, or reviewed.",
        inputSchema: z.object({
          query: z
            .string()
            .describe("The search query about a restaurant or food topic"),
        }),
        execute: async ({ query }) => {
          const results = await findRelevantContent(query);
          return results.map((r) => ({
            content: r.content,
            restaurantName: r.restaurantName,
            grade: r.grade,
            videoUrl: r.videoUrl,
            relevanceScore: r.score,
          }));
        },
      }),

      getRestaurantStats: tool({
        description:
          "Get structured data about restaurant grades and statistics. Use for meta-questions: highest/lowest grade, how many reviews, average grade, restaurants by city, find by name, etc.",
        inputSchema: z.object({
          action: z
            .enum([
              "highest_graded",
              "lowest_graded",
              "average_grade",
              "all_restaurants",
              "by_location",
              "by_name",
            ])
            .describe("The type of query to perform"),
          param: z
            .string()
            .optional()
            .describe(
              "Restaurant name (for by_name) or city (for by_location)"
            ),
          limit: z
            .number()
            .optional()
            .describe("Number of results to return (default 5)"),
        }),
        execute: async ({ action, param, limit = 5 }) => {
          switch (action) {
            case "highest_graded":
              return getHighestGraded(limit);
            case "lowest_graded":
              return getLowestGraded(limit);
            case "average_grade":
              return {
                averageGrade: getAverageGrade().toFixed(1),
                totalReviews: getAllRestaurants().length,
              };
            case "all_restaurants":
              return getAllRestaurants().map((r) => ({
                name: r.restaurantName,
                grade: r.grade,
                location: r.location,
              }));
            case "by_location":
              return getRestaurantsByLocation(param ?? "");
            case "by_name":
              return getRestaurantByName(param ?? "") ?? { error: "Not found" };
            default:
              return { error: "Unknown action" };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
