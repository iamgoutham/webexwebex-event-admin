import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { requireAuth } from "@/lib/guards";
import { s3Bucket, s3Client } from "@/lib/s3";
import { bedrockClient } from "@/lib/bedrock";

const MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

const SUMMARY_PROMPT =
  'Analyze this report to check and make sure the user can know if the video is valid. For a valid video all persons in the video should have their video turned on, a clock must be present with the title "Chinmaya Gita Samarpanam" on the screen not blocking any users. Show this is a Good or Needs Correction kind of summary low tech users can understand.';

async function getReportText(key: string): Promise<string> {
  if (!s3Bucket) {
    throw new Error("AWS_S3_BUCKET is not configured.");
  }

  const normalizedKey = key.endsWith(".report") ? key : `${key}.report`;
  const res = await s3Client.send(
    new GetObjectCommand({
      Bucket: s3Bucket,
      Key: normalizedKey,
    }),
  );

  const body = await res.Body?.transformToString("utf-8");
  if (!body) {
    throw new Error("Report file is empty or unreadable.");
  }
  return body;
}

async function summarizeWithBedrock(report: string): Promise<string> {
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 600,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${SUMMARY_PROMPT}\n\nReport:\n\n${report}`,
          },
        ],
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: Buffer.from(JSON.stringify(payload)),
  });

  const response = await bedrockClient.send(command);
  const json = JSON.parse(
    new TextDecoder("utf-8").decode(response.body),
  ) as {
    content?: { text?: string }[];
  };

  const text =
    json.content?.[0]?.text?.trim() ??
    "Unable to generate a summary for this report.";
  return text;
}

// GET /api/uploads/summarize-report?key=<s3 key or base key>
export async function GET(request: NextRequest) {
  await requireAuth(); // any authenticated user (host/admin) can see their summaries

  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }

  try {
    const report = await getReportText(key);
    const summary = await summarizeWithBedrock(report);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[summarize-report] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to summarize report via Bedrock.",
      },
      { status: 500 },
    );
  }
}

