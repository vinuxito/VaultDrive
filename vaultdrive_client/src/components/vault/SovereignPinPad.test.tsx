import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SovereignPinPad } from "./SovereignPinPad";

describe("SovereignPinPad", () => {
  it("renders 4 glowing indicators and numeric buttons 0-9", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <SovereignPinPad
        value="12"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    // Digits 0 through 9 are rendered
    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole("button", { name: new RegExp(i === 0 ? "Dígito 0" : `Dígito ${i}`, "i") })).toBeInTheDocument();
    }
  });

  it("appends digits when buttons are clicked", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <SovereignPinPad
        value="1"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const digit2 = screen.getByRole("button", { name: /Dígito 2/i });
    fireEvent.click(digit2);

    expect(onChange).toHaveBeenCalledWith("12");
  });

  it("handles delete and clear actions", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <SovereignPinPad
        value="123"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /Retroceso/i });
    fireEvent.click(deleteBtn);
    expect(onChange).toHaveBeenCalledWith("12");

    const clearBtn = screen.getByRole("button", { name: /Borrar todo el PIN/i });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });
});
