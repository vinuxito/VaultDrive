import { describe, expect, it } from "vitest";
import {
  isHapticsEnabled,
  setHapticsEnabled,
  playTumblerClick,
  playUnlockChime,
  playDeadboltThud,
} from "./audioHaptics";

describe("audioHaptics", () => {
  it("manages haptics enabled state via localStorage", () => {
    setHapticsEnabled(false);
    expect(isHapticsEnabled()).toBe(false);

    setHapticsEnabled(true);
    expect(isHapticsEnabled()).toBe(true);
  });

  it("safely handles audio synthesis when AudioContext is mocked or absent", () => {
    // Should not throw even in Node/jsdom environments without real audio hardware
    expect(() => playTumblerClick()).not.toThrow();
    expect(() => playUnlockChime()).not.toThrow();
    expect(() => playDeadboltThud()).not.toThrow();
  });
});
