import fs from "fs";
import path from "path";

export interface Restaurant {
  videoId: string;
  title: string;
  restaurantName: string;
  grade: number | null;
  cuisine: string | null;
  location: string | null;
  videoUrl: string;
  isReview: boolean;
}

function loadRestaurants(): Restaurant[] {
  const filePath = path.join(process.cwd(), "data", "restaurants.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: Restaurant[] = JSON.parse(raw);
  return data.filter((r) => r.isReview);
}

const restaurants = loadRestaurants();

export function getHighestGraded(limit = 5): Restaurant[] {
  return restaurants
    .filter((r) => r.grade !== null)
    .sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0))
    .slice(0, limit);
}

export function getLowestGraded(limit = 5): Restaurant[] {
  return restaurants
    .filter((r) => r.grade !== null)
    .sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0))
    .slice(0, limit);
}

export function getAverageGrade(): number {
  const graded = restaurants.filter((r) => r.grade !== null);
  if (graded.length === 0) return 0;
  return graded.reduce((sum, r) => sum + (r.grade ?? 0), 0) / graded.length;
}

export function getRestaurantByName(name: string): Restaurant | undefined {
  return restaurants.find((r) =>
    r.restaurantName.toLowerCase().includes(name.toLowerCase())
  );
}

export function getRestaurantsByLocation(location: string): Restaurant[] {
  return restaurants.filter((r) =>
    r.location?.toLowerCase().includes(location.toLowerCase())
  );
}

export function getAllRestaurants(): Restaurant[] {
  return restaurants;
}
