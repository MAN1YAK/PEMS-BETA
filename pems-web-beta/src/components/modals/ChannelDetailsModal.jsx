// src/components/modals/ChannelDetailsModal.jsx
import React, { useState, useEffect } from 'react';
import styles from './ChannelDetailsModal.module.css';
import { Timestamp } from 'firebase/firestore';

// A component to display sensitive data with a show/hide toggle.
const SensitiveDataField = ({ label, value }) => {
  const [isVisible, setIsVisible] = useState(false);

  if (!value) {
    return (
      <div className={styles.detailRow}>
        <strong>{label}:</strong>
        <em className="text-muted">Not Available</em>
      </div>
    );
  }

  return (
    <div className={styles.detailRow}>
      <strong>{label}:</strong>
      <div className={styles.sensitiveValue}>
        <span className={styles.valueText}>
          {isVisible ? value : '•'.repeat(12)}
        </span>
        <i
          className={`bi ${isVisible ? 'bi-eye-slash-fill' : 'bi-eye-fill'} ${styles.eyeIcon}`}
          role="button"
          title={isVisible ? 'Hide' : 'Show'}
          onClick={() => setIsVisible(!isVisible)}
        />
      </div>
    </div>
  );
};

// Modal to display detailed information about a channel.
const ChannelDetailsModal = ({ isOpen, onClose, channel }) => {
  if (!isOpen || !channel) return null;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleString();
    }
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h5 className={styles.modalTitle}><i className="bi bi-gear-fill me-2"></i>Channel Details</h5>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.detailRow}>
            <strong>Name:</strong>
            <span>{channel.Name || 'N/A'}</span>
          </div>
          <div className={styles.detailRow}>
            <strong>Date Created:</strong>
            <span>{formatDate(channel["Date Created"])}</span>
          </div>
          <hr className={styles.divider} />
          <SensitiveDataField label="Sensor ID" value={channel.firestoreId} />
          <SensitiveDataField label="Data ID" value={channel.ID} />
          <SensitiveDataField label="Data Read Key" value={channel.ReadAPI} />
          <SensitiveDataField label="Data Edit Key" value={channel.WriteAPI} />
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={`${styles.btn} ${styles.btnClose}`} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ChannelDetailsModal;