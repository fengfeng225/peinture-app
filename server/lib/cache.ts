import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import sharp from 'sharp';

const CACHE_DIR = process.env.CACHE_DIR || path.join(os.tmpdir(), 'peinture-cache');
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// Ensure cache directory exists
fs.mkdirSync(CACHE_DIR, { recursive: true });

export function getCacheDir(): string {
  return CACHE_DIR;
}

/**
 * Download image from upstream URL, convert to PNG, save to cache.
 * Returns the local filename (always .png).
 */
export async function cacheImage(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status}`);
  }

  const srcBuffer = Buffer.from(await res.arrayBuffer());
  const pngBuffer = await sharp(srcBuffer).png().toBuffer();

  const filename = crypto.randomUUID() + '.png';
  fs.writeFileSync(path.join(CACHE_DIR, filename), pngBuffer);
  return filename;
}

/**
 * Delete cached files older than MAX_AGE_MS.
 */
export function cleanupCache(): void {
  try {
    const now = Date.now();
    for (const file of fs.readdirSync(CACHE_DIR)) {
      const fp = path.join(CACHE_DIR, file);
      try {
        if (now - fs.statSync(fp).mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(fp);
        }
      } catch { /* ignore single file errors */ }
    }
  } catch (e) {
    console.error('Cache cleanup error:', e);
  }
}

// Run cleanup every hour
setInterval(cleanupCache, 60 * 60 * 1000);
