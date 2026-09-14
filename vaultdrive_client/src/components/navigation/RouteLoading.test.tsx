import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RouteLoading } from "./RouteLoading";

describe("RouteLoading", () => {
  it("names the pending page transition for assistive technology", () => {
    render(<RouteLoading />);

    expect(screen.getByRole("status")).toHaveTextContent(/Loading .+Drive/i);
    expect(screen.getByTestId("route-loading-spinner")).toHaveAttribute("aria-hidden", "true");
  });
});
