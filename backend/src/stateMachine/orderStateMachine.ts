import { InvalidTransitionError } from "../core/exceptions";
import { OrderStatus } from "../models/enums";

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [OrderStatus.PENDING_CONFIRMATION],
  [OrderStatus.PENDING_CONFIRMATION]: [OrderStatus.CONFIRMED, OrderStatus.REJECTED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
};

export function canTransition(current: OrderStatus, target: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(target) ?? false;
}

export function validateTransition(current: OrderStatus, target: OrderStatus): void {
  if (!canTransition(current, target)) {
    throw new InvalidTransitionError(`Cannot transition order from ${current} to ${target}`);
  }
}
