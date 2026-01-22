"use client";

import { useMemo, useState } from "react";

type PresignResponse = {
  uploadId: string;
  key: string;
  parts: { partNumber: number; url: string }[];
  bucket: string;
  expiresIn: number;
};

type UploadState =
  | { status: "idle"; progress: number; message?: string }
  | { status: "requesting"; progress: number; message?: string }
  | { status: "uploading"; progress: number; message?: string }
  | { status: "finishing"; progress: number; message?: string }
  | { status: "done"; progress: number; key: string; uploadId: string }
  | { status: "error"; progress: number; message: string };

const MIN_PART_SIZE = 5 * 1024 * 1024;
const MAX_PARTS = 10000;

const formatBytes = (value: number) => {
  if (value === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const scaled = value / Math.pow(1024, index);
  return `${scaled.toFixed(scaled >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const computePartSize = (fileSize: number) => {
  const minBasedOnParts = Math.ceil(fileSize / MAX_PARTS);
  return Math.max(minBasedOnParts, MIN_PART_SIZE);
};

const buildErrorMessage = async (response: Response) => {
  const fallback = `Upload failed with status ${response.status}`;
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
};

export default function UploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState("recordings");
  const [state, setState] = useState<UploadState>({
    status: "idle",
    progress: 0,
  });

  const partSize = useMemo(
    () => (file ? computePartSize(file.size) : 0),
    [file],
  );
  const partCount = useMemo(
    () => (file ? Math.ceil(file.size / partSize) : 0),
    [file, partSize],
  );

  const handleUpload = async () => {
    if (!file) {
      setState({
        status: "error",
        progress: 0,
        message: "Select a file before uploading.",
      });
      return;
    }

    setState({ status: "requesting", progress: 0 });

    const presignResponse = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        folder: folder.trim() || undefined,
        partCount,
      }),
    });

    if (!presignResponse.ok) {
      const message = await buildErrorMessage(presignResponse);
      setState({ status: "error", progress: 0, message });
      return;
    }

    const presignData = (await presignResponse.json()) as PresignResponse;
    setState({
      status: "uploading",
      progress: 0,
      message: `Uploading ${partCount} parts...`,
    });

    const parts: { partNumber: number; etag: string }[] = [];
    let uploadedBytes = 0;

    for (const part of presignData.parts) {
      const start = (part.partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const blob = file.slice(start, end);
      const uploadResponse = await fetch(part.url, {
        method: "PUT",
        body: blob,
      });

      if (!uploadResponse.ok) {
        const message = await buildErrorMessage(uploadResponse);
      setState({
        status: "error",
        progress: uploadedBytes / file.size,
        message,
      });
        return;
      }

      const etag = uploadResponse.headers.get("etag") ?? "";
      if (!etag) {
        setState({
          status: "error",
          progress: uploadedBytes / file.size,
          message: "Missing ETag on uploaded part.",
        });
        return;
      }

      parts.push({ partNumber: part.partNumber, etag });
      uploadedBytes += blob.size;
      setState({
        status: "uploading",
        progress: Math.min(uploadedBytes / file.size, 1),
        message: `Uploaded part ${part.partNumber} of ${partCount}`,
      });
    }

    setState({
      status: "finishing",
      progress: 1,
      message: "Finalizing multipart upload...",
    });

    const completeResponse = await fetch("/api/uploads/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: presignData.key,
        uploadId: presignData.uploadId,
        parts,
      }),
    });

    if (!completeResponse.ok) {
      const message = await buildErrorMessage(completeResponse);
      setState({ status: "error", progress: 1, message });
      return;
    }

    setState({
      status: "done",
      progress: 1,
      key: presignData.key,
      uploadId: presignData.uploadId,
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Upload recording to S3</h2>
        <span className="text-xs text-white/60">
          Multipart upload via presigned URLs
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <label className="flex flex-col gap-2 text-sm text-white/70">
          File
          <input
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setState({ status: "idle", progress: 0 });
            }}
            className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-white/70">
          Folder (optional)
          <input
            type="text"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
            placeholder="recordings"
          />
        </label>
      </div>

      <div className="mt-4 text-xs text-white/60">
        {file ? (
          <>
            <p>Size: {formatBytes(file.size)}</p>
            <p>
              Part size: {formatBytes(partSize)} • Parts: {partCount}
            </p>
          </>
        ) : (
          <p>Select a file to calculate multipart details.</p>
        )}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={handleUpload}
          disabled={
            !file ||
            state.status === "requesting" ||
            state.status === "uploading" ||
            state.status === "finishing"
          }
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:bg-white/40"
        >
          {state.status === "requesting"
            ? "Preparing..."
            : state.status === "uploading"
            ? "Uploading..."
            : state.status === "finishing"
            ? "Finalizing..."
            : "Start upload"}
        </button>
        {state.message ? (
          <span className="text-xs text-white/60">{state.message}</span>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${Math.round(state.progress * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-white/60">
          {Math.round(state.progress * 100)}% complete
        </div>
      </div>

      {state.status === "done" ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
          <p className="font-semibold text-emerald-100">Upload complete</p>
          <p className="mt-2">Key: {state.key}</p>
          <p>Upload ID: {state.uploadId}</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
          <p className="font-semibold text-red-100">Upload failed</p>
          <p className="mt-2">{state.message}</p>
        </div>
      ) : null}
    </div>
  );
}
