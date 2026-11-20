import { controlValue } from "../field-value";
import { Field, fieldProps } from "../ui/field";
import type { CheckoutFields } from "./schema";

export function CustomerFields({
  name,
  phone,
  email,
  errors,
  onName,
  onPhone,
  onEmail,
}: {
  name: string;
  phone: string;
  email: string;
  errors: CheckoutFields;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  onEmail: (value: string) => void;
}) {
  return (
    <section className="panel">
      <h2>
        <span className="step-n">1</span>
        Tus datos
      </h2>
      <div className="grid-2">
        <Field id="name" label="Nombre completo" error={errors.name}>
          <input
            {...fieldProps("name", errors.name)}
            autoComplete="name"
            placeholder="¿Cómo te llamas?"
            value={name}
            onChange={(event) => onName(controlValue(event.currentTarget))}
          />
        </Field>
        <Field id="phone" label="WhatsApp" error={errors.phone}>
          <span className="phone">
            <span className="phone-prefix">+51</span>
            <input
              {...fieldProps("phone", errors.phone)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="987 654 321"
              value={phone}
              onChange={(event) => onPhone(controlValue(event.currentTarget))}
            />
          </span>
        </Field>
      </div>
      <Field id="email" label="Correo" hint="(opcional)" error={errors.email}>
        <input
          {...fieldProps("email", errors.email)}
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(event) => onEmail(controlValue(event.currentTarget))}
        />
      </Field>
    </section>
  );
}
