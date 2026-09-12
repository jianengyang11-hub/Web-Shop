import { describe, expect, it } from "vitest";
import { InvalidTransitionError } from "../src/core/exceptions";
import { OrderStatus } from "../src/models/enums";
import { canTransition, validateTransition } from "../src/stateMachine/orderStateMachine";

describe("order state machine", () => {
  it("allows the full happy-path chain", () => {
    expect(canTransition(OrderStatus.NEW, OrderStatus.PENDING_CONFIRMATION)).toBe(true);
    expect(canTransition(OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING)).toBe(true);
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it("allows pending -> rejected and confirmed -> cancelled", () => {
    expect(canTransition(OrderStatus.PENDING_CONFIRMATION, OrderStatus.REJECTED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
  });

  it.each([
    [OrderStatus.DELIVERED, OrderStatus.CONFIRMED],
    [OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
    [OrderStatus.REJECTED, OrderStatus.CONFIRMED],
    [OrderStatus.NEW, OrderStatus.CONFIRMED],
    [OrderStatus.PENDING_CONFIRMATION, OrderStatus.SHIPPED],
  ])("rejects invalid transition %s -> %s", (current, target) => {
    expect(canTransition(current, target)).toBe(false);
    expect(() => validateTransition(current, target)).toThrow(InvalidTransitionError);
  });
});
