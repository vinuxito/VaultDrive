import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import EditEmailAccountModal from "./EditEmailAccountModal";

vi.mock("../../utils/api", () => ({
  updateEmailAccount: vi.fn(),
}));

const account = {
  id: "account-1",
  email: "owner@example.com",
  imapHost: "imap.example.com",
  imapPort: 993,
  imapUser: "owner",
};

describe("EditEmailAccountModal", () => {
  it("resets unsaved fields when the same account is reopened", async () => {
    const user = userEvent.setup();
    const props = {
      onClose: vi.fn(),
      account,
      onUpdate: vi.fn(),
    };
    const { rerender } = render(<EditEmailAccountModal {...props} isOpen />);
    const email = screen.getByLabelText("Email");
    await user.clear(email);
    await user.type(email, "draft@example.com");

    rerender(<EditEmailAccountModal {...props} isOpen={false} />);
    rerender(<EditEmailAccountModal {...props} isOpen />);

    expect(screen.getByLabelText("Email")).toHaveValue("owner@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("refreshes fields when account data changes under the same id", () => {
    const props = { onClose: vi.fn(), account, onUpdate: vi.fn(), isOpen: true };
    const { rerender } = render(<EditEmailAccountModal {...props} />);

    rerender(
      <EditEmailAccountModal
        {...props}
        account={{ ...account, email: "updated@example.com", imapUser: "updated" }}
      />,
    );

    expect(screen.getByLabelText("Email")).toHaveValue("updated@example.com");
    expect(screen.getByLabelText("IMAP User")).toHaveValue("updated");
  });
});
