"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type Confirmation = { title: string; message: string; confirmLabel: string };

export function ConfirmationDialog({ title, message, confirmLabel, onConfirm, onCancel }: Confirmation & { onConfirm: () => void; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return createPortal(
    <dialog ref={dialogRef} className="confirmation-dialog" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <h2 id="confirmation-title">{title}</h2>
      <p id="confirmation-message">{message}</p>
      <div className="confirmation-actions">
        <button type="button" className="button button-secondary" autoFocus onClick={onCancel}>Cancel</button>
        <button type="button" className="button button-primary" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>, document.body,
  );
}
