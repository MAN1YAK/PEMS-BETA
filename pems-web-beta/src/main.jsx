// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from "./firebase/authContext";
import './index.css' // This is a global CSS file provided by Vite; you can add global styles here....

// Apply saved UI size from localStorage on initial load.
const savedUiSize = localStorage.getItem('uiSize');
if (savedUiSize) {
  document.documentElement.style.fontSize = `${savedUiSize}%`;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)