import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireApiAuth } from "@/lib/api-guards";
import { s3Bucket, s3Client } from "@/lib/s3";

const presignSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  folder: z.string().optional(),
});

const safeSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");

const safeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-_.]/g, "_")
    .replace(/_+/g, "_");

export async function POST(request: Request) {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) {
    return response;
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!s3Bucket) {
    return NextResponse.json(
      { error: "S3 bucket is not configured" },
      { status: 500 },
    );
  }
  if (!process.env.AWS_REGION) {
    return NextResponse.json(
      { error: "AWS region is not configured" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const expiresIn = Number(process.env.S3_PRESIGN_EXPIRES ?? "900");

  const tenantPrefix =
    session.user.role === Role.SUPERADMIN
      ? "global"
      : session.user.tenantId ?? "tenant-unknown";

  const folderSegments = parsed.data.folder
    ? parsed.data.folder
        .split("/")
        .map(safeSegment)
        .filter(Boolean)
    : [];

  const key = [
    tenantPrefix,
    ...folderSegments,
    `${Date.now()}-${safeFilename(parsed.data.filename)}`,
  ].join("/");

  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ContentType: parsed.data.contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });

  return NextResponse.json({
    url,
    key,
    bucket: s3Bucket,
    expiresIn,
  });
}
