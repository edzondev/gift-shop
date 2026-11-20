import { Navigate, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import type { AdminProduct } from "api";
import { useRef, useState } from "react";
import { createAdminProduct, saveAdminProduct } from "../product.functions";
import {
  type FieldMessages,
  type ProductField,
  photoNotice,
  slugTakenFields,
} from "../product-errors";
import {
  changedInput,
  draftFromProduct,
  emptyDraft,
  firstField,
  inputFromProduct,
  type ProductDraft,
  parseDraft,
} from "../product-form";
import { canUpload, photoIssue } from "../product-photo";
import type { PhotoAviso } from "../product-search";
import { type Gate, releaseClick, takeClick } from "../product-stock";
import { uploadProductPhoto } from "../product-upload";
import { clearField, firstFile } from "./field-value";
import { ProductForm } from "./product-form";
import { ProductPhotos } from "./product-photos";

function avisoCode(code: string): PhotoAviso {
  switch (code) {
    case "too_many_photos":
    case "file_too_large":
    case "unsupported_file_type":
      return code;
    default:
      return "photo_failed";
  }
}

export function ProductEditor({
  mode,
  loaded,
  note,
}: {
  mode: "create" | "edit";
  loaded: AdminProduct | null;
  note: string | null;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const gate = useRef<Gate>({ busy: false });
  const focusRef = useRef<(field: ProductField) => void>(() => {});
  const [current, setCurrent] = useState(loaded);
  const [draft, setDraft] = useState<ProductDraft>(
    loaded === null ? emptyDraft() : draftFromProduct(loaded),
  );
  const [seenId, setSeenId] = useState(loaded?.id ?? "nuevo");
  const [mark, setMark] = useState(0);
  const [errorMark, setErrorMark] = useState(-1);
  const [serverFields, setServerFields] = useState<FieldMessages>({});
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(false);
  const [missing, setMissing] = useState(false);
  const [queue, setQueue] = useState<readonly File[]>([]);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const markRef = useRef(0);
  markRef.current = mark;
  if (seenId !== (loaded?.id ?? "nuevo")) {
    setSeenId(loaded?.id ?? "nuevo");
    setCurrent(loaded);
    setDraft(loaded === null ? emptyDraft() : draftFromProduct(loaded));
    setServerFields({});
    setErrorMark(-1);
    setQueue([]);
    setSending(false);
    gate.current = releaseClick();
  }
  if (missing) throw notFound();
  if (denied) return <Navigate to="/admin/login" />;

  const errors = mark === errorMark ? serverFields : {};
  const baseline = current === null ? null : inputFromProduct(current);

  function edit(next: ProductDraft) {
    setDraft(next);
    setMark((value) => value + 1);
  }

  function show(fields: FieldMessages) {
    setServerFields(fields);
    setErrorMark(markRef.current);
    const field = firstField(fields);
    if (field !== null) focusRef.current(field);
  }

  function release() {
    gate.current = releaseClick();
    setSending(false);
  }

  function applyWrite(result: Awaited<ReturnType<typeof saveAdminProduct>>) {
    switch (result.kind) {
      case "saved":
      case "unchanged":
        setCurrent(result.product);
        setDraft(draftFromProduct(result.product));
        setServerFields(
          result.kind === "unchanged" ? { form: "No hay cambios para guardar." } : {},
        );
        setErrorMark(markRef.current);
        void router.invalidate();
        return;
      case "slug_taken":
        show(slugTakenFields());
        return;
      case "invalid":
        show(result.fields);
        return;
      case "missing":
        setMissing(true);
        return;
      case "denied":
        setDenied(true);
        return;
      case "failed":
        show({ form: "No pudimos guardar el producto." });
        return;
      default: {
        const exhaustive: never = result;
        return exhaustive;
      }
    }
  }

  async function uploadQueued(productId: string) {
    for (const file of queue) {
      const result = await uploadProductPhoto(productId, file);
      if (result.kind === "created") continue;
      if (result.kind === "denied") {
        setDenied(true);
        return;
      }
      const code = result.kind === "rejected" ? result.code : "photo_failed";
      await navigate({
        to: "/admin/productos/$id",
        params: { id: productId },
        search: { aviso: avisoCode(code) },
      });
      return;
    }
    await navigate({ to: "/admin/productos/$id", params: { id: productId } });
  }

  function onSubmit() {
    const click = takeClick(gate.current);
    gate.current = click.gate;
    if (!click.accepted) return;
    const parsed = parseDraft(draft, mode);
    if (!parsed.ok) {
      show(parsed.fields);
      release();
      return;
    }
    if (mode === "edit") {
      if (baseline === null || current === null) {
        release();
        return;
      }
      const patch = changedInput(baseline, parsed.value);
      if (patch === null) {
        show({ form: "No hay cambios para guardar." });
        release();
        return;
      }
      setSending(true);
      void saveAdminProduct({ data: { id: current.id, draft } })
        .then((result) => applyWrite(result))
        .catch(() => show({ form: "No pudimos guardar el producto." }))
        .finally(release);
      return;
    }
    setSending(true);
    void createAdminProduct({ data: draft })
      .then(async (result) => {
        if (result.kind !== "saved") {
          applyWrite(result);
          return;
        }
        await uploadQueued(result.product.id);
        await router.invalidate();
      })
      .catch(() => show({ form: "No pudimos guardar el producto." }))
      .finally(release);
  }

  function queueFile(file: File) {
    void file
      .slice(0, 12)
      .arrayBuffer()
      .then((buffer) => {
        const issue = photoIssue(file.size, new Uint8Array(buffer));
        if (issue !== null) {
          setPhotoNote(photoNotice(issue));
          return;
        }
        setPhotoNote(null);
        setQueue((items) => (canUpload(items.length) ? [...items, file] : items));
      });
  }

  return (
    <div className="stack">
      <header className="list-head">
        <h1>{mode === "create" ? "Nuevo producto" : "Editar producto"}</h1>
      </header>
      {mode === "edit" && current !== null ? (
        <ProductPhotos
          productId={current.id}
          photos={current.photos}
          label={current.name}
          note={note}
          onMissing={() => setMissing(true)}
          onDenied={() => setDenied(true)}
        />
      ) : (
        <section className="stack">
          <h2>Fotos</h2>
          <p className="muted">
            Se suben al crear el producto. Hasta 3, JPEG, PNG o WebP, de 5 MB.
          </p>
          <ul className="plain">
            {queue.map((file) => (
              <li key={`${file.name}-${file.size}`}>{file.name}</li>
            ))}
          </ul>
          <label className="btn btn-ghost">
            Elegir foto
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!canUpload(queue.length)}
              onChange={(event) => {
                const file = firstFile(event.currentTarget);
                clearField(event.currentTarget);
                if (file !== null) queueFile(file);
              }}
            />
          </label>
          {photoNote === null ? (
            <p className="field-error" />
          ) : (
            <p className="field-error" role="alert">
              {photoNote}
            </p>
          )}
        </section>
      )}
      <ProductForm
        mode={mode}
        draft={draft}
        errors={errors}
        sending={sending}
        onDraft={edit}
        onSubmit={onSubmit}
        focusRef={focusRef}
      />
    </div>
  );
}
