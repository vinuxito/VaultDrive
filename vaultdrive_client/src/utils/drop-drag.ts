export interface DragFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

export interface DragFileSystemFileEntry extends DragFileSystemEntry {
  isFile: true;
  isDirectory: false;
  file: (callback: (file: File) => void) => void;
}

export interface DragFileSystemDirectoryEntry extends DragFileSystemEntry {
  isFile: false;
  isDirectory: true;
  createReader: () => {
    readEntries: (callback: (entries: DragFileSystemEntry[]) => void) => void;
  };
}

export interface DragDataTransferItem {
  webkitGetAsEntry?: () => DragFileSystemEntry | null;
}

function withRelativePath(file: File, relativePath: string): File {
  Object.defineProperty(file, "webkitRelativePath", {
    value: relativePath,
    configurable: true,
  });
  return file;
}

function readFileEntry(entry: DragFileSystemFileEntry): Promise<File> {
  return new Promise((resolve) => {
    entry.file((file) => resolve(file));
  });
}

function readDirectoryEntries(entry: DragFileSystemDirectoryEntry): Promise<DragFileSystemEntry[]> {
  return new Promise((resolve) => {
    const reader = entry.createReader();
    const collected: DragFileSystemEntry[] = [];

    const pump = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(collected);
          return;
        }

        collected.push(...entries);
        pump();
      });
    };

    pump();
  });
}

async function collectFilesFromEntry(entry: DragFileSystemEntry, path = ""): Promise<File[]> {
  if (entry.isFile) {
    const file = await readFileEntry(entry as DragFileSystemFileEntry);
    return path ? [withRelativePath(file, `${path}/${file.name}`)] : [file];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const childEntries = await readDirectoryEntries(entry as DragFileSystemDirectoryEntry);
  const nextPath = path ? `${path}/${entry.name}` : entry.name;
  const nestedFiles = await Promise.all(childEntries.map((child) => collectFilesFromEntry(child, nextPath)));
  return nestedFiles.flat();
}

export async function collectFilesFromDataTransferItems(items: DragDataTransferItem[]): Promise<File[]> {
  const entries = items
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is DragFileSystemEntry => entry !== null);

  const files = await Promise.all(entries.map((entry) => collectFilesFromEntry(entry)));
  return files.flat();
}
