import { z } from "zod";
import { AppError } from "../../domain/errors";
import { requireActor, authorizeMutation } from "../../server/authorization";
import { apiResponse, jsonData, readSmallJson } from "../../server/http";
import { db } from "../../server/db";
import { idSchema, sideSchema, versionSchema, placementSchema } from "../../domain/schemas";
import { parseCatalog } from "../catalog/colors";
import { createCatalogService } from "../catalog/service";
import { createArtworkService } from "./service";
import { MAX_IMAGE_BYTES, runtimeAssets } from "./assets";
async function uploadForm(request: Request): Promise<FormData> {
 if (!request.headers.get("Content-Type")?.startsWith("multipart/form-data;")) throw new Error("Expected multipart upload");
 const reader = request.body?.getReader(); if (!reader) return new FormData();
 const chunks: Uint8Array[] = []; let bytes = 0;
 try { while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > MAX_IMAGE_BYTES + 65536) { await reader.cancel(); throw new Error("Too large"); } chunks.push(next.value); } }
 finally { reader.releaseLock(); }
 return new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("Content-Type")! }, body: new Uint8Array(Buffer.concat(chunks)) }).formData();
}
export function artworkCollection(request: Request, params: Promise<{ id: string }>) {
 return apiResponse(async () => { const ctx = await requireActor(request, "admin"); await authorizeMutation(request, ctx); const { id } = await params;
 const { name } = parseCatalog(z.strictObject({ name: z.string().trim().min(1).max(60) }), await readSmallJson(request)); return jsonData(await createArtworkService().createArtworkSet(ctx, id, name)); });
}
export function artworkDeletion(request: Request, params: Promise<{ id: string }>) {
 return apiResponse(async () => { const ctx = await requireActor(request, "admin"); await authorizeMutation(request, ctx); const { id } = await params;
 const input = parseCatalog(z.strictObject({ expectedVersion: versionSchema, expectedReplacementSetId: idSchema }), await readSmallJson(request)); return jsonData(await createArtworkService().deleteArtworkSet(ctx, id, input.expectedVersion, input.expectedReplacementSetId)); });
}
export function artworkSideDeletion(request: Request, params: Promise<{id:string;side:string}>) {
 return apiResponse(async()=>{
  const ctx=await requireActor(request,"admin");await authorizeMutation(request,ctx);const {id,side:rawSide}=await params;
  const side=parseCatalog(sideSchema,rawSide),input=parseCatalog(z.strictObject({expectedVersion:versionSchema}),await readSmallJson(request));
  return jsonData(await createArtworkService().removeArtworkSide(ctx,id,input.expectedVersion,side));
 });
}
export function imageUpload(request: Request, params: Promise<{ id: string; side: string }>, purpose: "artwork" | "blank") {
 return apiResponse(async () => {
  const ctx = await requireActor(request, "admin"); await authorizeMutation(request, ctx);
  const { id, side: rawSide } = await params; parseCatalog(idSchema, id); const side = parseCatalog(sideSchema, rawSide);
  let form: FormData; try { form = await uploadForm(request); } catch { return Response.json({ error: { code: "INVALID_IMAGE", message: "Choose one image of at most 8 MB." } }, { status: 422, headers: { "Cache-Control": "no-store" } }); }
  const allowed = purpose === "artwork" ? ["file", "expectedVersion"] : ["file", "expectedVersion", "colorId"];
  for (const key of form.keys()) if (!allowed.includes(key) || form.getAll(key).length !== 1) return Response.json({ error: { code: "INVALID_INPUT", message: "Invalid upload fields." } }, { status: 422, headers: { "Cache-Control": "no-store" } });
  const file = form.get("file"), version = parseCatalog(z.string().regex(/^\d+$/).transform(Number).pipe(versionSchema), form.get("expectedVersion"));
  const colorId = purpose === "blank" ? parseCatalog(idSchema.nullable(), form.get("colorId") || null) : null;
  if (!(file instanceof File)) return Response.json({ error: { code: "INVALID_IMAGE", message: "Choose an image." } }, { status: 422, headers: { "Cache-Control": "no-store" } });
  const assets = runtimeAssets(), service = createArtworkService();
  if (purpose === "artwork") {
   const set = await db.artworkSet.findUnique({ where: { id } });
   if (!set) throw new AppError("NOT_FOUND", 404, "Artwork set not found.");
   if (set.version !== version) { throw new AppError("STALE_VERSION", 409, "This record changed. Reload before uploading."); }
   const asset = await assets.storeImage(ctx, file, purpose);
   return jsonData(await service.replaceArtworkSide(ctx, id, version, side, asset.id));
  }
  const style = await db.merchandiseStyle.findUnique({ where: { id } });
  if (!style) throw new AppError("NOT_FOUND", 404, "Shirt style not found.");
  if (style.version !== version) throw new AppError("STALE_VERSION", 409, "This record changed. Reload before uploading.");
  if (colorId && !await db.styleColor.findFirst({ where: { id: colorId, styleId: id } })) throw new AppError("INVALID_COLOR", 422, "The color does not belong to this style.");
  const asset = await assets.storeImage(ctx, file, purpose);
  await service.setBlankPhoto(ctx, id, colorId, side, asset.id, version);
  return jsonData((await createCatalogService().getCatalog(ctx, style.seasonId)).styles.find(s => s.id === id));
 });
}
export function draftBlankUpload(request: Request) {
 return apiResponse(async () => {
  const ctx = await requireActor(request, "admin"); await authorizeMutation(request, ctx);
  let form: FormData; try { form = await uploadForm(request); } catch { throw new AppError("INVALID_IMAGE", 422, "Choose one image of at most 8 MB."); }
  if ([...form.keys()].some(key => key !== "file") || form.getAll("file").length !== 1 || !(form.get("file") instanceof File)) throw new AppError("INVALID_IMAGE", 422, "Choose one shirt image.");
  return jsonData(await runtimeAssets().storeImage(ctx, form.get("file") as File, "blank"));
 });
}
export function assetRead(request: Request, params: Promise<{ id: string }>) {
 return apiResponse(async () => { await requireActor(request); const { id } = await params, { bytes, mime } = await runtimeAssets().readAsset(id);
 return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mime, "Content-Length": String(bytes.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); });
}
export function compositeRead(request: Request) {
 return apiResponse(async () => { const ctx = await requireActor(request), query = new URL(request.url).searchParams;
 const styleId = parseCatalog(idSchema, query.get("styleId")), setId = parseCatalog(idSchema, query.get("setId")), colorId = parseCatalog(idSchema, query.get("colorId")), side = parseCatalog(sideSchema, query.get("side"));
 const style = await db.merchandiseStyle.findUnique({ where: { id: styleId }, include: { season: true } });
 if (!style || (ctx.actor.role !== "admin" && style.season.lifecycle === "DRAFT")) { throw new AppError("NOT_FOUND", 404, "Preview not found."); }
 return jsonData(await createArtworkService().getCompositeSpec(styleId, setId, colorId, side)); });
}
export function placementSave(request: Request, params: Promise<{ id: string }>) {
 return apiResponse(async () => { const ctx = await requireActor(request, "admin"); await authorizeMutation(request, ctx); const { id } = await params;
 const input = parseCatalog(z.strictObject({ setId: idSchema, colorId: idSchema.nullable(), side: sideSchema, values: placementSchema, expectedVersion: versionSchema.nullable().optional() }), await readSmallJson(request));
 await createArtworkService().savePlacement(ctx, id, input.setId, input.side, input.colorId, input.values, input.expectedVersion); return jsonData({ saved: true }); });
}

export function placementRead(request: Request, params: Promise<{ id: string }>) {
 return apiResponse(async()=>{const ctx=await requireActor(request,"admin"), {id}=await params, query=new URL(request.url).searchParams;
 const setId=parseCatalog(idSchema,query.get("setId")),colorId=parseCatalog(idSchema,query.get("colorId")),side=parseCatalog(sideSchema,query.get("side"));
 return jsonData(await createArtworkService().getPlacementEditor(ctx,id,setId,colorId,side));});
}
