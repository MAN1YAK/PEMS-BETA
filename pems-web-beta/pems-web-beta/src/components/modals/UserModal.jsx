// src/components/modals/UserModal.jsx
import React, { useState, useEffect } from 'react';
import styles from './UserModal.module.css';

// Modal for creating a new user or editing an existing one.
const UserModal = ({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
  isLoading,
  branches = [],
}) => {
  const isEditMode = !!currentUser;

  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [branchId, setBranchId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  // Effect to reset and populate form state when modal opens or user changes.
  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setShowPassword(false);
      if (isEditMode && currentUser) {
        setRole(currentUser.role || 'Worker');
        setName(currentUser.name || '');
        setPhoneNumber(currentUser.id || '');
        setBranchId(currentUser.branchRefs?.[0]?.id || '');
      } else {
        setRole('');
        setName('');
        setPhoneNumber('');
        setBranchId('');
        setEmail('');
        setPassword('');
      }
    }
  }, [isOpen, currentUser, isEditMode]);

  // Handles form submission, validation, and calling the onSubmit prop.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    let formData = { role };
    let validationError = '';
    const currentRole = isEditMode ? 'Worker' : role;

    if (!isEditMode && !currentRole) {
      validationError = 'A role must be selected.';
    } else if (currentRole === 'Worker') {
      if (!name.trim()) validationError = 'Worker name is required.';
      else if (!phoneNumber.trim()) validationError = 'Phone number is required.';
      else if (!branchId) validationError = 'A branch must be selected for the worker.';
      formData = { ...formData, name: name.trim(), phoneNumber: phoneNumber.trim(), branchId };
    } else if (currentRole === 'Admin') {
      if (!/\S+@\S+\.\S+/.test(email)) validationError = "A valid email is required for admins.";
      else if (password.length < 6) validationError = "Password must be at least 6 characters long.";
      formData = { ...formData, email, password };
    }

    if (validationError) {
      setFormError(validationError);
      return;
    }
    try {
      await onSubmit(formData, isEditMode);
    } catch (error) {
      setFormError(error.message || 'An unexpected error occurred.');
    }
  };
  
  // Renders form fields specific to the 'Worker' role.
  const renderWorkerFields = () => (
    <>
      <div className={styles.formGroup}>
        <label htmlFor="name" className={styles.formLabel}>Worker Name</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-pencil"></i></span>
          <input type="text" id="name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} required placeholder="..." />
        </div>
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="phoneNumber" className={styles.formLabel}>Phone Number</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-pencil"></i></span>
          <input type="tel" id="phoneNumber" className="form-control" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={isLoading} required placeholder="..." />
        </div>
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="branch" className={styles.formLabel}>Branch</label>
        <select id="branch" className="form-select" value={branchId} onChange={(e) => setBranchId(e.target.value)} required disabled={isLoading}>
          <option value="" disabled>-- Select a Branch --</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
    </>
  );

  // Renders form fields specific to the 'Admin' role.
  const renderAdminFields = () => (
    <>
      <div className={styles.formGroup}>
        <label htmlFor="email" className={styles.formLabel}>Admin Email</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-pencil"></i></span>
          <input type="email" id="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} required autoComplete="username" placeholder="e.g., admin@example.com" />
        </div>
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="password" className={styles.formLabel}>Password</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-pencil"></i></span>
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
            placeholder="Must be at least 6 characters"
          />
          <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
          </button>
        </div>
        <small className="form-text text-muted">Password must be at least 6 characters.</small>
      </div>
    </>
  );

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h5 className={styles.modalTitle}>{isEditMode ? `Edit Worker` : 'Add New User'}</h5>
          <button onClick={onClose} className={styles.btnClose} aria-label="Close modal" disabled={isLoading}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody} autoComplete="off">
          {isEditMode ? (
            renderWorkerFields()
          ) : (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="role" className={styles.formLabel}>Role</label>
                <select id="role" className="form-select" value={role} onChange={(e) => setRole(e.target.value)} required disabled={isLoading}>
                  <option value="" disabled>-- Select a Role --</option>
                  <option value="Worker">Worker</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              {role && <hr className={styles.separator} />}
              {role === 'Worker' && renderWorkerFields()}
              {role === 'Admin' && renderAdminFields()}
            </>
          )}

          {formError && <div className={styles.errorMessage}>{formError}</div>}

          <div className={styles.modalActions}>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={isLoading || (!isEditMode && !role)}>
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span className="ms-1">Saving...</span>
                </>
              ) : (isEditMode ? 'Save Changes' : 'Add User')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;