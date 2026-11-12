import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const CHANNEL_URL = "https://www.youtube.com/@nivgilboa/videos";
const MAX_VIDEOS = 30;
const OUTPUT_PATH = path.join(process.cwd(), "data", "video_ids.json");

async function main() {
  console.log(`Fetching up to ${MAX_VIDEOS} video IDs from ${CHANNEL_URL}...`);

  if (!existsSync(path.dirname(OUTPUT_PATH))) {
    mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  }

  const output = execSync(
    `yt-dlp --flat-playlist --playlist-end ${MAX_VIDEOS} --print "%(id)s|||%(title)s|||%(upload_date)s" "${CHANNEL_URL}"`,
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );

  const videos = output
    .trim()
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [id, title, date] = line.split("|||");
      return { id: id.trim(), title: title?.trim() ?? "", date: date?.trim() ?? "" };
    });

  writeFileSync(OUTPUT_PATH, JSON.stringify(videos, null, 2));
  console.log(`Saved ${videos.length} video IDs to ${OUTPUT_PATH}`);
  videos.forEach((v) => console.log(`  ${v.id} - ${v.title}`));
}

main().catch(console.error);
