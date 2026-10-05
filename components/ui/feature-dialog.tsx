"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function FeatureDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="native-dialog"
      aria-label={title}
      onCancel={onClose}
    >
      <div className="form-dialog">
        <div className="form-dialog-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Цонх хаах"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="success-message" role="status">
          {message}
        </div>
      )}
    </>
  );
}
