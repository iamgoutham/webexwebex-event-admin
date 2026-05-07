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
  | {
      status: "done";
      progress: number;
      key: string;
      uploadId: string;
      message?: string;
    }
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

type UploadPanelProps = {
  defaultHostName?: string;
  defaultHostEmail?: string;
};

export default function UploadPanel({
  defaultHostName = "",
  defaultHostEmail = "",
}: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [folder] = useState("recordings");
  const [hostName, setHostName] = useState(defaultHostName);
  const [hostEmail, setHostEmail] = useState(defaultHostEmail);
  const [participantsAssigned, setParticipantsAssigned] = useState("");
  const [participantsAttendedWithVideo, setParticipantsAttendedWithVideo] =
    useState("");
  const [signature, setSignature] = useState("");
  const [state, setState] = useState<UploadState>({
    status: "idle",
    progress: 0,
  });

  const assignedNum = participantsAssigned.trim() === "" ? NaN : parseInt(participantsAssigned, 10);
  const attendedNum = participantsAttendedWithVideo.trim() === "" ? NaN : parseInt(participantsAttendedWithVideo, 10);
  const participantCountsValid =
    !Number.isNaN(assignedNum) &&
    !Number.isNaN(attendedNum) &&
    assignedNum >= 0 &&
    attendedNum >= 0 &&
    assignedNum >= attendedNum;

  const formComplete =
    hostName.trim() !== "" &&
    hostEmail.trim() !== "" &&
    participantCountsValid &&
    signature.trim() !== "";

  const partSize = useMemo(
    () => (file ? computePartSize(file.size) : 0),
    [file],
  );
  const partCount = useMemo(
    () => (file ? Math.ceil(file.size / partSize) : 0),
    [file, partSize],
  );

  const handleUpload = async () => {
    try {
      if (!file) {
        setState({
          status: "error",
          progress: 0,
          message: "Select a file before uploading.",
        });
        return;
      }

      if (!participantCountsValid) {
        setState({
          status: "error",
          progress: 0,
          message:
            "The number of participants with video ON should be lower than or equal to the total participants",
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

      const attestation = {
        hostName: hostName.trim(),
        hostEmail: hostEmail.trim(),
        participantsAssigned: assignedNum,
        participantsAttendedWithVideo: attendedNum,
        signature: signature.trim(),
        attestedAt: new Date().toISOString(),
      };

      const completeResponse = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: presignData.key,
          uploadId: presignData.uploadId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          parts,
          attestation,
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
        message: "Upload complete.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected error during upload.";
      setState({ status: "error", progress: 0, message });
    }
  };

  return (
    <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 text-[#3b1a1f] shadow-md sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Upload recordings from local directory to Cloud.
        </h2>
        <span className="text-xs text-[#8a5b44]">
          File will be uploaded in parts directly to cloud
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        <p className="text-sm font-medium text-[#6b4e3d]">
          Attestation (host information prefilled from your account)
        </p>
        <label className="flex flex-col gap-2 text-sm text-[#6b4e3d]">
          Host name
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Your name"
            className="rounded-lg border border-[#e5c18e] bg-white/70 px-3 py-2 text-sm text-[#3b1a1f]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-[#6b4e3d]">
          Host email
          <input
            type="email"
            value={hostEmail}
            onChange={(e) => setHostEmail(e.target.value)}
            placeholder="your@email.com"
            className="rounded-lg border border-[#e5c18e] bg-white/70 px-3 py-2 text-sm text-[#3b1a1f]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-[#6b4e3d]">
          1) Total number of participants in this video you are uploading
          <input
            type="number"
            min={0}
            value={participantsAssigned}
            onChange={(e) => setParticipantsAssigned(e.target.value)}
            placeholder="0"
            className="rounded-lg border border-[#e5c18e] bg-white/70 px-3 py-2 text-sm text-[#3b1a1f]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-[#6b4e3d]">
          2) In this video, number of participants with video ON and Audio ON
          <input
            type="number"
            min={0}
            value={participantsAttendedWithVideo}
            onChange={(e) => setParticipantsAttendedWithVideo(e.target.value)}
            placeholder="0"
            className="rounded-lg border border-[#e5c18e] bg-white/70 px-3 py-2 text-sm text-[#3b1a1f]"
          />
        </label>
        {!Number.isNaN(assignedNum) &&
        !Number.isNaN(attendedNum) &&
        assignedNum >= 0 &&
        attendedNum >= 0 &&
        attendedNum > assignedNum ? (
          <p className="text-sm text-[#9a3b2e]">
            The number of participants with video ON should be lower than or
            equal to the total participants
          </p>
        ) : null}
        <p className="text-sm italic text-[#6b4e3d]">
          I <strong>{hostName || "[Host name]"}</strong>{" "}
          <strong>{hostEmail || "[Host email]"}</strong> attest the following
          information is observed by me in the following file I am uploading.
        </p>
        <label className="flex flex-col gap-2 text-sm text-[#6b4e3d]">
          Signature (type in your full name)
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Your signature"
            className="rounded-lg border border-[#e5c18e] bg-white/70 px-3 py-2 text-sm text-[#3b1a1f]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-[#6b4e3d]">
          File
          <input
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setState({ status: "idle", progress: 0 });
            }}
            className="rounded-lg border border-[#e5c18e] bg-white/70 px-3 py-2 text-sm text-[#3b1a1f]"
          />
        </label>
      </div>

      <div className="mt-4 text-xs text-[#8a5b44]">
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
            !formComplete ||
            !file ||
            state.status === "requesting" ||
            state.status === "uploading" ||
            state.status === "finishing"
          }
          className="rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425] disabled:cursor-not-allowed disabled:bg-[#d8792d]/40"
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
          <span className="text-xs text-[#8a5b44]">{state.message}</span>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="h-2 overflow-hidden rounded-full bg-[#f3d6a3]">
          <div
            className="h-full bg-[#7a3b2a] transition-all"
            style={{ width: `${Math.round(state.progress * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-[#8a5b44]">
          {Math.round(state.progress * 100)}% complete
        </div>
      </div>

      {state.status === "done" ? (
        <div className="mt-6 rounded-2xl border border-[#7a3b2a]/30 bg-[#f7e2b6] p-4 text-xs text-[#6b4e3d]">
          <p className="font-semibold text-[#3b1a1f]">Upload complete</p>
          <p className="mt-2">Key: {state.key}</p>
          <p>Upload ID: {state.uploadId}</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-6 rounded-2xl border border-[#9a3b2e]/30 bg-[#f7d4c7] p-4 text-xs text-[#7a2f24]">
          <p className="font-semibold text-[#7a2f24]">Upload failed</p>
          <p className="mt-2">{state.message}</p>
        </div>
      ) : null}
    </div>
  );
}
