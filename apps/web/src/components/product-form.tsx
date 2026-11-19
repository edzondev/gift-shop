import { Link } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useRef } from "react";
import type { FieldMessages, ProductField } from "../product-errors";
import type { ProductDraft } from "../product-form";
import type { Focusable } from "./field-value";
import { ProductChoices } from "./product-choices";
import { TextField } from "./text-field";

export function ProductForm({
  mode,
  draft,
  errors,
  sending,
  onDraft,
  onSubmit,
  focusRef,
}: {
  mode: "create" | "edit";
  draft: ProductDraft;
  errors: FieldMessages;
  sending: boolean;
  onDraft: (draft: ProductDraft) => void;
  onSubmit: () => void;
  focusRef: { current: (field: ProductField) => void };
}) {
  const focusables = useRef<Partial<Record<ProductField, Focusable>>>({});
  focusRef.current = (field) => {
    focusables.current[field]?.focus();
  };
  function bind(field: ProductField, node: Focusable | null) {
    if (node === null) {
      delete focusables.current[field];
      return;
    }
    focusables.current[field] = node;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form className="stack" onSubmit={submit}>
      {errors.form === undefined ? (
        <p className="field-error" />
      ) : (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}
      <TextField
        field="name"
        label="Nombre"
        value={draft.name}
        error={errors.name}
        multiline={false}
        inputMode="text"
        onChange={(name) => onDraft({ ...draft, name })}
        onFocusable={bind}
      />
      <TextField
        field="slug"
        label="Slug"
        value={draft.slug}
        error={errors.slug}
        multiline={false}
        inputMode="text"
        onChange={(slug) => onDraft({ ...draft, slug })}
        onFocusable={bind}
      />
      <div className="form-grid">
        <TextField
          field="price"
          label="Precio (S/)"
          value={draft.price}
          error={errors.price}
          multiline={false}
          inputMode="decimal"
          onChange={(price) => onDraft({ ...draft, price })}
          onFocusable={bind}
        />
        <TextField
          field="oldPrice"
          label="Antes (oferta, S/)"
          value={draft.oldPrice}
          error={errors.oldPrice}
          multiline={false}
          inputMode="decimal"
          onChange={(oldPrice) => onDraft({ ...draft, oldPrice })}
          onFocusable={bind}
        />
        <TextField
          field="prepDays"
          label="Días de preparación"
          value={draft.prepDays}
          error={errors.prepDays}
          multiline={false}
          inputMode="numeric"
          onChange={(prepDays) => onDraft({ ...draft, prepDays })}
          onFocusable={bind}
        />
        {mode === "create" ? (
          <TextField
            field="initialStock"
            label="Stock inicial"
            value={draft.initialStock}
            error={errors.initialStock}
            multiline={false}
            inputMode="numeric"
            onChange={(initialStock) => onDraft({ ...draft, initialStock })}
            onFocusable={bind}
          />
        ) : null}
      </div>
      <TextField
        field="description"
        label="Descripción"
        value={draft.description}
        error={errors.description}
        multiline
        inputMode="text"
        onChange={(description) => onDraft({ ...draft, description })}
        onFocusable={bind}
      />
      <div className="form-grid">
        <TextField
          field="classic"
          label="Tamaño clásica"
          value={draft.classic}
          error={errors.classic}
          multiline={false}
          inputMode="text"
          onChange={(classic) => onDraft({ ...draft, classic })}
          onFocusable={bind}
        />
        <TextField
          field="large"
          label="Tamaño grande"
          value={draft.large}
          error={errors.large}
          multiline={false}
          inputMode="text"
          onChange={(large) => onDraft({ ...draft, large })}
          onFocusable={bind}
        />
        <TextField
          field="largeExtra"
          label="Recargo de Grande (S/)"
          value={draft.largeExtra}
          error={errors.largeExtra}
          multiline={false}
          inputMode="decimal"
          onChange={(largeExtra) => onDraft({ ...draft, largeExtra })}
          onFocusable={bind}
        />
      </div>
      <ProductChoices draft={draft} errors={errors} onDraft={onDraft} onFocusable={bind} />
      <div className="actions">
        <Link to="/admin/productos" className="btn btn-ghost">
          Cancelar
        </Link>
        <button type="submit" className="btn" disabled={sending} aria-busy={sending}>
          {mode === "create" ? "Crear producto" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
