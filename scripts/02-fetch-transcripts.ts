import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import path from "path";

const VIDEO_IDS_PATH = path.join(process.cwd(), "data", "video_ids.json");
const TRANSCRIPTS_DIR = path.join(process.cwd(), "data", "transcripts");

interface Video {
  id: string;
  title: string;
  date: string;
}

function parseSrt(srtContent: string): string {
  // Parse SRT format: remove timestamps and sequence numbers, keep text
  const lines = srtContent.split("\n");
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, sequence numbers, and timestamp lines
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/-->/.test(trimmed)) continue;
    textLines.push(trimmed);
  }

  // Deduplicate consecutive identical lines (common in auto-generated subs)
  const deduped: string[] = [];
  for (const line of textLines) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  return deduped.join(" ");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!existsSync(VIDEO_IDS_PATH)) {
    console.error("Run 01-fetch-video-ids.ts first!");
    process.exit(1);
  }

  const videos: Video[] = JSON.parse(readFileSync(VIDEO_IDS_PATH, "utf-8"));
  console.log(`Processing ${videos.length} videos...`);

  if (!existsSync(TRANSCRIPTS_DIR)) {
    mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  }

  let successCount = 0;

  for (const video of videos) {
    const outPath = path.join(TRANSCRIPTS_DIR, `${video.id}.json`);

    if (existsSync(outPath)) {
      console.log(`SKIP (exists): ${video.id} - ${video.title}`);
      successCount++;
      continue;
    }

    try {
      // Use yt-dlp to download Hebrew auto-generated subtitles
      const srtPath = path.join(TRANSCRIPTS_DIR, `${video.id}.iw.srt`);
      execSync(
        `yt-dlp --write-auto-sub --sub-lang iw --sub-format srt --skip-download -o "${path.join(TRANSCRIPTS_DIR, video.id)}" -- "${video.id}"`,
        { encoding: "utf-8", timeout: 30000, stdio: "pipe" }
      );

      if (existsSync(srtPath)) {
        const srtContent = readFileSync(srtPath, "utf-8");
        const fullText = parseSrt(srtContent);

        writeFileSync(
          outPath,
          JSON.stringify(
            {
              videoId: video.id,
              title: video.title,
              date: video.date,
              fullText,
            },
            null,
            2
          )
        );

        // Clean up the SRT file
        unlinkSync(srtPath);

        console.log(
          `OK: ${video.id} - ${video.title} (${fullText.length} chars)`
        );
        successCount++;
      } else {
        console.error(`FAIL: ${video.id} - ${video.title} (no subtitle file)`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `FAIL: ${video.id} - ${video.title} (${message.slice(0, 100)})`
      );
    }

    // Rate limit
    await sleep(1000);
  }

  console.log(`\nDone! ${successCount}/${videos.length} transcripts fetched.`);
}

main().catch(console.error);
