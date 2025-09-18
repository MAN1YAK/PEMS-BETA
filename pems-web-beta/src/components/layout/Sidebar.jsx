// src/components/layout/Sidebar.jsx
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { auth } from '../../firebase/firebaseConfig';

// Renders the main navigation sidebar for the application.
const Sidebar = ({ isExpanded, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      // Selectively remove login data instead of clearing everything.
      localStorage.removeItem('loggedInUserEmail'); 
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

    /* Google Drive URLs cannot reliably be pre-checked from a serverless function without using the official Google Drive API
       Test again when Link is changed to github instead
    const handleExternalLink = async (url) => {
      try {
        const response = await fetch(`/api/checkLink?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.ok) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else {
          alert("The link is broken (404).");
        }
      } catch (error) {
        console.error("Error checking link:", error);
        alert("Failed to check the link. Please try again later.");
      }
    };
    */
 

  const isActive = (path) => location.pathname === path;

  return (
    <aside id="sidebar" className={`${styles.sidebar} ${isExpanded ? styles.expand : ''}`}>
      <div className="d-flex mt-2">
        <button className={styles.toggleBtn} type="button" onClick={toggleSidebar}>
          <i className="bi bi-grid-fill"></i>
        </button>
        <div className={styles.sidebarLogo}>
          <Link to="/dashboard">PEMS<span style={{ color: '#a2e089' }}>.</span></Link>
        </div>
      </div>
      <ul className={styles.sidebarNav}>
        <li className={`${styles.sidebarItem} ${isActive('/dashboard') ? styles.active : ''}`}>
          <Link to="/dashboard" className={styles.sidebarLink}>
            <i className="bi bi-house-door-fill"></i><span>Dashboard</span>
          </Link>
        </li>
        <li className={`${styles.sidebarItem} ${isActive('/analytics') ? styles.active : ''}`}>
          <Link to="/analytics" className={styles.sidebarLink}>
            <i className="bi bi-activity"></i><span>Analytics</span>
          </Link>
        </li>
        <li className={`${styles.sidebarItem} ${isActive('/workers') ? styles.active : ''}`}>
          <Link to="/workers" className={styles.sidebarLink}>
            <i className="bi bi-people-fill"></i><span>Workers</span>
          </Link>
        </li>
        <li className={`${styles.sidebarItem} ${isActive('/poultry-list') ? styles.active : ''}`}>
          <Link to="/poultry-list" className={styles.sidebarLink}>
            <i className="bi bi-houses-fill"></i><span>Poultry Houses</span>
          </Link>
        </li>
         <li className={`${styles.sidebarItem} ${isActive('/generate-report') ? styles.active : ''}`}>
          <Link to="/generate-report" className={styles.sidebarLink}>
            <i className="bi bi-pen-fill"></i><span>Generate Reports</span>
          </Link>
        </li>
        <li className={`${styles.sidebarItem} ${styles.utilitySectionStart}`}>
          <a href="https://drive.google.com/uc?export=download&id=1h3yHmfR0RReGBxn3yEvDB_eTFn_dfTzJ" className={styles.sidebarLink} target="_blank" rel="noopener noreferrer">
            <i className="bi bi-phone-fill"></i><span>Download App</span>
          </a>
        </li>
        <li className={`${styles.sidebarItem} ${isActive('/settings') ? styles.active : ''}`}>
          <Link to="/settings" className={styles.sidebarLink}>
            <i className="bi bi-gear-fill"></i><span>Settings</span>
          </Link>
        </li>
      </ul>
      <div className={styles.sidebarFooter}>
        <button onClick={handleLogout} className={styles.logoutButton}>
          <i className="bi bi-box-arrow-left"></i><span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;