import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/guards";
import { s3Bucket, s3Client } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
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

type PageProps = {
  searchParams: Promise<{ key?: string }>;
};

export default async function SummarizeReportPage({
  searchParams,
}: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const key = params.key;
  if (!key) {
    redirect("/dashboard/uploads");
  }

  let summary = "";
  let error: string | null = null;
  try {
    const report = await getReportText(key);
    summary = await summarizeWithBedrock(report);
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to summarize report via Bedrock.";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded-3xl border border-[#e5c18e] bg-[#fffdf7] p-6 text-sm text-[#3b1a1f] shadow-lg sm:p-8">
      <h1 className="text-xl font-semibold text-[#3b1a1f]">
        Video report summary
      </h1>
      <p className="text-xs text-[#8a5b44]">
        This summary is generated automatically from your uploaded video report
        to help you quickly see whether the recording looks valid for the
        event.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      ) : (
        <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-[#e5c18e] bg-white p-4 text-sm leading-relaxed text-[#3b1a1f]">
          {summary}
        </div>
      )}
      <p className="pt-2 text-xs text-[#8a5b44]">
        Tip: Look for a clear “Good” or “Needs Correction” message above. If it
        says “Needs Correction”, please re-record following the instructions and
        upload again.
      </p>
    </div>
  );
}

