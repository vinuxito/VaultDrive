import React from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

export type FileTypeFilter = "all" | "images" | "documents" | "audio" | "video" | "archives";

interface FileSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  typeFilter: FileTypeFilter;
  setTypeFilter: (filter: FileTypeFilter) => void;
}

export const FileSearch: React.FC<FileSearchProps> = ({
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
}) => {
  const { t } = useTranslation(["drive"]);

  const TYPE_FILTER_LABELS: Record<FileTypeFilter, string> = {
    all: t("drive:vault.filterAll", "All Files"),
    images: t("drive:vault.filterImages", "Images"),
    documents: t("drive:vault.filterDocs", "Documents"),
    audio: t("drive:vault.filterAudio", "Audio"),
    video: t("drive:vault.filterVideo", "Video"),
    archives: t("drive:vault.filterArchives", "Archives"),
  };

  return (
    <div className="px-6 py-3 border-b border-border/60 bg-background shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("drive:vault.search")}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-muted focus:bg-background focus:border-primary/40 focus:outline-none transition-all"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(Object.keys(TYPE_FILTER_LABELS) as FileTypeFilter[]).map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
                typeFilter === type
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {TYPE_FILTER_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
