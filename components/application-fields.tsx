"use client";
import { SERVICE_TYPES, serviceTypeKeys } from "@/lib/salon-application";
export type ApplicationValue = {
  instagram: string;
  facebook: string;
  serviceTypes: string[];
  staffCount: string;
};
// The questions the platform uses to check that a salon is real.
export function ApplicationFields({
  value,
  onChange,
}: {
  value: ApplicationValue;
  onChange: (patch: Partial<ApplicationValue>) => void;
}) {
  return (
    <>
      <label className="field">
        Инстаграм хаяг
        <input
          maxLength={100}
          value={value.instagram}
          onChange={(e) => onChange({ instagram: e.target.value.trim() })}
          placeholder="@salon77"
          autoCapitalize="none"
          aria-describedby="application-social-hint"
        />
      </label>
      <label className="field">
        Фэйсбүүк хаяг
        <input
          maxLength={200}
          value={value.facebook}
          onChange={(e) => onChange({ facebook: e.target.value.trim() })}
          placeholder="Хуудасныхаа холбоосыг оруулна уу"
          autoCapitalize="none"
          aria-describedby="application-social-hint"
        />
      </label>
      <p className="field-hint" id="application-social-hint">
        Аль нэгийг нь заавал оруулна. Бид хуудсыг тань үзэж, салоныг
        баталгаажуулна.
      </p>
      <fieldset className="application-types">
        <legend>Үйлчилгээний төрөл</legend>
        <div className="choice-chips">
          {serviceTypeKeys.map((key) => (
            <label className="check-chip" key={key}>
              <input
                type="checkbox"
                checked={value.serviceTypes.includes(key)}
                onChange={(e) =>
                  onChange({
                    serviceTypes: e.target.checked
                      ? [...value.serviceTypes, key]
                      : value.serviceTypes.filter((k) => k !== key),
                  })
                }
              />
              {SERVICE_TYPES[key]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        Ажилтны тоо
        <input
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={1000}
          step={1}
          value={value.staffCount}
          onChange={(e) => onChange({ staffCount: e.target.value })}
          placeholder="Жишээ: 4"
        />
      </label>
    </>
  );
}
