import { controlValue } from "../field-value";
import { SLOTS, STATIONS, slotLabel, stationLabel } from "../labels";
import { Field, fieldProps } from "../ui/field";
import type { CheckoutFields, DeliveryDraft } from "./schema";

const DISTRICTS = [
  "San Juan de Lurigancho",
  "El Agustino",
  "Ate",
  "Santa Anita",
  "Cercado de Lima",
  "La Victoria",
  "Rímac",
  "San Martín de Porres",
  "Los Olivos",
  "San Borja",
  "Surco",
  "Miraflores",
];

export function DeliveryFields({
  delivery,
  errors,
  onMode,
  onDelivery,
}: {
  delivery: DeliveryDraft;
  errors: CheckoutFields;
  onMode: (mode: DeliveryDraft["mode"]) => void;
  onDelivery: (delivery: DeliveryDraft) => void;
}) {
  return (
    <section className="panel">
      <h2>
        <span className="step-n">2</span>
        ¿Cómo lo recibes?
      </h2>
      <div className="receive">
        <button
          type="button"
          aria-pressed={delivery.mode === "estacion"}
          onClick={() => onMode("estacion")}
        >
          <b>Estación del tren</b>
          <span>Línea 1 · coordinamos por WhatsApp</span>
          <small>Gratis</small>
        </button>
        <button
          type="button"
          aria-pressed={delivery.mode === "delivery"}
          onClick={() => onMode("delivery")}
        >
          <b>Delivery a domicilio</b>
          <span>A tu puerta, en cualquier distrito</span>
          <small>Costo según zona</small>
        </button>
      </div>
      {delivery.mode === "estacion" ? (
        <>
          <fieldset className="choices">
            <legend>Estación</legend>
            <div className="choice-row chips">
              {STATIONS.map((station) => (
                <button
                  key={station}
                  id={station === STATIONS[0] ? "station" : undefined}
                  type="button"
                  aria-pressed={delivery.station === station}
                  onClick={() => onDelivery({ mode: "estacion", station, slot: delivery.slot })}
                >
                  {stationLabel(station)}
                </button>
              ))}
            </div>
            {errors.station !== undefined ? <span className="error">{errors.station}</span> : null}
          </fieldset>
          <fieldset className="choices">
            <legend>Horario</legend>
            <div className="choice-row chips">
              {SLOTS.map((slot) => (
                <button
                  key={slot}
                  id={slot === SLOTS[0] ? "slot" : undefined}
                  type="button"
                  aria-pressed={delivery.slot === slot}
                  onClick={() => onDelivery({ mode: "estacion", station: delivery.station, slot })}
                >
                  {slotLabel(slot)}
                </button>
              ))}
            </div>
            {errors.slot !== undefined ? <span className="error">{errors.slot}</span> : null}
          </fieldset>
        </>
      ) : (
        <>
          <Field id="address" label="Dirección" error={errors.address}>
            <input
              {...fieldProps("address", errors.address)}
              placeholder="Av., calle, número, dpto."
              value={delivery.address}
              onChange={(event) =>
                onDelivery({
                  mode: "delivery",
                  address: controlValue(event.currentTarget),
                  district: delivery.district,
                  reference: delivery.reference,
                })
              }
            />
          </Field>
          <Field id="district" label="Distrito" error={errors.district}>
            <input
              {...fieldProps("district", errors.district)}
              list="distritos"
              value={delivery.district}
              onChange={(event) =>
                onDelivery({
                  mode: "delivery",
                  address: delivery.address,
                  district: controlValue(event.currentTarget),
                  reference: delivery.reference,
                })
              }
            />
          </Field>
          <datalist id="distritos">
            {DISTRICTS.map((district) => (
              <option key={district} value={district} />
            ))}
          </datalist>
          <Field id="reference" label="Referencia" hint="(opcional)" error={errors.reference}>
            <input
              {...fieldProps("reference", errors.reference)}
              placeholder="Frente al parque, portón verde…"
              value={delivery.reference}
              onChange={(event) =>
                onDelivery({
                  mode: "delivery",
                  address: delivery.address,
                  district: delivery.district,
                  reference: controlValue(event.currentTarget),
                })
              }
            />
          </Field>
          <p className="hint">
            El costo del delivery depende de tu zona. Te lo confirmamos por WhatsApp antes de
            enviar, y lo yapeas aparte.
          </p>
        </>
      )}
    </section>
  );
}
