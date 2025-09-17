// src/components/modals/ChannelModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import styles from './ChannelModal.module.css';

// Renders the input fields for alert thresholds with icons and validation.
const ThresholdInputs = ({ thresholds, onThresholdChange, disabled }) => (
  <div className={`p-3 border rounded bg-light ${styles.thresholdSection}`}>
    <h6 className="mb-3">Alert Thresholds</h6>
    <div className="row g-3">
      <div className="col-12">
        <label htmlFor="ammoniaHigh" className="form-label mb-1">Ammonia High (PPM)</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-wind"></i></span>
          <input id="ammoniaHigh" type="number" className="form-control" value={thresholds.ammoniaHigh} onChange={e => onThresholdChange('ammoniaHigh', e.target.value)} placeholder="..." disabled={disabled} required />
        </div>
      </div>
      <div className="col-md-6">
        <label htmlFor="tempHigh" className="form-label mb-1">Temperature High (°C)</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-thermometer-half"></i></span>
          <input id="tempHigh" type="number" className="form-control" value={thresholds.tempHigh} onChange={e => onThresholdChange('tempHigh', e.target.value)} placeholder="..." disabled={disabled} required />
        </div>
      </div>
      <div className="col-md-6">
        <label htmlFor="tempLow" className="form-label mb-1">Temperature Low (°C)</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-thermometer-low"></i></span>
          <input id="tempLow" type="number" className="form-control" value={thresholds.tempLow} onChange={e => onThresholdChange('tempLow', e.target.value)} placeholder="..." disabled={disabled} required />
        </div>
      </div>
    </div>
  </div>
);

// Modal for creating or editing a poultry house.
const ChannelModal = ({ isOpen, onClose, onSubmit, onRemoveSensor, currentChannel, branchList = [] }) => {
  const isEditMode = !!currentChannel;
  const [channelName, setChannelName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [hasSensor, setHasSensor] = useState(true);
  const [isAddingSensor, setIsAddingSensor] = useState(false);
  const [thresholds, setThresholds] = useState({ tempLow: '', tempHigh: '', ammoniaHigh: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsLoading(false);
      if (isEditMode && currentChannel) {
        setChannelName(currentChannel.Name || '');
        setHasSensor(currentChannel.hasSensor);
        setIsAddingSensor(false);
        setThresholds(currentChannel.alertThreshold || { tempLow: '', tempHigh: '', ammoniaHigh: '' });
      } else {
        setChannelName('');
        setSelectedBranch(branchList.length > 0 ? branchList[0] : '');
        setHasSensor(true);
        setThresholds({ tempLow: '', tempHigh: '', ammoniaHigh: '' });
      }
    }
  }, [isOpen, currentChannel, isEditMode, branchList]);

  const handleThresholdChange = (field, value) => {
    setThresholds(prev => ({ ...prev, [field]: value }));
  };

  const showThresholds = (!isEditMode && hasSensor) || (isEditMode && currentChannel?.hasSensor) || (isEditMode && !currentChannel?.hasSensor && isAddingSensor);

  const hasChanges = useMemo(() => {
    if (!isEditMode || !currentChannel) return false;
    const initialName = currentChannel.Name || '';
    const initialThresholds = currentChannel.alertThreshold || { tempLow: '', tempHigh: '', ammoniaHigh: '' };
    const nameChanged = channelName.trim() !== initialName;
    if (currentChannel.hasSensor) {
      const thresholdsChanged =
        String(thresholds.tempLow) !== String(initialThresholds.tempLow) ||
        String(thresholds.tempHigh) !== String(initialThresholds.tempHigh) ||
        String(thresholds.ammoniaHigh) !== String(initialThresholds.ammoniaHigh);
      return nameChanged || thresholdsChanged;
    }
    return isAddingSensor ? true : nameChanged;
  }, [isEditMode, currentChannel, channelName, thresholds, isAddingSensor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isEditMode) {
        await onSubmit({ Name: channelName.trim(), addSensor: isAddingSensor, alertThreshold: thresholds }, true);
      } else {
        await onSubmit({ channelName: channelName.trim(), branchName: selectedBranch, hasSensor, alertThreshold: hasSensor ? thresholds : null }, false);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className={styles.modalHeader}>
            <h5 className={styles.modalTitle}>{isEditMode ? 'Poultry House Settings' : 'Create New Poultry House'}</h5>
            <button type="button" className={styles.closeButton} onClick={onClose} disabled={isLoading} aria-label="Close">×</button>
          </div>
          <div className={styles.modalBody}>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            
            {!isEditMode && (
              <div className="mb-3">
                <label htmlFor="branchSelect" className="form-label">Branch</label>
                <select id="branchSelect" className="form-select" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} disabled={isLoading} required>
                  <option value="" disabled>Select a branch...</option>
                  {branchList.map(branch => <option key={branch} value={branch}>{branch}</option>)}
                </select>
              </div>
            )}
            
            <div className="mb-3">
              <label htmlFor="channelName" className="form-label">Poultry House Name</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-pencil"></i></span>
                <input id="channelName" type="text" className="form-control" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="..." required disabled={isLoading || (isEditMode && !currentChannel.hasSensor && isAddingSensor)} />
              </div>
              {isEditMode && !currentChannel.hasSensor && isAddingSensor && <div className="form-text mt-1">House name cannot be changed while adding a sensor.</div>}
            </div>

            {!isEditMode && (
              <div className="mb-3 p-3 border rounded bg-light">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" role="switch" id="hasSensorCheck" checked={hasSensor} onChange={() => setHasSensor(prev => !prev)} disabled={isLoading}/>
                  <label className="form-check-label" htmlFor="hasSensorCheck"><strong>Add Sensor to this House</strong></label>
                </div>
                <div className="form-text mt-1 ps-1">Check this to include and configure sensor alert thresholds.</div>
              </div>
            )}

            {isEditMode && !currentChannel?.hasSensor && (
              <div className="mb-3 p-3 border rounded bg-light">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" role="switch" id="addSensorCheck" checked={isAddingSensor} onChange={(e) => setIsAddingSensor(e.target.checked)} disabled={isLoading} />
                  <label className="form-check-label" htmlFor="addSensorCheck"><strong>Add Sensor to this House</strong></label>
                </div>
                <div className="form-text mt-1 ps-1">This will create a new sensor data channel for this house.</div>
              </div>
            )}

            {showThresholds && (
              <div className="mb-3">
                <ThresholdInputs thresholds={thresholds} onThresholdChange={handleThresholdChange} disabled={isLoading} />
              </div>
            )}
            
            {isEditMode && currentChannel?.hasSensor && (
              <div className="mt-4 p-3 border border-danger-subtle rounded bg-danger-subtle">
                <h6 className="text-danger fw-bold">Danger Zone</h6>
                <p className="small mb-2">Removing the sensor permanently deletes all its historical data. This cannot be undone.</p>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onRemoveSensor(currentChannel)} disabled={isLoading}><i className="bi bi-trash me-2"></i>Remove Sensor</button>
              </div>
            )}
            
            {isLoading && <div className="text-center my-3"><div className="spinner-border text-primary spinner-border-sm" role="status"></div><span className="ms-2">Processing...</span></div>}
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose} disabled={isLoading}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnConfirm}`} disabled={isLoading || (isEditMode && !hasChanges)}>
              {isLoading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Settings' : 'Create House')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChannelModal;