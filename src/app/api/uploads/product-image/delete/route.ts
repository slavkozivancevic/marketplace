import { NextRequest, NextResponse } from "next/server";
import { deleteS3Object } from "@/services/s3Delete";

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: true, message: "Invalid key" }, { status: 400 });
    }

    // Delete original
    await deleteS3Object(key);

    // Delete thumbnail
    const thumbKey = key.replace("/products/", "/products/thumbs/") + ".webp";
    await deleteS3Object(thumbKey);

    return NextResponse.json({ error: false });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: true, message: "Failed to delete" }, { status: 500 });
  }
}