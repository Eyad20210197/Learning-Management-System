import { useState } from "react";
import { ownerApi } from "../lib/api";
import { uploadWithProgress } from "../lib/upload";

const MAX_FILENAME_LENGTH = 100;

export function ResourceUploadControl({
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
      const authorized = await ownerApi.initiateResourceUpload(
        token,
        lessonId,
        {
          title: file.name,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      );
      setState("Uploading");
      await uploadWithProgress(
        authorized.uploadUrl,
        file,
        file.type,
        setPercent,
      );
      await ownerApi.completeResourceUpload(token, authorized.id);
      setState("Ready");
      onCompleted?.();
    } catch {
      setState("Upload failed");
    }
  }
  return (
    <label className="text-button">
      {state || "Add resource"}
      {state.startsWith("Uploading") ? ` ${percent}%` : ""}
      <input
        hidden
        type="file"
        accept="application/pdf,text/plain,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setPercent(0);
            void upload(file);
          }
        }}
      />
    </label>
  );
}
