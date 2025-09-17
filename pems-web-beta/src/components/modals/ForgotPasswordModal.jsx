// src/components/modals/ForgotPasswordModal.jsx
import React, { useState } from 'react';
import { resetPassword } from '../../firebase/passwordrecovery';
import logo from '../../assets/logo.jpg';
import styles from './ForgotPasswordModal.module.css';

// Renders the password recovery modal.
function PasswordRecoveryModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messageConfig, setMessageConfig] = useState({ text: '', type: 'error', visible: false });

  // Displays a message banner.
  const displayMessage = (text, type = 'error', duration = 4000) => {
    setMessageConfig({ text, type, visible: true });
    setTimeout(() => setMessageConfig((prev) => ({ ...prev, visible: false })), duration);
  };

  // Handles the password reset request.
  const handlePasswordReset = async (event) => {
    event.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      displayMessage(!email ? 'Please enter your email address.' : 'Enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const { success, message } = await resetPassword(email.toLowerCase());
      displayMessage(message, success ? 'success' : 'error');
      if (success) {
        setEmail('');
        setTimeout(onClose, 2500);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      displayMessage('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`${styles.messageDiv} ${messageConfig.visible ? styles.show : ''} ${styles[messageConfig.type]}`}
      >
        {messageConfig.text}
      </div>

      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <button className={styles.btnClose} onClick={onClose} disabled={isLoading} aria-label="Close">
            &times;
          </button>

          <div className={styles.modalHeader}>
            <h2>
              <img src={logo} alt="Logo" className={styles.enhancedLogo} />
              PEMS<span style={{ color: '#a2e089' }}>.</span>
            </h2>
            <p>Password Recovery</p>
            <p className={styles.instructionText}>
              Enter your email below to receive a password reset link.
            </p>
          </div>

          <form className={styles.formGroup} onSubmit={handlePasswordReset} noValidate>
            <div className="input-group">
              <span className={styles.iconSpan}>
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="email"
                className={styles.formControl}
                placeholder="EMAIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" onClick={onClose} className={styles.btnSecondary} disabled={isLoading}>
                Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className={styles.spinner} /> Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default PasswordRecoveryModal;