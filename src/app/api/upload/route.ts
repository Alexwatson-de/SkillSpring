import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { AppError, requireThat } from "@/lib/domain";
import { db, getProfile, member, rate, table } from "@/server/store";
import { assertSameOrigin } from "@/server/origin";
export const runtime = "nodejs";
export async function POST(req: Request) {
  let uploaded = "";
  try {
    assertSameOrigin(req);
    const u = await member(req);
    requireThat(u.verified, "Verify your email before uploading a photo", 403);
    await rate(u.uid, "photo", 5);
    await getProfile(u.uid);
    requireThat(
      process.env.CLOUDINARY_API_SECRET,
      "Profile uploads are not configured on this server",
      503,
    );
    requireThat(
      Number(req.headers.get("content-length") || 0) <= 4300000,
      "Maximum upload size is 4 MB",
      413,
    );
    const form = await req.formData();
    const file = form.get("file");
    requireThat(
      file instanceof File && file.size > 0 && file.size <= 4000000,
      "Choose an image smaller than 4 MB",
    );
    const bytes = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(bytes, { limitInputPixels: 16000000 }).metadata();
    requireThat(
      ["jpeg", "png", "webp"].includes(meta.format || "") &&
        !(meta.pages && meta.pages > 1),
      "Choose a non-animated JPEG, PNG or WebP image",
    );
    const optimized = await sharp(bytes, { limitInputPixels: 16000000 })
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    const publicId = `skillspring/avatars/${u.uid}/${randomUUID()}`;
    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { public_id: publicId, resource_type: "image", overwrite: false },
          (error, result) =>
            error || !result
              ? reject(new Error("Image provider rejected the upload"))
              : resolve(result),
        );
        stream.end(optimized);
      },
    );
    uploaded = result.public_id;
    let old = "";
    await db().runTransaction(async (t) => {
      const r = table("people").doc(u.uid);
      const a = await t.get(table("accounts").doc(u.uid));
      requireThat(a.data()?.state === "active", "Account unavailable", 403);
      const s = await t.get(r);
      old = s.data()?.photoId || "";
      t.update(r, {
        photo: result.secure_url,
        photoId: result.public_id,
        updatedAt: Date.now(),
      });
    });
    uploaded = "";
    if (old.startsWith(`skillspring/avatars/${u.uid}/`))
      await cloudinary.uploader.destroy(old).catch(() =>
        table("assetCleanup").add({
          publicId: old,
          uid: u.uid,
          createdAt: Date.now(),
        }),
      );
    return NextResponse.json({ url: result.secure_url });
  } catch (e) {
    if (uploaded)
      await cloudinary.uploader.destroy(uploaded).catch(() => undefined);
    return NextResponse.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Image could not be processed. Try a smaller JPEG, PNG or WebP.",
      },
      { status: e instanceof AppError ? e.status : 400 },
    );
  }
}
