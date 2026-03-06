import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireApiAuth } from "@/lib/api-guards";
import { s3Bucket, s3Client } from "@/lib/s3";

const DEFAULT_EXPIRES_IN = 3600; // 1 hour

export async function GET(request: Request) {
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

  if (!s3Bucket) {
    return NextResponse.json(
      { error: "S3 bucket is not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key || !key.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid key parameter" },
      { status: 400 },
    );
  }

  // ADMIN: only keys under their tenant
  if (
    session.user.role === Role.ADMIN &&
    session.user.tenantId &&
    !key.startsWith(`${session.user.tenantId}/`)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // HOST: only keys under their tenant (upload list is already scoped to userId; allow download for same scope)
  if (session.user.role === Role.HOST && session.user.tenantId) {
    if (!key.startsWith(`${session.user.tenantId}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const expiresIn = Number(process.env.S3_PRESIGN_EXPIRES ?? DEFAULT_EXPIRES_IN);
  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return NextResponse.redirect(url);
}
