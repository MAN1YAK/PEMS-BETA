// src/firebase/resetPassword.js
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { app } from "./firebaseConfig"; // your config

const auth = getAuth(app);

/**
 * Sends a password reset email.
 * @param {string} email
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, message: "Password reset email sent!" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}