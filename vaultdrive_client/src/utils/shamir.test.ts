import { describe, it, expect } from "vitest";
import { shamirSplit, shamirReconstruct } from "./shamir";

describe("Shamir's Secret Sharing (GF256)", () => {
  it("should split and reconstruct a secret correctly with exact threshold", () => {
    const secret = new TextEncoder().encode("SuperSecretMasterKeyEncryptionKey123!");
    const N = 5;
    const T = 3;

    const shares = shamirSplit(secret, N, T);
    expect(shares.length).toBe(N);

    // Reconstruct using shares [0, 1, 2] (3 shares)
    const subset1 = [shares[0], shares[1], shares[2]];
    const reconstructed1 = shamirReconstruct(subset1, T);
    expect(new TextDecoder().decode(reconstructed1)).toBe("SuperSecretMasterKeyEncryptionKey123!");

    // Reconstruct using shares [1, 3, 4] (3 shares)
    const subset2 = [shares[1], shares[3], shares[4]];
    const reconstructed2 = shamirReconstruct(subset2, T);
    expect(new TextDecoder().decode(reconstructed2)).toBe("SuperSecretMasterKeyEncryptionKey123!");
  });

  it("should split and reconstruct a secret with more than threshold shares", () => {
    const secret = new TextEncoder().encode("SlightlyDifferentSecretKeyBytes");
    const N = 5;
    const T = 3;

    const shares = shamirSplit(secret, N, T);
    
    // Reconstruct using all 5 shares (should succeed)
    const reconstructed = shamirReconstruct(shares, T);
    expect(new TextDecoder().decode(reconstructed)).toBe("SlightlyDifferentSecretKeyBytes");
  });

  it("should fail to reconstruct if threshold is not met", () => {
    const secret = new TextEncoder().encode("StrictConsensusPasswordRecoveryData");
    const N = 5;
    const T = 4;

    const shares = shamirSplit(secret, N, T);

    // Reconstruct with 3 shares instead of 4
    const subset = [shares[0], shares[1], shares[2]];
    expect(() => shamirReconstruct(subset, T)).toThrow("Not enough shares to reconstruct");
  });

  it("should not reconstruct the correct secret if wrong shares are passed", () => {
    const secret = new TextEncoder().encode("ZeroKnowledgeMasterKeyRecovery123");
    const N = 5;
    const T = 3;

    const shares = shamirSplit(secret, N, T);

    // If we only have 2 shares, shamirReconstruct will throw because we pass T=3
    const subset = [shares[0], shares[1]];
    expect(() => shamirReconstruct(subset, T)).toThrow("Not enough shares to reconstruct");

    // What if we try to cheat by passing 3 shares but we pass T=2?
    // It will reconstruct but since the threshold used was T=3, the polynomial interpolation
    // with T=2 will yield an incorrect byte array (not matching the original secret).
    const reconstructedWrongThreshold = shamirReconstruct(subset.slice(0, 2), 2);
    expect(new TextDecoder().decode(reconstructedWrongThreshold)).not.toBe("ZeroKnowledgeMasterKeyRecovery123");
  });
});
