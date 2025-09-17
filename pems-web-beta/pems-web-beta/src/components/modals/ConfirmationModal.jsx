// src/components/modals/ConfirmationModal.jsx
import React from 'react';
import styles from './ConfirmationModal.module.css';

// A modal for confirming user actions, with customizable styles and messages.
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isProcessing = false,
  confirmButtonType = 'danger',
}) => {
  if (!isOpen) return null;

  const getConfirmButtonClass = () => {
    switch (confirmButtonType) {
      case 'danger':
        return styles.btnConfirmDanger;
      case 'primary':
        return styles.btnConfirmPrimary;
      case 'warning':
        return styles.btnConfirmWarning;
      case 'success':
        return styles.btnConfirmSuccess;
      case 'success-dark':
        return styles.btnConfirmSuccessDark;
      default:
        return styles.btnConfirmPrimary;
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} ${styles[confirmButtonType] || styles.danger}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h5 className={styles.modalTitle}>{title || 'Confirm Action'}</h5>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnCancel}`}
            onClick={onClose}
            disabled={isProcessing}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${getConfirmButtonClass()}`}
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span className="ms-1">Processing...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;