import { controlValue } from "../field-value";
import { Field, fieldProps } from "../ui/field";
import type { CheckoutFields } from "./schema";

export function ScheduleFields({
  deliveryDate,
  note,
  minDate,
  errors,
  onDate,
  onNote,
}: {
  deliveryDate: string;
  note: string;
  minDate: string;
  errors: CheckoutFields;
  onDate: (value: string) => void;
  onNote: (value: string) => void;
}) {
  return (
    <section className="panel">
      <h2>¿Para cuándo?</h2>
      <Field id="deliveryDate" label="Fecha de entrega" error={errors.deliveryDate}>
        <input
          {...fieldProps("deliveryDate", errors.deliveryDate)}
          type="date"
          min={minDate}
          value={deliveryDate}
          onChange={(event) => onDate(controlValue(event.currentTarget))}
        />
      </Field>
      <p className="hint">Puedes elegir desde el {minDate}. Lo preparamos a pedido.</p>
      <Field id="note" label="Nota para la artesana" hint="(opcional)" error={errors.note}>
        <textarea
          {...fieldProps("note", errors.note)}
          rows={3}
          value={note}
          onChange={(event) => onNote(controlValue(event.currentTarget))}
        />
      </Field>
    </section>
  );
}
