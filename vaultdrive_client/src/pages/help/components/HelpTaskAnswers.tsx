import { useTranslation } from "react-i18next";
import type { HelpSection } from "../index";

interface TaskAnswer {
  key: string;
  defaultValue: string;
}

const ANSWERS: Partial<Record<HelpSection, TaskAnswer[]>> = {
  uploads_shares: [
    {
      key: "help:tasks.fullLink",
      defaultValue: "A full link includes everything after the #. Copy the complete link so the recipient's browser has the decryption key.",
    },
    {
      key: "help:tasks.credentials",
      defaultValue: "Your account PIN is never something to send to a recipient. A link password, sender password, and your vault PIN are different credentials.",
    },
    {
      key: "help:tasks.failedDownload",
      defaultValue: "If the link is complete and still active, retry the download. A server or network failure does not mean the link key is missing.",
    },
    {
      key: "help:tasks.revokeLimits",
      defaultValue: "Revoking a link stops future access. It cannot erase a file a recipient already downloaded.",
    },
  ],
  drop_portals: [
    {
      key: "help:tasks.partialUpload",
      defaultValue: "If some files fail, retry only the failed files after the page identifies which uploads were confirmed.",
    },
    {
      key: "help:tasks.senderPassword",
      defaultValue: "A File Request password protects that sender journey. It is not the owner's account password or vault PIN.",
    },
  ],
  vault_pin: [
    {
      key: "help:tasks.pinPurpose",
      defaultValue: "Your vault PIN unlocks supported owner and account-sharing keys in your browser. Never give it to another person.",
    },
    {
      key: "help:tasks.recoveryLimit",
      defaultValue: "Account recovery requires enough configured custodians. It cannot promise recovery when the required key shares are unavailable.",
    },
  ],
};

export function HelpTaskAnswers({ activeSection }: { activeSection: HelpSection }) {
  const { t } = useTranslation(["help"]);
  const answers = ANSWERS[activeSection];
  if (!answers?.length) return null;

  return (
    <section className="mt-10 rounded-xl border border-border bg-muted/40 p-5" aria-labelledby="task-help-title">
      <h3 id="task-help-title" className="font-semibold text-foreground">
        {t("help:tasks.title", { defaultValue: "Common task questions" })}
      </h3>
      <ul className="mt-3 space-y-3 text-sm text-foreground/90">
        {answers.map((answer) => (
          <li key={answer.key}>{t(answer.key, { defaultValue: answer.defaultValue })}</li>
        ))}
      </ul>
    </section>
  );
}
