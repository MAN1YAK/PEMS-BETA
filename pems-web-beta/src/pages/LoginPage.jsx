// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import logo from '../assets/logo.jpg';
import styles from '../styles/LoginPage.module.css';
import PasswordRecoveryModal from '../components/modals/ForgotPasswordModal';

// Renders the main login page for the application.
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [messageConfig, setMessageConfig] = useState({
    text: '',
    type: 'error',
    visible: false,
  });
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add(styles.pageBody);
    return () => {
      document.body.classList.remove(styles.pageBody);
    };
  }, []);

  // Displays a temporary message banner at the top of the screen.
  const displayMessage = (text, type = 'error', duration = 3000) => {
    setMessageConfig({ text, type, visible: true });
    setTimeout(() => {
      setMessageConfig((prev) => ({ ...prev, visible: false }));
    }, duration);
  };

  // Handles the user login process.
  const handleLogin = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      displayMessage('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    try {
      const userCredentials = await signInWithEmailAndPassword(auth, email, password);
      displayMessage('Login Successful!', 'success');
      localStorage.setItem('loggedInUserEmail', userCredentials.user.email);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) {
      console.error("Login error:", error);
      const errorCode = error.code;
      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
        displayMessage('Incorrect email or password.');
      } else if (errorCode === 'auth/too-many-requests') {
        displayMessage('Too many login attempts. Please try again later.');
      } else {
        displayMessage('Enter a valid email address.');
      }
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={styles.loginContainer}>
        <img src={logo} alt="Logo" className={styles.enhancedLogo} />
        <h1>PEMS<span style={{ color: '#a2e089' }}>.</span></h1>
        <p>Poultry Environment Monitoring System</p>

        <div
          className={`${styles.messageDiv} ${messageConfig.visible ? styles.show : ''} ${styles[messageConfig.type]}`}
        >
          {messageConfig.text}
        </div>

        <form onSubmit={handleLogin} noValidate>
          <div className="input-group mb-3">
            <span className={`input-group-text ${styles.iconSpan}`}>
              <i className="bi bi-envelope"></i>
            </span>
            <input
              type="email"
              className={`form-control ${styles.formControl}`}
              placeholder="EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="input-group mb-3">
            <span className={`input-group-text ${styles.iconSpan}`}>
              <i className="bi bi-lock"></i>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              className={`form-control ${styles.formControl}`}
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <span
              className={`input-group-text ${styles.passwordToggleIcon}`}
              onClick={() => setShowPassword(!showPassword)}
              role="button"
              tabIndex={0}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
            </span>
          </div>

          <button
            type="button"
            className={`${styles.forgotPassword} mt-3 ${isLoading ? styles.disabledLink : ''}`}
            onClick={() => !isLoading && setShowModal(true)}
          >
            Forgot Password?
          </button>

          <button className={styles.btnLogin} type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className={styles.spinner} role="status"></span>
                Logging In...
              </>
            ) : (
              'LOGIN'
            )}
          </button>
        </form>
      </div>

      <PasswordRecoveryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

export default LoginPage;