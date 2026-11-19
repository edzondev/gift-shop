import type { ReactNode } from "react";

export function fieldProps(id: string, error: string | undefined) {
  return {
    id,
    "aria-invalid": error !== undefined,
    "aria-describedby": error !== undefined ? `${id}-error` : undefined,
  };
}

export function FieldError({ id, error }: { id: string; error: string | undefined }) {
  if (error === undefined) return null;
  return (
    <span id={`${id}-error`} className="error">
      {error}
    </span>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {hint !== undefined ? <small> {hint}</small> : null}
      </span>
      {children}
      <FieldError id={id} error={error} />
    </label>
  );
}
