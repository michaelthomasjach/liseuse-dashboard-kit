import { describe, expect, it } from "vitest";
import { formatCountdown } from "./formatting";

describe("formatCountdown (temps avant la prochaine bougie)", () => {
  it("minutes et secondes sous l'heure, heures au-delà, jours au-delà d'un jour", () => {
    expect(formatCountdown(59_000)).toBe("00:59");
    expect(formatCountdown(42 * 60_000 + 5_000)).toBe("42:05");
    expect(formatCountdown(3 * 3_600_000 + 6 * 60_000 + 28_000)).toBe("3:06:28");
    expect(formatCountdown(3846 * 60_000 + 28_000)).toBe("2 j 16:06:28");
    expect(formatCountdown(-5)).toBe("00:00");
  });
});
