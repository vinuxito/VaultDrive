export interface BuildDropUploadFormDataParams {
  file: File;
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  relativePath: string;
  clientMessage?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

export function buildDropUploadFormData({
  file,
  encryptedData,
  iv,
  relativePath,
  clientMessage,
}: BuildDropUploadFormDataParams): FormData {
  const formData = new FormData();
  const uploadedFilename = relativePath || file.name;

  formData.append("files[]", new Blob([encryptedData]), uploadedFilename);
  formData.append("iv", bytesToBase64(iv));
  formData.append("salt", "");
  formData.append("algorithm", "AES-256-GCM");

  if (clientMessage) {
    formData.append("client_message", clientMessage);
  }

  return formData;
}
