import { describe, expect, it } from "vitest";

import { collectFilesFromDataTransferItems } from "./drop-drag";

type MockFileEntry = {
  isFile: true;
  isDirectory: false;
  name: string;
  file: (callback: (file: File) => void) => void;
};

type MockDirectoryEntry = {
  isFile: false;
  isDirectory: true;
  name: string;
  createReader: () => {
    readEntries: (callback: (entries: Array<MockFileEntry | MockDirectoryEntry>) => void) => void;
  };
};

function createAsyncFileEntry(name: string, content: string): MockFileEntry {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file(callback) {
      setTimeout(() => callback(new File([content], name, { type: "text/plain" })), 0);
    },
  };
}

function createDirectoryEntry(
  name: string,
  entries: Array<MockFileEntry | MockDirectoryEntry>,
): MockDirectoryEntry {
  let emitted = false;

  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader() {
      return {
        readEntries(callback) {
          setTimeout(() => {
            if (emitted) {
              callback([]);
              return;
            }

            emitted = true;
            callback(entries);
          }, 0);
        },
      };
    },
  };
}

describe("collectFilesFromDataTransferItems", () => {
  it("awaits async folder traversal and preserves nested relative paths", async () => {
    const nestedFolder = createDirectoryEntry("nested", [
      createAsyncFileEntry("deep-file.txt", "nested file"),
    ]);
    const rootFolder = createDirectoryEntry("drag-folder", [
      createAsyncFileEntry("top-level.txt", "top level file"),
      nestedFolder,
    ]);

    const files = await collectFilesFromDataTransferItems([
      {
        webkitGetAsEntry: () => rootFolder,
      },
    ]);

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.name).sort()).toEqual([
      "deep-file.txt",
      "top-level.txt",
    ]);
    expect(
      files.map((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath).sort(),
    ).toEqual([
      "drag-folder/nested/deep-file.txt",
      "drag-folder/top-level.txt",
    ]);
  });
});
