import { constants } from "node:fs";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import type { PrismaClient } from "../../generated/prisma/client";
import type { RequestContext, AssetView } from "../../domain/types";
import { AppError } from "../../domain/errors";
import { idSchema } from "../../domain/schemas";
import { db, withTransaction } from "../../server/db";
import { readConfig } from "../../server/config";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const assetUrl = (id: string) => `/api/assets/${id}`;
// Limit expensive decodes to one at a time on the Pi; failed uploads release the queue.
let uploadQueue = Promise.resolve();
async function serial<T>(work: () => Promise<T>): Promise<T> {
 const previous = uploadQueue; let release!: () => void;
 uploadQueue = new Promise<void>(resolve => { release = resolve; });
 await previous; try { return await work(); } finally { release(); }
}
export function createAssetStore({ client = db, dataDir, promote = rename }: { client?: PrismaClient; dataDir: string; promote?: (from: string, to: string) => Promise<void> }) {
 async function directory() {
  const root = await realpath(dataDir), target = join(root, "assets");
  await mkdir(target, { recursive: true, mode: 0o700 });
  if (await realpath(target) !== target) throw new Error("Unsafe asset directory");
  return target;
 }
 return {
  async storeImage(ctx: RequestContext, file: File, purpose: "artwork" | "blank"): Promise<AssetView & { url: string }> {
   if (ctx.actor.role !== "admin") throw new AppError("FORBIDDEN", 403, "Administrator access is required.");
   if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES) throw new AppError("INVALID_IMAGE", 422, "Choose an image of at most 8 MB.");
   if (!((purpose === "artwork" && file.type === "image/png") || (purpose === "blank" && ["image/png", "image/jpeg"].includes(file.type)))) throw new AppError("INVALID_IMAGE", 422, purpose === "artwork" ? "Artwork must be a PNG." : "Blank photos must be PNG or JPEG.");
   return serial(async () => {
    let bytes: Buffer, format: "png" | "jpeg", width: number, height: number;
    try {
     const source = Buffer.from(await file.arrayBuffer());
     const image = sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" });
     const metadata = await image.metadata();
     if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS || (metadata.pages ?? 1) !== 1 || !["png", "jpeg"].includes(metadata.format ?? "") || (purpose === "artwork" && metadata.format !== "png") || file.type !== `image/${metadata.format}`) throw new Error("Invalid image content");
     format = metadata.format as "png" | "jpeg";
     const normalized = image.rotate();
     const encoded = await (format === "png" ? normalized.png() : normalized.jpeg({ quality: 95 })).toBuffer({ resolveWithObject: true });
     bytes = encoded.data; width = encoded.info.width; height = encoded.info.height;
     if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Normalized image too large");
    } catch { throw new AppError("INVALID_IMAGE", 422, "The file must be a valid single PNG/JPEG image, at most 8 MB and 40 million pixels. Artwork requires PNG."); }
    let temporary: string | undefined;
    try {
     const folder = await directory(), id = randomUUID(), storageKey = `${id}.${format === "png" ? "png" : "jpg"}`;
     temporary = join(folder, `.${id}.pending`);
     const handle = await open(/*turbopackIgnore: true*/ temporary, "wx", 0o600);
     try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
     await promote(temporary, join(folder, storageKey)); temporary = undefined;
     const directoryHandle = await open(/*turbopackIgnore: true*/ folder, "r"); try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
     const asset = await withTransaction(tx => tx.asset.create({ data: { id, mime: `image/${format}`, width, height, byteSize: bytes.length, storageKey, sha256: createHash("sha256").update(bytes).digest("hex") } }), client);
     return { id: asset.id, mime: asset.mime as "image/png" | "image/jpeg", width, height, byteSize: bytes.length, url: assetUrl(asset.id) };
    } catch { throw new AppError("STORAGE_UNAVAILABLE", 503, "The image could not be saved. The previous image is unchanged. Please try again."); }
    finally { if (temporary) await unlink(temporary).catch(() => undefined); }
   });
  },
  async readAsset(id: string): Promise<{ bytes: Buffer; mime: string }> {
   if (!idSchema.safeParse(id).success) throw new AppError("NOT_FOUND", 404, "Image not found.");
   const asset = await client.asset.findUnique({ where: { id } });
   if (!asset || !/^[a-f0-9-]{36}\.(png|jpg)$/.test(asset.storageKey)) throw new AppError("NOT_FOUND", 404, "Image not found.");
   try {
    const handle = await open(/*turbopackIgnore: true*/ join(await directory(), asset.storageKey), constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try { const stat = await handle.stat(); if (!stat.isFile() || stat.size !== asset.byteSize || stat.size > MAX_IMAGE_BYTES) throw new Error("Invalid asset"); bytes = await handle.readFile(); } finally { await handle.close(); }
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error("Corrupt asset");
    return { bytes, mime: asset.mime };
   } catch { throw new AppError("NOT_FOUND", 404, "Image unavailable. Ask an administrator to upload it again."); }
  },
 };
}
export const runtimeAssets = () => createAssetStore({ dataDir: readConfig(process.env).dataDir });
export const storeImage = (ctx: RequestContext, file: File, purpose: "artwork" | "blank") => runtimeAssets().storeImage(ctx, file, purpose);
