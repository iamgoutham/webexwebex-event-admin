import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;

const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

export const s3Client = new S3Client({
  region,
  credentials,
});

export const s3Bucket = process.env.AWS_S3_BUCKET ?? "";
