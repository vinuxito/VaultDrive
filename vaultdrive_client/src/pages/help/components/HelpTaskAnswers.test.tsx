import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HelpTaskAnswers } from "./HelpTaskAnswers";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe("HelpTaskAnswers", () => {
  it("answers the four common share-link recovery questions", () => {
    render(<HelpTaskAnswers activeSection="uploads_shares" />);

    expect(screen.getByText(/full link includes everything after the #/i)).toBeInTheDocument();
    expect(screen.getByText(/retry the download/i)).toBeInTheDocument();
    expect(screen.getByText(/revoking a link stops future access/i)).toBeInTheDocument();
    expect(screen.getByText(/account PIN is never something to send to a recipient/i)).toBeInTheDocument();
  });
});
