import Modal from './Modal';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={busy ? undefined : onCancel}>
      <div className="confirm-dialog">
        <div className={`confirm-dialog-icon ${danger ? 'danger' : ''}`}>{danger ? '!' : '✓'}</div>
        <p>{message}</p>
      </div>
      <div className="modal-actions">
        <button className="button button-ghost" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button className={`button ${danger ? 'button-danger' : 'button-primary'}`} type="button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
