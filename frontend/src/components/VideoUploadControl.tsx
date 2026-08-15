import { useState } from "react";
import { ownerApi } from "../lib/api";
import { uploadWithProgress } from "../lib/upload";

const MAX_FILENAME_LENGTH = 100;

export function VideoUploadControl({
  token,
  lessonId,
  onCompleted,
}: {
  token: string;
  lessonId: string;
  onCompleted?: () => void;
}) {
  const [state, setState] = useState("");
  const [percent, setPercent] = useState(0);
  async function upload(file: File) {
    if (file.name.length > MAX_FILENAME_LENGTH) {
      setState(
        `Filename is too long. Maximum ${MAX_FILENAME_LENGTH} characters.`,
      );
      return;
    }
    setState("Authorizing…");
    try {
      const upload = await ownerApi.initiateVideoUpload(token, lessonId, {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (upload.uploadMode === "SINGLE" && upload.uploadUrl) {
        setState("Uploading");
        await uploadWithProgress(upload.uploadUrl, file, file.type, setPercent);
        await ownerApi.completeVideoUpload(token, upload.id);
      } else {
        const size = upload.partSizeBytes ?? 16 * 1024 * 1024;
        const parts: Array<{ partNumber: number; etag: string }> = [];
        const total = Math.ceil(file.size / size);
        for (let partNumber = 1; partNumber <= total; partNumber += 1) {
          setState(`Uploading part ${partNumber} of ${total}`);
          const signed = await ownerApi.multipartPart(
            token,
            upload.id,
            partNumber,
          );
          const chunk = file.slice(
            (partNumber - 1) * size,
            Math.min(partNumber * size, file.size),
          );
          const etag = await uploadWithProgress(
            signed.uploadUrl,
            chunk,
            file.type,
            (value) =>
              setPercent(
                Math.round(((partNumber - 1 + value / 100) / total) * 100),
              ),
          );
          if (!etag) throw new Error("etag");
          parts.push({ partNumber, etag });
        }
        await ownerApi.multipartComplete(token, upload.id, parts);
      }
      setState("Processing started");
      onCompleted?.();
    } catch {
      setState("Upload failed. Try again.");
    }
  }
  return (
    <span className="upload-control">
      <label className="text-button">
        {state || "Upload video"}
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setPercent(0);
              void upload(file);
            }
          }}
        />
      </label>
      {state && (
        <>
          <small>
            {state}
            {state.startsWith("Uploading") ? ` ${percent}%` : ""}
          </small>
          {state.startsWith("Uploading") && (
            <progress max="100" value={percent} />
          )}
        </>
      )}
    </span>
  );
}
