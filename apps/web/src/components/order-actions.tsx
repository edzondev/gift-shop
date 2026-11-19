import type { OrderStatus } from "api";
import { useRef } from "react";
import { nextAction } from "../admin-action";

function openDialog(node: HTMLElement | null): void {
  if (node !== null && "showModal" in node && typeof node.showModal === "function") {
    node.showModal();
  }
}

function submitValue(native: Event): string {
  if (!("submitter" in native)) return "";
  const submitter = native.submitter;
  if (typeof submitter !== "object" || submitter === null || !("value" in submitter)) return "";
  return typeof submitter.value === "string" ? submitter.value : "";
}

export function OrderActions({
  status,
  sending,
  onAdvance,
  onReject,
}: {
  status: OrderStatus;
  sending: boolean;
  onAdvance: (to: OrderStatus) => void;
  onReject: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const action = nextAction(status);
  switch (action.kind) {
    case "none":
      return null;
    case "advance":
      return (
        <button
          type="button"
          className="btn"
          disabled={sending}
          aria-busy={sending}
          onClick={() => onAdvance(action.to)}
        >
          {action.label}
        </button>
      );
    case "confirm":
      return (
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={sending}
            aria-busy={sending}
            onClick={() => onAdvance(action.to)}
          >
            {action.label}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={sending}
            onClick={() => openDialog(dialog.current)}
          >
            Rechazar
          </button>
          <dialog ref={dialog} className="confirm" aria-labelledby="reject-title">
            <h2 id="reject-title">Rechazar pedido</h2>
            <p>El stock vuelve al taller y el pedido queda rechazado.</p>
            <form
              className="actions"
              method="dialog"
              onSubmit={(event) => {
                if (submitValue(event.nativeEvent) === "reject") onReject();
              }}
            >
              <button type="submit" className="btn btn-ghost" value="cancel">
                Cancelar
              </button>
              <button type="submit" className="btn" value="reject" disabled={sending}>
                Rechazar
              </button>
            </form>
          </dialog>
        </div>
      );
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
