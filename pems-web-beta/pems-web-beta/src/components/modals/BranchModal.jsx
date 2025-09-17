// src/components/modals/BranchModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import styles from './ChannelModal.module.css';

// Manages creating, editing, and deleting branches.
const BranchModal = ({ isOpen, onClose, onSubmit, onDelete, branches = [], isLoading }) => {
  const [selectedBranchName, setSelectedBranchName] = useState('__NEW__');
  const [branchName, setBranchName] = useState('');
  const [branchKey, setBranchKey] = useState('');
  const [error, setError] = useState('');

  const isEditMode = useMemo(() => selectedBranchName !== '__NEW__', [selectedBranchName]);

  // Reset form state when modal opens.
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSelectedBranchName('__NEW__');
    }
  }, [isOpen]);

  // Update form fields based on selected branch.
  useEffect(() => {
    if (!isOpen) return;
    const selectedBranchData = branches.find(b => b.name === selectedBranchName);
    if (isEditMode && selectedBranchData) {
      setBranchName(selectedBranchData.name || '');
      setBranchKey(selectedBranchData.key || '');
    } else {
      setBranchName('');
      setBranchKey('');
    }
  }, [selectedBranchName, branches, isOpen, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!branchName.trim() || !branchKey.trim()) {
      setError('Branch Name and Key are required.');
      return;
    }
    try {
      await onSubmit({ name: branchName.trim(), key: branchKey.trim() }, isEditMode, selectedBranchName);
    } catch (err) { setError(err.message || 'An unexpected error occurred.') }
  };

  const handleDeleteClick = () => {
    if (onDelete && isEditMode) {
      onDelete(selectedBranchName);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className={styles.modalHeader}>
            <h5 className={styles.modalTitle}>{isEditMode ? 'Edit Branch' : 'Add New Branch'}</h5>
            <button type="button" className={styles.closeButton} onClick={onClose} disabled={isLoading} aria-label="Close">×</button>
          </div>
          <div className={styles.modalBody}>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <div className="mb-3">
              <label htmlFor="branchSelect" className="form-label">Action</label>
              <select id="branchSelect" className="form-select" value={selectedBranchName} onChange={(e) => setSelectedBranchName(e.target.value)} disabled={isLoading}>
                <option value="__NEW__">-- Create New Branch --</option>
                {branches.map(branch => <option key={branch.name} value={branch.name}>Edit: {branch.name}</option>)}
              </select>
            </div>
            <hr />
            <div className="mb-3">
              <label htmlFor="branchNameInput" className="form-label">Branch Name</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-pencil"></i></span>
                <input id="branchNameInput" type="text" className="form-control" value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="..." required disabled={isLoading} />
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="branchKeyInput" className="form-label">Branch Key</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-pencil"></i></span>
                <input id="branchKeyInput" type="text" className="form-control" value={branchKey} onChange={(e) => setBranchKey(e.target.value)} placeholder="..." required disabled={isLoading} />
              </div>
            </div>
            
            {isEditMode && (
              <div className="mt-4 p-3 border border-danger-subtle rounded bg-danger-subtle">
                <h6 className="text-danger fw-bold">Danger</h6>
                <p className="small mb-2">Deleting a branch is permanent and only possible if it contains no houses.</p>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleDeleteClick} disabled={isLoading}><i className="bi bi-trash me-2"></i>Delete This Branch</button>
              </div>
            )}

            {isLoading && <div className="text-center my-3"><div className="spinner-border text-primary spinner-border-sm" role="status"></div><span className="ms-2">Processing...</span></div>}
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose} disabled={isLoading}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnConfirm}`} disabled={isLoading}>
              {isLoading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Branch')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchModal;