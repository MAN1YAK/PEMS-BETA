// src/components/modals/AllAlertsModals.jsx
import React, { useState, useEffect, useRef } from 'react';
import styles from './AllAlertsModals.module.css';

const AllAlertsModal = ({ show, onHide, alerts, onDelete, onAlertClick, getBadgeDetailsForAlertType }) => {
  const modalRef = useRef(null);
  const bsModalInstance = useRef(null);
  const ALERTS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // --- CONSOLIDATED USEEFFECT FOR MODAL MANAGEMENT ---
  // This single effect handles creating, showing, hiding, and listening for events.
  // This is the modern, correct way to integrate Bootstrap JS with React.
  useEffect(() => {
    // Guard clause: If the ref isn't attached to the DOM element yet, do nothing.
    if (!modalRef.current) return;

    // Use Bootstrap's static method to safely get or create an instance.
    // This is the key to fixing the race condition and avoids creating new instances on every render.
    const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalRef.current);
    bsModalInstance.current = modalInstance;

    // The event listener for when the modal is closed by Bootstrap (e.g., clicking 'x', backdrop, or ESC key).
    // This is crucial for synchronizing React's state with the modal's actual state.
    const handleHidden = () => {
      onHide();
    };
    const modalEl = modalRef.current;
    modalEl.addEventListener('hidden.bs.modal', handleHidden);

    // Control the modal's visibility based on the `show` prop from the parent component.
    if (show) {
      // Reset to the first page every time the modal is shown.
      setCurrentPage(1);
      modalInstance.show();
    } else {
      // Check if modal is already hidden before calling hide, to prevent Bootstrap errors
      // Although `modalInstance.hide()` is generally safe to call even if hidden.
      modalInstance.hide();
    }

    // Cleanup function for this effect. It runs before the effect runs again,
    // or when the component unmounts. We only need to remove the event listener here.
    return () => {
      modalEl.removeEventListener('hidden.bs.modal', handleHidden);
    };
  }, [show, onHide]); // Re-run the effect if `show` or `onHide` props change.


  // --- DEDICATED CLEANUP FOR FINAL DISPOSAL ---
  // This effect runs ONLY when the component unmounts.
  useEffect(() => {
    // The return function from an effect with an empty dependency array `[]`
    // is the perfect place for a one-time cleanup, like disposing of the modal instance.
    return () => {
      if (bsModalInstance.current) {
        bsModalInstance.current.dispose();
        bsModalInstance.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount (to register cleanup) and unmount.


  // Recalculate pagination if the number of alerts changes (e.g., an alert is deleted while modal is open)
  const totalPages = Math.ceil(alerts.length / ALERTS_PER_PAGE) || 1;
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [alerts, currentPage, totalPages]);

  const startIndex = (currentPage - 1) * ALERTS_PER_PAGE;
  const currentAlerts = alerts.slice(startIndex, startIndex + ALERTS_PER_PAGE);

  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  return (
    // The `onClick={onHide}` on the btn-close is still good practice as a direct command
    <div className="modal fade" id="allAlertsModal" tabIndex="-1" aria-labelledby="allAlertsModalLabel" aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="allAlertsModalLabel"><i className="bi bi-bell-fill me-2"></i>All Alerts</h5>
            <button type="button" className="btn-close" onClick={onHide} aria-label="Close"></button>
          </div>
          <div className="modal-body" style={{ padding: '0' }}>
            <div id="allAlertsContainer" className="list-group list-group-flush">
              {currentAlerts.length === 0 ? <p className="text-center text-muted p-3">No alerts found.</p> :
                currentAlerts.map(alert => {
                  const { iconClass, iconColorClass } = getBadgeDetailsForAlertType(alert.type);
                  return (
                    <div key={alert.id} className={`list-group-item d-flex justify-content-between align-items-center ${styles.listGroupItem} ${styles.clickableListGroupItem}`} onClick={() => onAlertClick(alert)} title={`Click for analysis: ${alert.message}`}>
                      <div className="d-flex align-items-center flex-grow-1" style={{ minWidth: 0 }}>
                        <i className={`${iconClass} ${iconColorClass} mx-3 fs-4 flex-shrink-0`}></i>
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <small className="text-muted d-block text-truncate" title={`${alert.branchName} / ${alert.channelName} • ${alert.time}`}>{alert.branchName} / <u className="text-muted">{alert.channelName}</u> • {alert.time}</small>
                          <span className={`mb-0 d-block text-truncate ${styles.alertMessage}`}>{alert.message}</span>
                        </div>
                      </div>
                      <div className="d-flex align-items-center flex-shrink-0 ms-2">
                        <button className="btn btn-sm btn-outline-danger" title={`Delete Alert: ${alert.message}`} onClick={(e) => { e.stopPropagation(); onDelete(alert); }}><i className="bi bi-trash"></i></button>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
          <div className="modal-footer d-flex justify-content-between">
            <span>{alerts.length > 0 ? `Page ${currentPage} of ${totalPages}` : 'No alerts'}</span>
            <div>
              <button type="button" className="btn btn-outline-secondary me-2" onClick={handlePrevPage} disabled={currentPage === 1 || alerts.length === 0}>Previous</button>
              <button type="button" className="btn btn-outline-primary" onClick={handleNextPage} disabled={currentPage === totalPages || alerts.length === 0}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllAlertsModal;