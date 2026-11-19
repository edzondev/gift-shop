import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useRef, useState, useSyncExternalStore } from "react";
import { captureError } from "../capture";
import type { CartLine } from "../cart/logic";
import { cartSubtotalCents } from "../cart/logic";
import { clearCart } from "../cart/store";
import { earliestDeliveryDate } from "../dates";
import { afterPaint, focusById } from "../field-value";
import { attemptKey, claimSubmit, markCleared, orderFingerprint } from "../orders/attempt";
import { placeOrder } from "../orders.functions";
import { CustomerFields } from "./customer";
import { DeliveryFields } from "./delivery";
import { PaymentFields } from "./payment";
import { ScheduleFields } from "./schedule";
import {
  type CheckoutDraft,
  type CheckoutFields,
  emptyDelivery,
  itemsFromLines,
  parseCheckout,
} from "./schema";
import { OrderSummary } from "./summary";

const FOCUS_ORDER = [
  "name",
  "phone",
  "email",
  "station",
  "slot",
  "address",
  "district",
  "reference",
  "deliveryDate",
  "note",
  "yapeOperation",
  "capture",
] as const;

function useAlive() {
  const alive = useRef(true);
  useSyncExternalStore(
    () => {
      alive.current = true;
      return () => {
        alive.current = false;
      };
    },
    () => true,
    () => true,
  );
  return alive;
}

function clearError(
  errors: CheckoutFields,
  fields: readonly (keyof CheckoutFields)[],
): CheckoutFields {
  const next = { ...errors };
  for (const field of fields) delete next[field];
  return next;
}

function focusFirst(fields: CheckoutFields, captureMessage: string | undefined) {
  const bag: Record<string, string | undefined> = { ...fields, capture: captureMessage };
  for (const id of FOCUS_ORDER) {
    if (bag[id] === undefined) continue;
    focusById(id);
    return;
  }
}

export function CheckoutForm({
  lines,
  today,
  yapeNumber,
  yapeName,
}: {
  lines: readonly CartLine[];
  today: string;
  yapeNumber: string;
  yapeName: string;
}) {
  const navigate = useNavigate();
  const send = useServerFn(placeOrder);
  const alive = useAlive();
  const sending = useRef(false);
  const cleared = useRef(false);
  const attempt = useRef<{ key: string; fingerprint: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CheckoutDraft>({
    name: "",
    phone: "",
    email: "",
    delivery: emptyDelivery("estacion"),
    deliveryDate: "",
    note: "",
    yapeOperation: "",
  });
  const [errors, setErrors] = useState<CheckoutFields>({});
  const [captureMessage, setCaptureMessage] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const minDate = earliestDeliveryDate(
    today,
    lines.map((line) => line.prepDays),
  );
  const total = cartSubtotalCents(lines);

  function patch(partial: Partial<CheckoutDraft>, field: keyof CheckoutFields) {
    setDraft((current) => ({ ...current, ...partial }));
    setErrors((current) => clearError(current, [field]));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claimSubmit(sending)) return;
    setBusy(true);
    setFormError(null);
    const parsed = parseCheckout(draft, itemsFromLines(lines), total, minDate);
    const fileProblem = captureError(file);
    if (!parsed.ok || file === null || fileProblem !== null) {
      const fields = parsed.ok ? {} : parsed.fields;
      setErrors(fields);
      const capture = fileProblem === null ? undefined : fileProblem;
      setCaptureMessage(capture);
      focusFirst(fields, capture);
      sending.current = false;
      if (alive.current) setBusy(false);
      return;
    }
    setErrors({});
    setCaptureMessage(undefined);
    const nextAttempt = attemptKey(attempt.current, orderFingerprint(parsed.value, file), () =>
      crypto.randomUUID(),
    );
    attempt.current = nextAttempt;
    const body = new FormData();
    body.set("order", JSON.stringify(parsed.value));
    body.set("capture", file);
    body.set("idempotencyKey", nextAttempt.key);
    try {
      const result = await send({ data: body });
      if (!alive.current) return;
      if (!result.ok) {
        setFormError(result.message);
        afterPaint(() => focusById("form-error"));
        return;
      }
      await navigate({
        to: "/pedido/$code",
        params: { code: result.code },
        search: { t: result.token },
      });
      if (markCleared(cleared)) clearCart();
    } catch {
      if (!alive.current) return;
      setFormError("No pudimos enviar el pedido. Inténtalo de nuevo.");
      afterPaint(() => focusById("form-error"));
    } finally {
      if (alive.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <form className="checkout" onSubmit={onSubmit}>
      <div>
        <CustomerFields
          name={draft.name}
          phone={draft.phone}
          email={draft.email}
          errors={errors}
          onName={(name) => patch({ name }, "name")}
          onPhone={(phone) => patch({ phone }, "phone")}
          onEmail={(email) => patch({ email }, "email")}
        />
        <DeliveryFields
          delivery={draft.delivery}
          errors={errors}
          onMode={(mode) => {
            setDraft((current) => ({ ...current, delivery: emptyDelivery(mode) }));
            setErrors((current) =>
              clearError(current, ["station", "slot", "address", "district", "reference"]),
            );
          }}
          onDelivery={(delivery) => {
            setDraft((current) => ({ ...current, delivery }));
            setErrors((current) =>
              clearError(current, ["station", "slot", "address", "district", "reference"]),
            );
          }}
        />
        <ScheduleFields
          deliveryDate={draft.deliveryDate}
          note={draft.note}
          minDate={minDate}
          errors={errors}
          onDate={(deliveryDate) => patch({ deliveryDate }, "deliveryDate")}
          onNote={(note) => patch({ note }, "note")}
        />
        <PaymentFields
          yapeNumber={yapeNumber}
          yapeName={yapeName}
          totalCents={total}
          operation={draft.yapeOperation}
          fileName={file?.name ?? null}
          error={errors.yapeOperation}
          captureError={captureMessage}
          sending={busy}
          onOperation={(yapeOperation) => patch({ yapeOperation }, "yapeOperation")}
          onFile={(next) => {
            setFile(next);
            setCaptureMessage(undefined);
          }}
        />
        {formError !== null ? (
          <p id="form-error" className="error" role="alert" tabIndex={-1}>
            {formError}
          </p>
        ) : null}
      </div>
      <OrderSummary lines={lines} delivery={draft.delivery} />
    </form>
  );
}
