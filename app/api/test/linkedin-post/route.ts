import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLinkedInTokens, publishLinkedInUgc } from "@/lib/publishers";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const captionRaw = formData.get("caption");
    const image = formData.get("image");

    if (typeof captionRaw !== "string") {
      return NextResponse.json({ ok: false, error: "caption required" }, { status: 400 });
    }
    const caption = captionRaw.trim();
    if (!caption) {
      return NextResponse.json({ ok: false, error: "Caption cannot be empty" }, { status: 400 });
    }
    if (caption.length > 3000) {
      return NextResponse.json(
        { ok: false, error: "Caption must be 3000 characters or less" },
        { status: 400 }
      );
    }

    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Image file required" }, { status: 400 });
    }

    const mime = image.type;
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { ok: false, error: "Image must be PNG or JPEG" },
        { status: 400 }
      );
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Image must be 5 MB or smaller" },
        { status: 400 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const imageUrl = `data:${mime};base64,${base64}`;

    const tokens = await getLinkedInTokens();
    const result = await publishLinkedInUgc(tokens.accessToken, tokens.personUrn, {
      caption,
      imageUrl,
    });

    const remoteId = result.remoteId;
    const postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(remoteId)}/`;

    return NextResponse.json({ ok: true, remoteId, postUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const isNotConnected =
      message.includes("not connected") || message.includes("LinkedIn not connected");
    const status = isNotConnected ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
