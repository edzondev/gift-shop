import { useRef, useState } from "react";
import { photoNotice } from "../product-errors";
import {
  canUpload,
  type PhotoRef,
  photosAfterCreate,
  photosAfterDelete,
  photosAfterReject,
} from "../product-photo";
import { type Gate, releaseClick, takeClick } from "../product-stock";
import { deleteProductPhoto, uploadProductPhoto } from "../product-upload";
import { clearField, firstFile } from "./field-value";
import { ProductPhoto } from "./product-photo";

const SLOTS = [0, 1, 2] as const;

function openDialog(node: HTMLElement | null): void {
  if (node !== null && "showModal" in node && typeof node.showModal === "function")
    node.showModal();
}

export function ProductPhotos({
  productId,
  photos,
  label,
  note,
  onMissing,
  onDenied,
}: {
  productId: string;
  photos: readonly PhotoRef[];
  label: string;
  note: string | null;
  onMissing: () => void;
  onDenied: () => void;
}) {
  const gate = useRef<Gate>({ busy: false });
  const [list, setList] = useState<readonly PhotoRef[]>(photos);
  const [seenId, setSeenId] = useState(productId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(note);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const dialog = useRef<HTMLElement>(null);
  if (seenId !== productId) {
    setSeenId(productId);
    setList(photos);
    setMessage(note);
    setBusy(false);
    gate.current = releaseClick();
  }

  function release() {
    gate.current = releaseClick();
    setBusy(false);
  }

  function begin(): boolean {
    const click = takeClick(gate.current);
    gate.current = click.gate;
    if (!click.accepted) return false;
    setBusy(true);
    return true;
  }

  function upload(file: File) {
    if (!canUpload(list.length) || !begin()) return;
    const current = list;
    void uploadProductPhoto(productId, file)
      .then((result) => {
        if (result.kind === "created") {
          setList(photosAfterCreate(current, result.photo));
          setMessage(null);
          return;
        }
        setList(photosAfterReject(current));
        if (result.kind === "denied") {
          onDenied();
          return;
        }
        if (result.kind === "missing") {
          onMissing();
          return;
        }
        if (result.kind === "rejected") setMessage(photoNotice(result.code));
        else setMessage("No pudimos subir la foto.");
      })
      .catch(() => {
        setList(photosAfterReject(current));
        setMessage("No pudimos subir la foto.");
      })
      .finally(release);
  }

  function remove(photoId: string) {
    if (!begin()) return;
    const current = list;
    void deleteProductPhoto(productId, photoId)
      .then((result) => {
        if (result.kind === "deleted") {
          setList(photosAfterDelete(current, photoId));
          setMessage(null);
          return;
        }
        setList(photosAfterReject(current));
        if (result.kind === "denied") onDenied();
        else if (result.kind === "missing") onMissing();
        else setMessage("No pudimos borrar la foto.");
      })
      .catch(() => {
        setList(photosAfterReject(current));
        setMessage("No pudimos borrar la foto.");
      })
      .finally(release);
  }

  return (
    <section className="stack">
      <h2>Fotos</h2>
      <ul className="photo-grid">
        {SLOTS.map((slot) => {
          const photo = list[slot];
          return (
            <li key={photo?.id ?? `vacio-${slot}`} className="photo-slot">
              {photo === undefined ? null : (
                <>
                  <ProductPhoto
                    photoKey={photo.key}
                    label={label}
                    frame="thumb"
                    priority={false}
                    decorative={false}
                  />
                  <button
                    type="button"
                    className="photo-remove"
                    disabled={busy}
                    onClick={() => {
                      setPendingId(photo.id);
                      openDialog(dialog.current);
                    }}
                  >
                    Quitar
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <label className="btn btn-ghost">
        Subir foto
        <input
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || !canUpload(list.length)}
          onChange={(event) => {
            const file = firstFile(event.currentTarget);
            clearField(event.currentTarget);
            if (file !== null) upload(file);
          }}
        />
      </label>
      {message === null ? (
        <p className="field-error" />
      ) : (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <dialog ref={dialog} className="confirm" aria-labelledby="photo-delete-title">
        <h2 id="photo-delete-title">Quitar foto</h2>
        <p>La foto se borra del producto.</p>
        <form
          className="actions"
          method="dialog"
          onSubmit={(event) => {
            const submitter = event.nativeEvent;
            const value =
              "submitter" in submitter &&
              typeof submitter.submitter === "object" &&
              submitter.submitter !== null &&
              "value" in submitter.submitter &&
              typeof submitter.submitter.value === "string"
                ? submitter.submitter.value
                : "";
            if (value === "delete" && pendingId !== null) remove(pendingId);
          }}
        >
          <button type="submit" className="btn btn-ghost" value="cancel">
            Cancelar
          </button>
          <button type="submit" className="btn" value="delete" disabled={busy}>
            Quitar
          </button>
        </form>
      </dialog>
    </section>
  );
}
