import { controlValue, firstFile } from "../field-value";
import { formatSoles } from "../money";
import { Field, fieldProps } from "../ui/field";

export function PaymentFields({
  yapeNumber,
  yapeName,
  totalCents,
  operation,
  fileName,
  error,
  captureError,
  sending,
  onOperation,
  onFile,
}: {
  yapeNumber: string;
  yapeName: string;
  totalCents: number;
  operation: string;
  fileName: string | null;
  error: string | undefined;
  captureError: string | undefined;
  sending: boolean;
  onOperation: (value: string) => void;
  onFile: (file: File | null) => void;
}) {
  return (
    <section className="panel">
      <h2>Pago con Yape</h2>
      <div className="pay-box">
        <span>Monto exacto a yapear</span>
        <strong>{formatSoles(totalCents)}</strong>
        <span>Número</span>
        <b>{yapeNumber}</b>
        <span>A nombre de {yapeName}</span>
      </div>
      <ol className="steps">
        <li>Abre Yape y yapea al número</li>
        <li>Yapea el monto exacto: {formatSoles(totalCents)}</li>
        <li>Sube tu captura y el número de operación</li>
      </ol>
      <Field id="capture" label="Captura del Yape" error={captureError}>
        <input
          {...fieldProps("capture", captureError)}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => onFile(firstFile(event.currentTarget))}
        />
      </Field>
      {fileName !== null ? <p className="hint">{fileName}</p> : null}
      <Field id="yapeOperation" label="Número de operación" error={error}>
        <input
          {...fieldProps("yapeOperation", error)}
          inputMode="numeric"
          autoComplete="off"
          value={operation}
          onChange={(event) => onOperation(controlValue(event.currentTarget))}
        />
      </Field>
      <button type="submit" className="primary" disabled={sending}>
        {sending ? "Enviando tu pedido…" : "Enviar pedido"}
      </button>
    </section>
  );
}
