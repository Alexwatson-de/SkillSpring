import { z } from "zod";
import { AppError } from "@/lib/domain";
// Streaming ceiling also applies when a caller omits Content-Length.
export async function readJson(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, "Missing request body");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 64000) {
        await reader.cancel();
        throw new AppError(413, "Request exceeds 64 KB");
      }
      parts.push(item.value);
    }
    return z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(Buffer.concat(parts).toString("utf8")));
  } catch (e) {
    if (e instanceof AppError || e instanceof z.ZodError) throw e;
    throw new AppError(400, "Invalid or interrupted JSON request");
  }
}
