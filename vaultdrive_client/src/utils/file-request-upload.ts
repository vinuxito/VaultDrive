export interface BuildFileRequestUploadFormDataParams {
  encryptedData: ArrayBuffer;
  ivBase64: string;
  saltBase64: string;
  relativePath: string;
  fallbackName: string;
}

export function buildFileRequestUploadFormData({
  encryptedData,
  ivBase64,
  saltBase64,
  relativePath,
  fallbackName,
}: BuildFileRequestUploadFormDataParams): FormData {
  const formData = new FormData();
  const uploadName = relativePath || fallbackName;

  formData.append("file", new Blob([encryptedData]), uploadName);
  formData.append("relative_path", uploadName);
  formData.append("iv", ivBase64);
  formData.append("algorithm", "AES-256-GCM");
  formData.append("pin_wrapped_key", saltBase64);

  return formData;
}
