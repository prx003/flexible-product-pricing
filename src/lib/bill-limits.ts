export const MAX_BILL_ITEMS = 20;
export const BILL_LIMIT_MESSAGE = `A bill can contain only ${MAX_BILL_ITEMS} items. Remove an item or start another bill.`;

export function assertBillItemLimit(items: readonly unknown[]): void {
  if (items.length > MAX_BILL_ITEMS) throw new Error(BILL_LIMIT_MESSAGE);
}