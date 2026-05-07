import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import {
  CompleteMultipartUploadCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { requireApiAuth } from "@/lib/api-guards";
import { getHostIdForEmail } from "@/lib/license-site";
import { prisma } from "@/lib/prisma";
import { s3Bucket, s3Client } from "@/lib/s3";
import { ensureUserShortId } from "@/lib/user-short-id";

const attestationSchema = z
  .object({
    hostName: z.string().min(1),
    hostEmail: z.string().email(),
    participantsAssigned: z.number().int().min(0),
    participantsAttendedWithVideo: z.number().int().min(0),
    signature: z.string().min(1),
    attestedAt: z.string().optional(),
  })
  .refine(
    (a) => a.participantsAssigned >= a.participantsAttendedWithVideo,
    {
      message:
        "The number of participants with video ON should be lower than or equal to the total participants",
      path: ["participantsAssigned"],
    },
  );

const completeSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  filename: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  sizeBytes: z.number().int().positive().optional(),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().min(1),
      }),
    )
    .min(1),
  attestation: attestationSchema,
});

const safeSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");

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
  if (session.user.role !== Role.SUPERADMIN && !session.user.tenantId) {
    return NextResponse.json(
      { error: "Tenant is required for uploads" },
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
    session.user.role !== Role.SUPERADMIN &&
    session.user.tenantId &&
    !parsed.data.key.startsWith(`${session.user.tenantId}/`)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.role === Role.HOST && session.user.tenantId) {
    const sheetShortId = session.user.email
      ? await getHostIdForEmail(session.user.email)
      : null;
    const shortId =
      sheetShortId ??
      (await ensureUserShortId(
        session.user.id,
        session.user.email,
        session.user.shortId,
      ));
    const shortIdSegment = safeSegment(shortId);
    if (
      !parsed.data.key.startsWith(
        `${session.user.tenantId}/${shortIdSegment}/`,
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

  const attestationKey = `${parsed.data.key}.attest`;
  const attestationBody = JSON.stringify(parsed.data.attestation, null, 2);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: attestationKey,
      Body: attestationBody,
      ContentType: "application/json",
    }),
  );

  await prisma.upload.create({
    data: {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      filename: parsed.data.filename ?? null,
      contentType: parsed.data.contentType ?? null,
      sizeBytes: parsed.data.sizeBytes ?? null,
      bucket: s3Bucket,
      key: parsed.data.key,
      uploadId: parsed.data.uploadId,
      location: result.Location ?? null,
      status: "COMPLETED",
    },
  });

  return NextResponse.json({
    key: parsed.data.key,
    bucket: s3Bucket,
    location: result.Location ?? null,
  });
}
