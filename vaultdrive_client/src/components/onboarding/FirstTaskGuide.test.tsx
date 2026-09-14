import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { FirstTaskGuide } from "./FirstTaskGuide";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }) }));

it("keeps a first share grounded in a real uploaded file instead of marking button clicks complete", async () => {
  const upload = vi.fn(), share = vi.fn();
  const props = { task: "share" as const, fileCount: 0, onUpload: upload, onShare: share, onReceive: vi.fn(), onDismiss: vi.fn() };
  const { rerender } = render(<FirstTaskGuide {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "Upload a file" }));
  expect(upload).toHaveBeenCalledOnce();
  expect(share).not.toHaveBeenCalled();
  expect(screen.queryByText(/File accepted/)).not.toBeInTheDocument();
  rerender(<FirstTaskGuide {...props} fileCount={1} />);
  await userEvent.click(screen.getByRole("button", { name: "Choose a file to share" }));
  expect(share).toHaveBeenCalledOnce();
});

it("does not call an unavailable inventory empty or completed", () => {
  render(<FirstTaskGuide task="upload" fileCount={null} onUpload={vi.fn()} onShare={vi.fn()} onReceive={vi.fn()} onDismiss={vi.fn()} />);
  expect(screen.getByText("File status is not confirmed yet.")).toBeInTheDocument();
  expect(screen.queryByText(/Your file is in the vault/)).not.toBeInTheDocument();
});
