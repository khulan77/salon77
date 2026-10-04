import type { FormEvent } from "react";

function fieldTarget(event: FormEvent<HTMLFormElement>) {
  const target = event.target;
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
    ? target
    : null;
}
export function localizeInvalidField(event: FormEvent<HTMLFormElement>) {
  const field = fieldTarget(event);
  if (!field) return;
  field.setCustomValidity("");
  const validity = field.validity;
  if (validity.valid) return;
  let message = "Мэдээллээ шалгаад дахин оруулна уу.";
  if (validity.valueMissing) message = "Энэ талбарыг бөглөнө үү.";
  else if (validity.typeMismatch) message = "Зөв имэйл хаяг оруулна уу.";
  else if (validity.tooShort && !(field instanceof HTMLSelectElement))
    message = `Доод тал нь ${field.minLength} тэмдэгт оруулна уу.`;
  else if (validity.tooLong && !(field instanceof HTMLSelectElement))
    message = `Хамгийн ихдээ ${field.maxLength} тэмдэгт оруулна уу.`;
  else if (validity.rangeUnderflow && field instanceof HTMLInputElement)
    message = `${field.min}-аас багагүй утга оруулна уу.`;
  else if (validity.rangeOverflow && field instanceof HTMLInputElement)
    message = `${field.max}-аас ихгүй утга оруулна уу.`;
  else if (validity.badInput || validity.stepMismatch)
    message = "Зөв тоон утга оруулна уу.";
  else if (validity.patternMismatch)
    message = "Заасан хэлбэрээр утгаа оруулна уу.";
  field.setCustomValidity(message);
}
export function clearFieldValidity(event: FormEvent<HTMLFormElement>) {
  fieldTarget(event)?.setCustomValidity("");
}
