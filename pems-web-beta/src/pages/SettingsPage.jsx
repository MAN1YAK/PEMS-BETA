// src/pages/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import styles from '../styles/SettingsPage.module.css';

// Renders the settings page for UI and account customization.
const SettingsPage = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [uiSize, setUiSize] = useState(localStorage.getItem('uiSize') || 100);

  // This effect runs on mount and whenever uiSize changes.
  useEffect(() => {
    document.documentElement.style.fontSize = `${uiSize}%`;
    localStorage.setItem('uiSize', uiSize);
  }, [uiSize]);

  const handleUiSizeChange = (e) => setUiSize(e.target.value);
  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  return (
    <div className="d-flex">
      <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={toggleSidebar} />
      <main className={styles.mainContent} style={{ marginLeft: isSidebarExpanded ? '260px' : '70px' }}>
        <div className="container-fluid py-3">
          <div className={`d-flex justify-content-between align-items-center mb-4 ${styles.pageHeader}`}>
            <div>
              <h3><i className="bi bi-gear-fill me-2"></i>Settings</h3>
              <p className={`${styles.textMuted} mb-0`}>Customize your application preferences</p>
            </div>
          </div>

          <div className={`card mb-4 my-4 p-3 bg-white rounded shadow-sm`}>
            <div className="card-header bg-white"><h5 className="mb-0"><i className="bi bi-palette-fill me-2"></i>Appearance</h5></div>
            <div className="card-body">
              <div className={styles.settingItem}>
                <label htmlFor="uiSizeSlider" className={`form-label ${styles.formLabel}`}>Overall UI Size: <strong>{uiSize}%</strong></label>
                <div className={styles.sliderContainer}>
                  <span>50%</span>
                  <input type="range" className="form-range" id="uiSizeSlider" min="50" max="150" step="5" value={uiSize} onChange={handleUiSizeChange} />
                  <span>150%</span>
                </div>
                <small className="form-text text-muted">Adjusts text and element sizes. (Default: 100%)</small>
              </div>
            </div>
          </div>
          
          <div className={`card mb-4 p-3 bg-white rounded shadow-sm`}>
            <div className="card-header bg-white"><h5 className="mb-0"><i className="bi bi-rulers me-2"></i>Units</h5></div>
            <div className="card-body">
              <div className={styles.settingItem}>
                <label className={`form-label ${styles.formLabel}`}>Temperature Unit</label>
                <div className="d-flex gap-3">
                  <div className="form-check">
                    <input className="form-check-input" type="radio" name="tempUnit" id="celsius" value="C" defaultChecked />
                    <label className="form-check-label" htmlFor="celsius">Celsius (°C)</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" name="tempUnit" id="fahrenheit" value="F" disabled />
                    <label className="form-check-label" htmlFor="fahrenheit">Fahrenheit (°F) <span className="badge bg-secondary">Soon</span></label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`card mb-4 p-3 bg-white rounded shadow-sm`}>
            <div className="card-header bg-white"><h5 className="mb-0"><i className="bi bi-person-circle me-2"></i>Account</h5></div>
            <div className="card-body">
              <div className="mb-3">
                <label className={`form-label ${styles.formLabel}`}>Change Password</label>
                <button className="btn btn-outline-secondary" disabled>Change Password</button>
              </div>
              <div>
                <label className={`form-label ${styles.formLabel}`}>Change Email</label>
                <button className="btn btn-outline-secondary" disabled>Change Email Address</button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default SettingsPage;