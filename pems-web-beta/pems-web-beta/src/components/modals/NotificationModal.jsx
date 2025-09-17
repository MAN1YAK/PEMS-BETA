// src\components\modals\NotificationModal.jsx
import React from 'react';
import styles from './NotificationModal.module.css';

const NotificationModal = ({ isOpen, onClose, title, message, type = 'info' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <i className={`bi bi-check-circle-fill ${styles.iconSuccess}`}></i>;
      case 'error':
        return <i className={`bi bi-x-octagon-fill ${styles.iconError}`}></i>;
      case 'warning':
        return <i className={`bi bi-exclamation-triangle-fill ${styles.iconWarning}`}></i>;
      default:
        return <i className={`bi bi-info-circle-fill ${styles.iconInfo}`}></i>;
    }
  };

  const defaultTitles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information'
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} ${styles[type]}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          {getIcon()}
          <h5 className={styles.modalTitle}>{title || defaultTitles[type] || 'Notification'}</h5>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>
          <p dangerouslySetInnerHTML={{ __html: message }} />
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={`btn ${styles.btnOk} ${styles['btnOk-' + type]}`} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;