import { describe, expect, it } from "vitest";

import { buildDropUploadFormData } from "./drop-upload";

describe("buildDropUploadFormData", () => {
  it("uses the backend-supported files[] field for folder uploads while preserving relative paths", () => {
    const file = new File(["hello"], "report.pdf", { type: "application/pdf" });
    const encryptedData = new Uint8Array([1, 2, 3]).buffer;
    const iv = new Uint8Array([4, 5, 6]);

    const formData = buildDropUploadFormData({
      file,
      encryptedData,
      iv,
      relativePath: "client/sub/report.pdf",
      clientMessage: "Please review",
    });

    const uploadEntry = formData.get("files[]");
    expect(uploadEntry).toBeInstanceOf(File);
    expect((uploadEntry as File).name).toBe("client/sub/report.pdf");
    expect(formData.get("relative_path")).toBe("client/sub/report.pdf");
    expect(formData.get("client/sub/report.pdf")).toBeNull();
    expect(formData.get("client_message")).toBe("Please review");
  });

  it("uses the same files[] field for plain single-file uploads", () => {
    const file = new File(["hello"], "report.pdf", { type: "application/pdf" });
    const encryptedData = new Uint8Array([1, 2, 3]).buffer;
    const iv = new Uint8Array([4, 5, 6]);

    const formData = buildDropUploadFormData({
      file,
      encryptedData,
      iv,
      relativePath: "",
    });

    const uploadEntry = formData.get("files[]");
    expect(uploadEntry).toBeInstanceOf(File);
    expect((uploadEntry as File).name).toBe("report.pdf");
    expect(formData.get("relative_path")).toBe("report.pdf");
  });
});
