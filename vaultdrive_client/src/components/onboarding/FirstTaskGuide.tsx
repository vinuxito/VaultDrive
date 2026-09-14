import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";

export type FirstTask = "upload" | "share" | "receive";

interface Props {
  task: FirstTask;
  fileCount: number | null;
  onUpload: () => void;
  onShare: () => void;
  onReceive: () => void;
  onDismiss: () => void;
}

export function FirstTaskGuide({ task, fileCount, onUpload, onShare, onReceive, onDismiss }: Props) {
  const { t } = useTranslation(["drive"]);
  const copy = (key: string, fallback: string) => t(`drive:firstTask.${key}`, { defaultValue: fallback });
  const hasFile = fileCount !== null && fileCount > 0;
  return (
    <section className="m-4 rounded-xl border border-primary/30 bg-card p-4 space-y-3" aria-label={copy("title", "Your next step")}>
      <p className="font-semibold text-foreground">{copy("title", "Your next step")}</p>
      <p role="status" className="text-sm text-muted-foreground">
        {fileCount === null ? copy("unknown", "File status is not confirmed yet.")
          : hasFile ? copy("stored", "Your file is in the vault. Choose a file to share, or create a link to receive files.")
          : task === "receive" ? copy("receiveHint", "Create an upload link for someone to send files to you. They do not need your PIN.")
          : copy("uploadHint", "Upload a file first. Then use its share action to choose who can access it.")}
      </p>
      <div className="flex flex-wrap gap-2">
        {task !== "receive" && <Button onClick={onUpload}>{copy("upload", "Upload a file")}</Button>}
        {hasFile && <Button variant="outline" onClick={onShare}>{copy("share", "Choose a file to share")}</Button>}
        <Button variant={task === "receive" ? "default" : "outline"} onClick={onReceive}>{copy("receive", "Receive files")}</Button>
        <Button variant="ghost" onClick={onDismiss}>{copy("dismiss", "Hide guidance")}</Button>
      </div>
    </section>
  );
}
