import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

const region = process.env.AWS_BEDROCK_REGION ?? process.env.AWS_REGION;

const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

export const bedrockClient = new BedrockRuntimeClient({
  region,
  credentials,
});

