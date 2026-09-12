import { describe, expect, it } from "vitest";
import {
  isValidPaymentStatus,
  isValidTransition,
  isKnownStatus,
  isTerminalStatus,
  ORDER_TRANSITIONS,
  shouldRestoreStock,
  STATUS_CANCELLED,
  STATUS_CONFIRMED,
  STATUS_DELIVERED,
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_REFUNDED,
  STATUS_SHIPPED,
} from "./order-admin";

describe("order lifecycle transitions", () => {
  it("allows the forward lifecycle path", () => {
    expect(isValidTransition(STATUS_PENDING, STATUS_CONFIRMED)).toBe(true);
    expect(isValidTransition(STATUS_CONFIRMED, STATUS_PROCESSING)).toBe(true);
    expect(isValidTransition(STATUS_PROCESSING, STATUS_SHIPPED)).toBe(true);
    expect(isValidTransition(STATUS_SHIPPED, STATUS_DELIVERED)).toBe(true);
  });

  it("allows cancellation before shipping, not after", () => {
    expect(isValidTransition(STATUS_PENDING, STATUS_CANCELLED)).toBe(true);
    expect(isValidTransition(STATUS_CONFIRMED, STATUS_CANCELLED)).toBe(true);
    expect(isValidTransition(STATUS_PROCESSING, STATUS_CANCELLED)).toBe(true);
    expect(isValidTransition(STATUS_SHIPPED, STATUS_CANCELLED)).toBe(false);
    expect(isValidTransition(STATUS_DELIVERED, STATUS_CANCELLED)).toBe(false);
  });

  it("only allows refunds from delivered", () => {
    expect(isValidTransition(STATUS_DELIVERED, STATUS_REFUNDED)).toBe(true);
    expect(isValidTransition(STATUS_PENDING, STATUS_REFUNDED)).toBe(false);
    expect(isValidTransition(STATUS_SHIPPED, STATUS_REFUNDED)).toBe(false);
  });

  it("rejects nonsensical skips and backwards moves", () => {
    expect(isValidTransition(STATUS_PENDING, STATUS_SHIPPED)).toBe(false);
    expect(isValidTransition(STATUS_PENDING, STATUS_DELIVERED)).toBe(false);
    expect(isValidTransition(STATUS_CONFIRMED, STATUS_DELIVERED)).toBe(false);
    expect(isValidTransition(STATUS_SHIPPED, STATUS_CONFIRMED)).toBe(false);
    expect(isValidTransition(STATUS_DELIVERED, STATUS_PENDING)).toBe(false);
  });

  it("treats same-status updates as idempotent no-ops", () => {
    for (const s of Object.keys(ORDER_TRANSITIONS)) {
      expect(isValidTransition(s, s)).toBe(true);
    }
  });

  it("terminal statuses have no outbound transitions", () => {
    expect(isTerminalStatus(STATUS_CANCELLED)).toBe(true);
    expect(isTerminalStatus(STATUS_REFUNDED)).toBe(true);
    expect(ORDER_TRANSITIONS[STATUS_CANCELLED]).toEqual([]);
    expect(ORDER_TRANSITIONS[STATUS_REFUNDED]).toEqual([]);
  });

  it("rejects unknown statuses", () => {
    expect(isValidTransition("nonsense", STATUS_CONFIRMED)).toBe(false);
    expect(isValidTransition(STATUS_PENDING, "nonsense")).toBe(false);
    expect(isKnownStatus("nonsense")).toBe(false);
  });

  it("every transition target is itself a known status", () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const t of targets) expect(isKnownStatus(t)).toBe(true);
    }
  });
});

describe("inventory restoration rules", () => {
  it("restores stock exactly when entering cancelled/refunded", () => {
    expect(shouldRestoreStock(STATUS_PENDING, STATUS_CANCELLED)).toBe(true);
    expect(shouldRestoreStock(STATUS_CONFIRMED, STATUS_CANCELLED)).toBe(true);
    expect(shouldRestoreStock(STATUS_DELIVERED, STATUS_REFUNDED)).toBe(true);
  });

  it("never restores twice from an already-cancelled order", () => {
    expect(shouldRestoreStock(STATUS_CANCELLED, STATUS_CANCELLED)).toBe(false);
    // Forced moves out of cancelled must not restock again.
    expect(shouldRestoreStock(STATUS_CANCELLED, STATUS_PENDING)).toBe(false);
    expect(shouldRestoreStock(STATUS_CANCELLED, STATUS_CONFIRMED)).toBe(false);
  });

  it("does not restore for ordinary forward transitions", () => {
    expect(shouldRestoreStock(STATUS_PENDING, STATUS_CONFIRMED)).toBe(false);
    expect(shouldRestoreStock(STATUS_PROCESSING, STATUS_SHIPPED)).toBe(false);
    expect(shouldRestoreStock(STATUS_SHIPPED, STATUS_DELIVERED)).toBe(false);
  });
});

describe("payment status validation", () => {
  it("accepts the defined payment statuses", () => {
    for (const p of [
      "pending",
      "paid",
      "failed",
      "refunded",
      "partially_refunded",
    ]) {
      expect(isValidPaymentStatus(p)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isValidPaymentStatus("")).toBe(false);
    expect(isValidPaymentStatus("PAID")).toBe(false);
    expect(isValidPaymentStatus("charged")).toBe(false);
  });
});
