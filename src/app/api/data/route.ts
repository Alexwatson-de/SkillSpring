import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/domain";
import { action } from "@/server/actions";
import { query } from "@/server/queries";
import { clean } from "@/server/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(req: Request) {
  try {
    if (
      req.method === "POST" &&
      Number(req.headers.get("content-length") || 0) > 64000
    )
      throw new AppError(413, "Request too large");
    const value = req.method === "GET" ? await query(req) : await action(req);
    return NextResponse.json(clean(value), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const status =
      e instanceof AppError ? e.status : e instanceof ZodError ? 400 : 500;
    const message =
      e instanceof ZodError
        ? e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .slice(0, 3)
            .join("; ")
        : e instanceof AppError
          ? e.message
          : "The request could not be completed. Please retry.";
    if (status === 500)
      console.error(
        "SkillSpring API error",
        e instanceof Error ? e.message : "unknown",
      );
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;
