import { readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";

const TRANSCRIPTS_DIR = path.join(process.cwd(), "data", "transcripts");
const RESTAURANTS_PATH = path.join(process.cwd(), "data", "restaurants.json");

// Hebrew number words to digits
const hebrewNums: Record<string, number> = {
  "אחת": 1, "אחד": 1,
  "שתיים": 2, "שניים": 2, "שנים": 2, "שתים": 2,
  "שלוש": 3, "שלושה": 3,
  "ארבע": 4, "ארבעה": 4,
  "חמש": 5, "חמישה": 5, "חמס": 5,
  "שש": 6, "שישה": 6,
  "שבע": 7, "שבעה": 7,
  "שמונה": 8, "שנה": 8, // auto-subs sometimes mishear שמונה as שנה
  "תשע": 9, "תשעה": 9,
  "עשר": 10, "עשרה": 10,
};

interface TranscriptGrade {
  videoId: string;
  title: string;
  grade: number | null;
  context: string;
}

function extractGrade(text: string): { grade: number | null; context: string } {
  // Look at the last 1000 chars where grade is usually said
  const tail = text.slice(-1000);

  // Pattern 1: Hebrew number word + optional half + במדד
  for (const [word, num] of Object.entries(hebrewNums)) {
    // With half
    const halfPatterns = [
      new RegExp(`${word}\\s*וחצי\\s*במדד`),
      new RegExp(`${word}\\s*וח\\s*במדד`),
    ];
    for (const pat of halfPatterns) {
      const match = pat.exec(tail);
      if (match) {
        const ctx = tail.substring(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim();
        return { grade: num + 0.5, context: ctx };
      }
    }

    // Without half
    const pat = new RegExp(`${word}\\s*במדד`);
    const match = pat.exec(tail);
    if (match) {
      const ctx = tail.substring(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim();
      return { grade: num, context: ctx };
    }
  }

  // Pattern 2: digit + וחצי + במדד
  const digitHalfPat = /(\d+)\s*וחצי\s*במדד/;
  const digitHalfMatch = digitHalfPat.exec(tail);
  if (digitHalfMatch) {
    const ctx = tail.substring(Math.max(0, digitHalfMatch.index - 30), digitHalfMatch.index + digitHalfMatch[0].length + 30).trim();
    return { grade: parseFloat(digitHalfMatch[1]) + 0.5, context: ctx };
  }

  // Pattern 3: digit + במדד
  const digitPat = /(\d+\.?\d*)\s*במדד/;
  const digitMatch = digitPat.exec(tail);
  if (digitMatch) {
    const g = parseFloat(digitMatch[1]);
    if (g >= 1 && g <= 10) {
      const ctx = tail.substring(Math.max(0, digitMatch.index - 30), digitMatch.index + digitMatch[0].length + 30).trim();
      return { grade: g, context: ctx };
    }
  }

  return { grade: null, context: "" };
}

function main() {
  const files = readdirSync(TRANSCRIPTS_DIR).filter((f) => f.endsWith(".json"));
  const restaurants = JSON.parse(readFileSync(RESTAURANTS_PATH, "utf-8"));

  console.log("Extracting grades from transcripts...\n");

  const gradeMap: Record<string, { grade: number | null; context: string }> = {};

  for (const file of files) {
    const t = JSON.parse(readFileSync(path.join(TRANSCRIPTS_DIR, file), "utf-8"));
    const { grade, context } = extractGrade(t.fullText);
    gradeMap[t.videoId] = { grade, context };

    const entry = restaurants.find((r: any) => r.videoId === t.videoId);
    const currentGrade = entry ? entry.grade : "N/A";
    const name = entry ? entry.restaurantName : "NOT IN RESTAURANTS.JSON";
    const changed = entry && grade !== null && grade !== currentGrade ? " *** CHANGED ***" : "";

    console.log(`${t.videoId} | ${name}`);
    console.log(`  Current: ${currentGrade} -> Transcript: ${grade !== null ? grade : "NOT FOUND"}${changed}`);
    if (context) console.log(`  Context: ...${context}...`);
    console.log();
  }

  // Update restaurants.json
  let changedCount = 0;
  for (const entry of restaurants) {
    const found = gradeMap[entry.videoId];
    if (found && found.grade !== null && found.grade !== entry.grade) {
      console.log(`UPDATING: ${entry.restaurantName}: ${entry.grade} -> ${found.grade}`);
      entry.grade = found.grade;
      changedCount++;
    }
  }

  if (changedCount > 0) {
    writeFileSync(RESTAURANTS_PATH, JSON.stringify(restaurants, null, 2));
    console.log(`\nUpdated ${changedCount} grades in restaurants.json`);
  } else {
    console.log("\nNo grade changes needed.");
  }
}

main();
