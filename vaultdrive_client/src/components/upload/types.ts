export interface FilesUploaded {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
}

export interface UploadTokenRaw {
  id?: string;
  token?: string;
  upload_url?: string;
  owner_user_id?: string;
  target_folder_id?: string;
  expires_at?: { Time: string; Valid: boolean } | null;
  max_files?: { Int32: number; Valid: boolean } | null;
  files_uploaded?: { Int32: number; Valid: boolean };
  used?: { Bool: boolean; Valid: boolean };
  created_at?: { Time: string; Valid: boolean };
  folder_name?: string;
  link_name?: string;
  has_password?: boolean;
}

export interface UploadToken {
  id: string;
  token: string;
  upload_url: string;
  expires_at: string | null;
  max_files: number | null;
  files_uploaded: number | null;
  used: boolean;
  created_at: string;
  folder_name?: string;
  link_name?: string;
  has_password?: boolean;
}

export interface UploadTokenWithFiles extends UploadToken {
  files?: FilesUploaded[];
}

export function normalizeUploadToken(raw: UploadTokenRaw): UploadToken {
  return {
    id: raw.id || raw.token || "",
    token: raw.token || raw.id || "",
    upload_url: raw.upload_url || `/drop/${raw.token || raw.id}`,
    expires_at: raw.expires_at?.Valid ? raw.expires_at.Time : null,
    max_files: raw.max_files?.Valid ? raw.max_files.Int32 : null,
    files_uploaded: raw.files_uploaded?.Valid ? raw.files_uploaded.Int32 : 0,
    used: raw.used?.Valid ? raw.used.Bool : false,
    created_at: raw.created_at?.Valid ? raw.created_at.Time : new Date().toISOString(),
    folder_name: raw.folder_name,
    link_name: raw.link_name,
    has_password: raw.has_password || false,
  };
}