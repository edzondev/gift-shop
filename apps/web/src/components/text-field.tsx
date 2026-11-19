import type { ProductField } from "../product-errors";
import { type Focusable, fieldText, focusable } from "./field-value";

export function TextField({
  field,
  label,
  value,
  error,
  onChange,
  multiline,
  inputMode,
  onFocusable,
}: {
  field: ProductField;
  label: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  multiline: boolean;
  inputMode: "decimal" | "numeric" | "text";
  onFocusable: (field: ProductField, node: Focusable | null) => void;
}) {
  const id = `product-${field}`;
  const errorId = `${id}-error`;
  const described = error === undefined ? undefined : errorId;
  function change(event: { currentTarget: EventTarget | null }) {
    onChange(fieldText(event.currentTarget));
  }
  function bind(node: unknown) {
    onFocusable(field, focusable(node));
  }
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          id={id}
          name={field}
          data-field={field}
          value={value}
          rows={4}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={described}
          onChange={change}
          ref={bind}
        />
      ) : (
        <input
          id={id}
          name={field}
          data-field={field}
          value={value}
          inputMode={inputMode}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={described}
          onChange={change}
          ref={bind}
        />
      )}
      {error === undefined ? (
        <p id={errorId} className="field-error" />
      ) : (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}
