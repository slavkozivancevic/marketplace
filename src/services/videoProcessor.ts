import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";

import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

import { s3, S3_BUCKET } from "./s3";
import { tagS3ObjectPending } from "./s3Tagging";
import { PENDING_TAG_HEADER_VALUE } from "@/constants/constants";
import { VideoProcessorError } from "@/features/common/errors/domainErrors";
import { VideoProcessingResult } from "@/types/types";

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
ffmpeg.setFfprobePath(ffprobeInstaller.path);

type Probe = {
  durationMs: number;
  width: number;
  height: number;
  mimeType: string;
};

function probe(localPath: string): Promise<Probe> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(localPath, (err, data) => {
      if (err) return reject(new VideoProcessorError(err.message));

      const videoStream = data.streams.find((s) => s.codec_type === "video");
      if (!videoStream) {
        return reject(new VideoProcessorError("No video stream found"));
      }

      const formatName = data.format.format_name?.split(",")[0] ?? "mp4";
      // ffprobe reports container format (e.g. "mov,mp4,m4a,3gp"); collapse to
      // the standard mime our players support.
      const mimeType = formatName.includes("webm") ? "video/webm" : "video/mp4";

      resolve({
        durationMs: Math.round(Number(data.format.duration ?? 0) * 1000),
        width: videoStream.width ?? 0,
        height: videoStream.height ?? 0,
        mimeType,
      });
    });
  });
}

function extractPosterFrame(
  localPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(localPath)
      // Grab a frame ~1s in; fall back to 0 if the clip is shorter than that.
      .seekInput("00:00:01")
      .frames(1)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new VideoProcessorError(err.message)))
      .run();
  });
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Uint8Array) return Buffer.from(stream);
  if (stream instanceof Buffer) return stream;
  if (typeof (stream as NodeJS.ReadableStream).pipe === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as NodeJS.ReadableStream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new VideoProcessorError("Unsupported S3 Body type");
}

export async function processVideo({
  key,
}: {
  key: string;
}): Promise<VideoProcessingResult> {
  if (!key) throw new VideoProcessorError("Missing key for video processing");

  const workDir = path.join(tmpdir(), `vp-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  const sourcePath = path.join(workDir, "source");
  const framePath = path.join(workDir, "frame.png");
  const posterPath = path.join(workDir, "poster.webp");

  try {
    // Defense-in-depth: the presigned PUT already tagged the original with
    // x-amz-tagging on upload, but we re-apply here in case that header was
    // ever stripped (proxy, misconfigured client) or the tag was somehow
    // cleared between upload and process. Idempotent - same tag value.
    await tagS3ObjectPending(key);

    const object = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    );
    if (!object.Body) throw new VideoProcessorError("S3 object body is empty");

    const buffer = await streamToBuffer(object.Body);
    await fs.writeFile(sourcePath, buffer);

    const meta = await probe(sourcePath);
    await extractPosterFrame(sourcePath, framePath);

    // Convert the raw PNG frame into a 300×300 webp to match the image
    // pipeline's thumbnail dimensions so downstream <Image> sizing stays
    // consistent across both media types.
    const sharp = (await import("sharp")).default;
    const posterBuffer = await sharp(framePath)
      .resize(300, 300, { fit: "cover" })
      .toFormat("webp")
      .toBuffer();
    await fs.writeFile(posterPath, posterBuffer);

    const thumbKey = key.replace("/products/", "/products/thumbs/") + ".webp";

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: thumbKey,
        Body: posterBuffer,
        ContentType: "image/webp",
        Tagging: PENDING_TAG_HEADER_VALUE,
      }),
    );

    const videoDownloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      { expiresIn: 3600 },
    );
    const posterDownloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: thumbKey }),
      { expiresIn: 3600 },
    );

    return {
      key,
      thumbKey,
      videoDownloadUrl,
      posterDownloadUrl,
      mimeType: meta.mimeType,
      durationMs: meta.durationMs,
      width: meta.width,
      height: meta.height,
    };
  } catch (err) {
    if (err instanceof VideoProcessorError) throw err;
    if (err instanceof Error) throw new VideoProcessorError(err.message);
    throw new VideoProcessorError("Unknown error during video processing");
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}