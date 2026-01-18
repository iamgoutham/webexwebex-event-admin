import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireApiAuth } from "@/lib/api-guards";
import { s3Bucket, s3Client } from "@/lib/s3";
import { ensureUserShortId } from "@/lib/user-short-id";

const presignSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  folder: z.string().optional(),
  partCount: z.number().int().min(1).max(10000),
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
  if (session.user.role === Role.ADMIN && !session.user.tenantId) {
    return NextResponse.json(
      { error: "Tenant is required for admin uploads" },
      { status: 400 },
    );
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

  const shortId = await ensureUserShortId(session.user.id, session.user.shortId);
  const shortIdSegment = safeSegment(shortId);

  const folderSegments = parsed.data.folder
    ? parsed.data.folder
        .split("/")
        .map(safeSegment)
        .filter(Boolean)
    : [];

  const key = [
    tenantPrefix,
    ...folderSegments,
    `${shortIdSegment}-${Date.now()}-${safeFilename(parsed.data.filename)}`,
  ].join("/");

  const createCommand = new CreateMultipartUploadCommand({
    Bucket: s3Bucket,
    Key: key,
    ContentType: parsed.data.contentType,
  });

  const createResult = await s3Client.send(createCommand);
  if (!createResult.UploadId) {
    return NextResponse.json(
      { error: "Unable to initiate multipart upload" },
      { status: 500 },
    );
  }

  const parts = await Promise.all(
    Array.from({ length: parsed.data.partCount }, async (_, index) => {
      const partNumber = index + 1;
      const partCommand = new UploadPartCommand({
        Bucket: s3Bucket,
        Key: key,
        UploadId: createResult.UploadId,
        PartNumber: partNumber,
      });
      const url = await getSignedUrl(s3Client, partCommand, { expiresIn });
      return { partNumber, url };
    }),
  );

  return NextResponse.json({
    uploadId: createResult.UploadId,
    key,
    parts,
    bucket: s3Bucket,
    expiresIn,
  });
}
