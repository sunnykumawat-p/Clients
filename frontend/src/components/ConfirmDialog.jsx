import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Reusable confirmation dialog for destructive actions.
 * Usage:
 *   const [confirm, setConfirm] = useState(null);
 *   setConfirm({ title, message, confirmLabel, onConfirm });
 *   ...
 *   <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
 */
export default function ConfirmDialog({ state, onClose }) {
  const open = !!state;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  if (!open) return null;

  const {
    title = "Are you sure?",
    message = "This action cannot be undone.",
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    tone = "danger",
    onConfirm,
    testId = "confirm-dialog",
  } = state;

  const confirmClass =
    tone === "danger"
      ? "cp-btn-primary"
      : "cp-btn-primary";

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
      onClose?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-[rgba(45,44,42,0.4)] backdrop-blur-sm cp-fade-in"
      onClick={onClose}
      data-testid={`${testId}-overlay`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cp-card w-full md:max-w-md md:rounded-2xl rounded-t-3xl overflow-hidden cp-slide-up"
        data-testid={testId}
      >
        <div className="flex items-start gap-3 px-5 py-5">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--cp-accent-surface)] text-[color:var(--cp-accent)] flex items-center justify-center shrink-0">
            <AlertTriangle size={18} strokeWidth={2.1} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-semibold text-[color:var(--cp-text)]">{title}</h3>
              <button
                onClick={onClose}
                className="cp-btn-ghost -mr-1"
                aria-label="Close"
                data-testid={`${testId}-close`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-1 text-[13.5px] text-[color:var(--cp-text-2)] leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="px-5 pb-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="cp-btn-secondary text-[13px]"
            data-testid={`${testId}-cancel`}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className={confirmClass}
            data-testid={`${testId}-confirm`}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
