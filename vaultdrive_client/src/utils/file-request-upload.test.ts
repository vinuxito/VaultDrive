import { describe, expect, it } from "vitest";

import { buildFileRequestUploadFormData } from "./file-request-upload";

describe("buildFileRequestUploadFormData", () => {
  it("includes the explicit relative path for nested folder uploads", () => {
    const formData = buildFileRequestUploadFormData({
      encryptedData: new Uint8Array([1, 2, 3]).buffer,
      ivBase64: "iv-base64",
      saltBase64: "salt-base64",
      relativePath: "client-a/nested/report.pdf",
      fallbackName: "report.pdf",
    });

    const uploadEntry = formData.get("file");
    expect(uploadEntry).toBeInstanceOf(File);
    expect((uploadEntry as File).name).toBe("client-a/nested/report.pdf");
    expect(formData.get("relative_path")).toBe("client-a/nested/report.pdf");
  });

  it("falls back to the plain filename when no relative path exists", () => {
    const formData = buildFileRequestUploadFormData({
      encryptedData: new Uint8Array([4, 5, 6]).buffer,
      ivBase64: "iv-base64",
      saltBase64: "salt-base64",
      relativePath: "",
      fallbackName: "plain.txt",
    });

    const uploadEntry = formData.get("file");
    expect(uploadEntry).toBeInstanceOf(File);
    expect((uploadEntry as File).name).toBe("plain.txt");
    expect(formData.get("relative_path")).toBe("plain.txt");
  });
});
