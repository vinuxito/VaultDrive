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
    <section className="mx-4 my-3 rounded-xl border border-border/70 bg-card/90 backdrop-blur-md p-3.5 space-y-2.5 shadow-xs" aria-label={copy("title", "Your next step")}>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {copy("title", "Your next step")}
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
          {copy("dismiss", "Hide guidance")}
        </Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground leading-relaxed">
        {fileCount === null ? copy("unknown", "File status is not confirmed yet.")
          : hasFile ? copy("stored", "Your file is in the vault. Choose a file to share, or create a link to receive files.")
          : task === "receive" ? copy("receiveHint", "Create an upload link for someone to send files to you. They do not need your PIN.")
          : copy("uploadHint", "Upload a file first. Then use its share action to choose who can access it.")}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {task !== "receive" && <Button size="sm" onClick={onUpload}>{copy("upload", "Upload a file")}</Button>}
        {hasFile && <Button size="sm" variant="outline" onClick={onShare}>{copy("share", "Choose a file to share")}</Button>}
        <Button size="sm" variant={task === "receive" ? "default" : "outline"} onClick={onReceive}>{copy("receive", "Receive files")}</Button>
      </div>
    </section>
  );
}
