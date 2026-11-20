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
    <section className="panel yape">
      <p className="shop-kicker">Último paso</p>
      <h2>Yapea y listo</h2>
      <div className="pay-box">
        <span>Monto exacto a yapear</span>
        <strong>{formatSoles(totalCents)}</strong>
        <span>O yapea al número</span>
        <b>{yapeNumber}</b>
        <span>
          A nombre de <b>{yapeName}</b>
        </span>
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
          placeholder="Ej. 08452317"
          value={operation}
          onChange={(event) => onOperation(controlValue(event.currentTarget))}
        />
      </Field>
      <p className="yape-note">Tu pago será verificado por nosotros. Te avisaremos por WhatsApp.</p>
      <button type="submit" className="shop-cta" disabled={sending}>
        {sending ? "Enviando tu pedido…" : "Enviar pedido 🎁"}
      </button>
    </section>
  );
}
