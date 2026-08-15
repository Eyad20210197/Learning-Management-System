export function uploadWithProgress(
  url: string,
  file: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve(request.getResponseHeader("etag"))
        : reject(new Error("upload"));
    request.onerror = () => reject(new Error("upload"));
    request.send(file);
  });
}
