import type { Field, Occasion } from "api";
import { OCCASIONS } from "../occasions";
import type { FieldMessages, ProductField } from "../product-errors";
import type { ProductDraft } from "../product-form";
import { toggleMember } from "../product-form";
import { type Focusable, fieldText, focusable } from "./field-value";

const CUSTOM = [
  { id: "nombre", label: "Nombre personalizado", hint: "Hasta 14 caracteres" },
  { id: "color", label: "Color", hint: "Terracota, oliva, mostaza, rosa palo o crudo" },
  { id: "tamano", label: "Tamaño", hint: "Clásica o Grande" },
  { id: "tarjeta", label: "Tarjeta", hint: "Dedicatoria, + S/ 5" },
  { id: "envoltura", label: "Envoltura", hint: "+ S/ 8" },
] as const satisfies readonly { id: Field; label: string; hint: string }[];

function GroupError({ id, error }: { id: string; error: string | undefined }) {
  if (error === undefined) return <p id={id} className="field-error" />;
  return (
    <p id={id} className="field-error" role="alert">
      {error}
    </p>
  );
}

export function ProductChoices({
  draft,
  errors,
  onDraft,
  onFocusable,
}: {
  draft: ProductDraft;
  errors: FieldMessages;
  onDraft: (draft: ProductDraft) => void;
  onFocusable: (field: ProductField, node: Focusable | null) => void;
}) {
  function toggleOccasion(id: Occasion) {
    onDraft({ ...draft, occasions: toggleMember(draft.occasions, id) });
  }
  function toggleField(id: Field) {
    onDraft({ ...draft, fields: toggleMember(draft.fields, id) });
  }
  return (
    <div className="stack">
      <fieldset className="field" aria-describedby="product-occasions-error">
        <legend>Ocasiones</legend>
        <div className="choice-grid">
          {OCCASIONS.map((occasion) => (
            <label key={occasion.id} className="choice">
              <input
                type="checkbox"
                name="occasions"
                data-field="occasions"
                checked={draft.occasions.includes(occasion.id)}
                ref={
                  occasion.id === "cumple"
                    ? (node) => onFocusable("occasions", focusable(node))
                    : undefined
                }
                onChange={() => toggleOccasion(occasion.id)}
              />
              {occasion.label}
            </label>
          ))}
        </div>
        <GroupError id="product-occasions-error" error={errors.occasions} />
      </fieldset>
      <TextTag draft={draft} error={errors.tag} onDraft={onDraft} onFocusable={onFocusable} />
      <fieldset className="field" aria-describedby="product-fields-error">
        <legend>Campos de personalización</legend>
        <div className="choice-list">
          {CUSTOM.map((field) => (
            <label key={field.id} className="choice choice-row">
              <input
                type="checkbox"
                name="fields"
                data-field="fields"
                checked={draft.fields.includes(field.id)}
                ref={
                  field.id === "nombre"
                    ? (node) => onFocusable("fields", focusable(node))
                    : undefined
                }
                onChange={() => toggleField(field.id)}
              />
              <span>
                <b>{field.label}</b>
                <span className="muted">{field.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <GroupError id="product-fields-error" error={errors.fields} />
      </fieldset>
      <label className="choice">
        <input
          type="checkbox"
          name="active"
          data-field="active"
          checked={draft.active}
          ref={(node) => onFocusable("active", focusable(node))}
          onChange={() => onDraft({ ...draft, active: !draft.active })}
        />
        Visible en la tienda
      </label>
    </div>
  );
}

function TextTag({
  draft,
  error,
  onDraft,
  onFocusable,
}: {
  draft: ProductDraft;
  error: string | undefined;
  onDraft: (draft: ProductDraft) => void;
  onFocusable: (field: ProductField, node: Focusable | null) => void;
}) {
  return (
    <label className="field" htmlFor="product-tag">
      <span>Etiqueta</span>
      <input
        id="product-tag"
        name="tag"
        data-field="tag"
        value={draft.tag}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : "product-tag-error"}
        ref={(node) => onFocusable("tag", focusable(node))}
        onChange={(event) => onDraft({ ...draft, tag: fieldText(event.currentTarget) })}
      />
      <GroupError id="product-tag-error" error={error} />
    </label>
  );
}
