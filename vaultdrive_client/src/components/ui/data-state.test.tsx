import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DataState } from "./data-state";
import { EMPTY } from "../../constants/copy";

describe("<DataState>", () => {
  it("renders children when no special state is set", () => {
    render(
      <DataState>
        <div data-testid="children">data here</div>
      </DataState>,
    );
    expect(screen.getByTestId("children")).toBeInTheDocument();
  });

  it("renders skeleton rows + label while loading", () => {
    render(
      <DataState loading skeletonRows={4} loadingLabel="Decrypting your vault…">
        <div>shouldn't render</div>
      </DataState>,
    );
    expect(screen.getByTestId("data-state-loading")).toBeInTheDocument();
    expect(screen.getAllByTestId("data-state-skeleton-row")).toHaveLength(4);
    expect(screen.getByText(/decrypting your vault/i)).toBeInTheDocument();
  });

  it("renders the empty state with title, body, and primary action", async () => {
    const user = userEvent.setup();
    const onEmptyAction = vi.fn();
    render(
      <DataState
        empty
        emptyConfig={EMPTY.dropLinksEmpty}
        onEmptyAction={onEmptyAction}
      >
        <div>shouldn't render</div>
      </DataState>,
    );
    expect(screen.getByText(EMPTY.dropLinksEmpty.title)).toBeInTheDocument();
    expect(screen.getByText(EMPTY.dropLinksEmpty.body)).toBeInTheDocument();
    await user.click(screen.getByTestId("data-state-empty-action"));
    expect(onEmptyAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "create-drop-link" }),
    );
  });

  it("renders the error state with retry when onRetry is provided", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <DataState error={new Error("nope")} onRetry={onRetry}>
        <div>shouldn't render</div>
      </DataState>,
    );
    expect(screen.getByTestId("data-state-error")).toBeInTheDocument();
    expect(screen.getByText(/nope/)).toBeInTheDocument();
    await user.click(screen.getByTestId("data-state-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render retry button when onRetry is absent", () => {
    render(
      <DataState error="something failed">
        <div>shouldn't render</div>
      </DataState>,
    );
    expect(screen.queryByTestId("data-state-retry")).not.toBeInTheDocument();
  });

  it("prefers loading over empty/error", () => {
    render(
      <DataState loading empty error="x" emptyConfig={EMPTY.vaultEmpty}>
        <div>shouldn't render</div>
      </DataState>,
    );
    expect(screen.getByTestId("data-state-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("data-state-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-state-error")).not.toBeInTheDocument();
  });
});
