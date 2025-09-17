import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore'; // Added writeBatch, serverTimestamp
import { auth, db } from '../firebase/firebaseConfig';
import logo from '../assets/logo.jpg';
import styles from '../styles/LoginPage.module.css'; // Reusing the login page CSS Module

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [customId, setCustomId] = useState(''); // This will be the Channel's Firestore Document ID
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messageConfig, setMessageConfig] = useState({
    text: '',
    type: 'error', // 'error' or 'success'
    visible: false,
  });
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add(styles.pageBody);
    return () => {
      document.body.classList.remove(styles.pageBody);
    };
  }, []);

  const displayMessage = (text, type = 'error', duration = 3000) => {
    setMessageConfig({ text, type, visible: true });
    setTimeout(() => {
      setMessageConfig((prev) => ({ ...prev, visible: false }));
    }, duration);
  };

  const toggleShowPassword = () => setShowPassword(!showPassword);
  const toggleShowConfirmPassword = () => setShowConfirmPassword(!showConfirmPassword);

  const handleRegister = async (event) => {
    event.preventDefault();

    // --- Client-side Validations ---
    if (!email || !password || !customId || !confirmPassword) {
      displayMessage("Please fill all the fields.", "error"); return;
    }
    if (password !== confirmPassword) {
      displayMessage("Passwords do not match.", "error"); return;
    }
    if (password.length < 6) {
      displayMessage("Password should be at least 6 characters.", "error"); return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      displayMessage("Invalid email format.", "error"); return;
    }

    setIsLoading(true);
    const normalizedEmail = email.toLowerCase();
    // 'customId' from the form is the Firestore Document ID of the 'channels' document.
    const channelFirestoreId = customId.trim();

    if (!channelFirestoreId) {
        displayMessage("Product ID (Channel Firestore ID) is required.", "error");
        setIsLoading(false);
        return;
    }

    const channelRef = doc(db, "channels", channelFirestoreId);

    try {
        // --- Step 1: Validate Channel (existence and availability) BEFORE creating Auth user ---
        const channelSnap = await getDoc(channelRef);
        if (!channelSnap.exists()) {
            displayMessage(`Product ID (Channel) "${channelFirestoreId}" does not exist. Please verify.`, "error");
            setIsLoading(false);
            return;
        }

        const channelData = channelSnap.data();
        if (channelData.User) { // Check if the 'User' field (DocumentReference) is already set
            let assignedUserMsg = "another user";
            if (channelData.User.id) { // User.id would be the email of the assigned user
                assignedUserMsg = `user ${channelData.User.id}`;
            }
            displayMessage(`Product ID (Channel) "${channelFirestoreId}" is already assigned to ${assignedUserMsg}.`, "error");
            setIsLoading(false);
            return;
        }

        // --- Step 2: Create Firebase Auth user (if channel is valid and available) ---
        // Use normalizedEmail for auth creation.
        const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        // If we are here, auth user was created successfully. auth.currentUser is the new user.

        // --- Step 3: Prepare Firestore batch for creating user document and updating channel document ---
        const userDocRef = doc(db, "users", normalizedEmail); // User document ID is the normalized email
        const batch = writeBatch(db);

        const userDocPayload = {
            role: "user", // Role is 'user' for self-registration
            "Poultry Houses": [channelRef], // Store DocumentReference to the channel
            createdAt: serverTimestamp(),
            // No 'email: normalizedEmail' field; doc ID is the email.
        };
        batch.set(userDocRef, userDocPayload);

        // Update the channel document to link its 'User' field to the new user
        batch.update(channelRef, { User: userDocRef });

        // --- Step 4: Commit Firestore batch ---
        await batch.commit();

        // --- Registration Succeeded ---
        displayMessage("Account Created Successfully! Redirecting to login...", "success", 4000);
        // isLoading remains true, button stays disabled ("Signing Up...") until navigation.
        setTimeout(() => {
            navigate('/login');
            // Component will unmount, so no explicit setIsLoading(false) needed here.
        }, 4000);

    } catch (error) {
        console.error("Registration error:", error);

        // Attempt to delete the auth user if it was created but a subsequent Firestore operation failed.
        const authUserWasLikelyCreated = auth.currentUser && auth.currentUser.email === normalizedEmail;
        const isFirestoreErrorAfterAuthSuccess = !error.code?.startsWith('auth/') && authUserWasLikelyCreated;

        if (isFirestoreErrorAfterAuthSuccess) {
            try {
                await auth.currentUser.delete();
                console.log("Auth user deleted due to subsequent Firestore error during registration.");
            } catch (deleteError) {
                console.warn("Failed to delete auth user after Firestore error during registration:", deleteError);
            }
        }

        // Display appropriate error messages to the user
        if (error.code === 'auth/email-already-in-use') {
            displayMessage("Email Address Already Exists!", "error");
        } else if (error.code === 'auth/weak-password') {
            displayMessage("Password is too weak.", "error");
        } else if (isFirestoreErrorAfterAuthSuccess) {
            displayMessage("Error saving user data after account creation. The process has been rolled back. Details: " + error.message, "error");
        } else {
            displayMessage("Error creating user: " + error.message, "error");
        }
        setIsLoading(false); // Ensure loading state is reset on any error.
    }
  };

  return (
    <div className={styles.loginContainer}>
      <img src={logo} alt="Logo" className={styles.enhancedLogo} />
      <h1>PEMS<span style={{ color: '#a2e089' }}>.</span></h1>
      <p>Poultry Environment Monitoring System</p>

      <div
        className={`
          ${styles.messageDiv}
          ${messageConfig.visible ? styles.show : ''}
          ${styles[messageConfig.type]}
        `}
        id="signUpMessage"
      >
        {messageConfig.text}
      </div>

      <form className="needs-validation" id="registerForm" onSubmit={handleRegister} noValidate>
        <div className="d-flex flex-column gap-3">
          <div className="input-group">
            <span className={`input-group-text ${styles.iconSpan}`}>
              <i className="bi bi-envelope"></i>
            </span>
            <input type="email" id="rEmail" className={`form-control ${styles.formControl}`} placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
          </div>

          <div className="input-group">
            <span className={`input-group-text ${styles.iconSpan}`}>
              <i className="bi bi-hash"></i> {/* Icon for Product ID / Channel ID */}
            </span>
            {/* Assuming customId is the Channel's Firestore Document ID */}
            <input type="text" id="rCustomID" className={`form-control ${styles.formControl}`} placeholder="PRODUCT ID" value={customId} onChange={(e) => setCustomId(e.target.value)} required disabled={isLoading} />
          </div>

          <div className="input-group">
            <span className={`input-group-text ${styles.iconSpan}`}>
              <i className="bi bi-lock"></i>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              id="rPassword"
              className={`form-control ${styles.formControl}`}
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <span
              className={`input-group-text ${styles.passwordToggleIcon}`}
              onClick={toggleShowPassword}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleShowPassword(); }}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
            </span>
          </div>

          <div className="input-group">
            <span className={`input-group-text ${styles.iconSpan}`}>
              <i className="bi bi-lock"></i>
            </span>
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              className={`form-control ${styles.formControl}`}
              placeholder="CONFIRM PASSWORD"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <span
              className={`input-group-text ${styles.passwordToggleIcon}`}
              onClick={toggleShowConfirmPassword}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleShowConfirmPassword(); }}
              aria-pressed={showConfirmPassword}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              <i className={`bi ${showConfirmPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
            </span>
          </div>
        </div>

        <button id="submit" type="submit" className={`btn ${styles.btnLogin} mt-4`} disabled={isLoading}>
          {isLoading ? (
            <>
              <span className={styles.spinner} role="status" aria-hidden="true"></span>
              Signing Up...
            </>
          ) : (
            'Sign Up'
          )}
        </button>

        <Link to="/login" className={`${styles.forgotPassword} mt-3 ${isLoading ? styles.disabledLink : ''}`}>Already have an Account?</Link>
      </form>
    </div>
  );
}

export default RegisterPage;