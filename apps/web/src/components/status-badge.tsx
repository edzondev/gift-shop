import type { OrderStatus } from "api";
import { statusLabel } from "../admin-action";
import { statusClass } from "../admin-present";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status ${statusClass(status)}`}>{statusLabel(status)}</span>;
}
