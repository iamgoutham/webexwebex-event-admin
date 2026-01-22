import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { requireApiAuth } from "@/lib/api-guards";
import { s3Bucket, s3Client } from "@/lib/s3";

const completeSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().min(1),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const { session, response } = await requireApiAuth([
    Role.HOST,
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

  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (
    session.user.role === Role.ADMIN &&
    session.user.tenantId &&
    !parsed.data.key.startsWith(`${session.user.tenantId}/`)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sortedParts = [...parsed.data.parts].sort(
    (a, b) => a.partNumber - b.partNumber,
  );

  const command = new CompleteMultipartUploadCommand({
    Bucket: s3Bucket,
    Key: parsed.data.key,
    UploadId: parsed.data.uploadId,
    MultipartUpload: {
      Parts: sortedParts.map((part) => ({
        ETag: part.etag,
        PartNumber: part.partNumber,
      })),
    },
  });

  const result = await s3Client.send(command);

  return NextResponse.json({
    key: parsed.data.key,
    bucket: s3Bucket,
    location: result.Location ?? null,
  });
}
