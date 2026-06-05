import React from "react";
import { useTranslation } from "react-i18next";

interface UploadZoneProps {
  isDragging: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ isDragging }) => {
  const { t } = useTranslation(["drive"]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className="border-4 border-dashed border-white/60 rounded-2xl p-16 text-white text-2xl font-semibold">
        {t("drive:vault.dropToUpload")}
      </div>
    </div>
  );
};
