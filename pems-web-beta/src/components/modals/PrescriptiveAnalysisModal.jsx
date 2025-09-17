// src/components/modals/PrescriptiveAnalysisModal.jsx
import React, { useEffect, useRef } from 'react';
// Ensure Bootstrap's JS is available, e.g., globally or via import { Modal } from 'bootstrap';
// Assuming window.bootstrap.Modal is available as per DashboardPage.jsx
// If not, you'd import: import { Modal as BsModal } from 'bootstrap';

const PrescriptiveAnalysisModal = ({ show, onHide, alert }) => {
  const modalRef = useRef();
  const bsModalInstance = useRef(null);

  useEffect(() => {
    if (!modalRef.current || !window.bootstrap || !window.bootstrap.Modal) return;

    // Initialize Bootstrap modal instance
    if (!bsModalInstance.current) {
        bsModalInstance.current = new window.bootstrap.Modal(modalRef.current, {
            // backdrop: 'static', // uncomment if you don't want click outside to close
            keyboard: true
        });
    }
    
    // Handle modal hidden event (e.g., ESC key or backdrop click)
    const handleModalHidden = () => {
      // Sync React state if Bootstrap closed it and React still thinks it's open.
      if (show) {
        onHide();
      }
    };

    const currentModalElement = modalRef.current;
    currentModalElement.addEventListener('hidden.bs.modal', handleModalHidden);

    // Cleanup
    return () => {
      currentModalElement.removeEventListener('hidden.bs.modal', handleModalHidden);
      // Dispose Bootstrap modal instance only when component unmounts
      // This is typically handled in a separate effect with empty dependency array
      // or if the modal element itself is being removed.
      // For now, assuming it's disposed if `show` becomes false and then true again,
      // which might recreate the instance if not careful.
      // A more robust approach is to dispose only on component unmount.
    };
  }, [show, onHide]); // Re-attach listener if onHide changes, or if show changes (though less critical for listener)

  // Effect to control modal visibility based on React state
  useEffect(() => {
    if (bsModalInstance.current) {
      if (show) {
        bsModalInstance.current.show();
      } else {
        bsModalInstance.current.hide();
      }
    }
  }, [show]);

  // Effect for disposing Bootstrap modal instance on component unmount
  useEffect(() => {
    return () => {
      if (bsModalInstance.current) {
        bsModalInstance.current.dispose();
        bsModalInstance.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  if (!alert) return null;

  let modalTitle = "Alert Analysis";
  const adviceList = [];
  const alertTypeLower = alert.type?.toLowerCase();
  const alertMessageLower = alert.message?.toLowerCase() || "";

  const addRecommendation = (text, isHeading = false, isSubHeading = false) => {
    adviceList.push({ text, isHeading, isSubHeading });
  };
  
  const addPoint = (boldPart, regularPart) => {
    adviceList.push({ type: 'point', boldPart, regularPart });
  };

  // Temperature Advice
  if (alertTypeLower === 'temperature' || (alertTypeLower === 'both' && alertMessageLower.includes('temperature'))) {
    modalTitle = "High Temperature Alert Analysis";
    addRecommendation("High temperatures can cause significant stress to poultry. Ideal temperatures vary by bird age (e.g., chicks need ~32-35°C, older birds ~21-25°C). Your system detected high temperature.", false, true);
    addRecommendation("Recommendations:", true);
    addPoint("Ventilation", "Ensure all fans are operational and set to appropriate speeds. Open vents or curtains to maximize airflow.");
    addPoint("Cool Water", "Provide access to plenty of cool, fresh drinking water. Consider adding ice to waterers in extreme heat.");
    addPoint("Reduce Density", "If possible, reduce bird density to lower metabolic heat production.");
    addPoint("Misting/Fogging", "If available, use misting or fogging systems to cool the air through evaporation.");
    addPoint("Monitor Birds", "Observe for signs of heat stress: panting, lethargy, spreading wings, reduced feed intake. Seek veterinary advice if severe.");
    addPoint("Check Setpoints", "Verify that your thermostat and controller setpoints are correct for the age of your flock.");
  }

  // Ammonia Advice
  if (alertTypeLower === 'ammonia' || (alertTypeLower === 'both' && alertMessageLower.includes('ammonia'))) {
    if (adviceList.length > 0) { // Already has temperature advice
        modalTitle = "High Temperature & Ammonia Alert Analysis";
        addRecommendation("---", false); // Separator
        addRecommendation("Additionally, for High Ammonia:", false, true);
    } else {
        modalTitle = "High Ammonia Alert Analysis";
        addRecommendation("High ammonia levels are detrimental to poultry health, affecting respiratory systems and growth. Ideal levels are below 15-20 PPM. Your system detected high ammonia.", false, true);
    }
    addRecommendation("Recommendations:", true);
    addPoint("Increase Ventilation", "Immediately increase ventilation rates. Good airflow helps remove ammonia.");
    addPoint("Litter Management", "Inspect litter for wet spots, especially around drinkers and feeders. Remove caked or overly wet litter promptly.");
    addPoint("Drinker Check", "Ensure drinkers are not leaking, as excess moisture contributes to ammonia production.");
    addPoint("Litter Amendments", "Consider using a litter treatment product (e.g., acidifiers) to help neutralize ammonia. Follow product instructions carefully.");
    addPoint("Bird Density", "Overcrowding can exacerbate ammonia issues. Ensure appropriate stocking density.");
  }

  // Fallback for other alert types
  if (adviceList.length === 0 && alertTypeLower === 'info') {
    modalTitle = "Information";
    addRecommendation(alert.message);
  } else if (adviceList.length === 0) {
    modalTitle = "General Alert Details";
    addRecommendation("No specific prescriptive analysis for this alert type, but here's the information:", false, true);
    addRecommendation(`Alert: ${alert.message}`);
  }
  
  const getIconForType = (type) => {
    switch(type?.toLowerCase()) {
        case 'temperature': return 'bi-thermometer-half';
        case 'ammonia': return 'bi-wind';
        case 'both': return 'bi-exclamation-triangle-fill';
        default: return 'bi-info-circle-fill';
    }
  }

  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1" aria-labelledby="prescriptiveModalLabel" aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="prescriptiveModalLabel">
              <i className={`bi ${getIconForType(alertTypeLower)} me-2`}></i>
              {modalTitle}
            </h5>
            <button type="button" className="btn-close" onClick={onHide} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <p><strong>Poultry House:</strong> {alert.channelName}</p>
            <p><strong>Alert Time:</strong> {alert.time}</p>
            <p><strong>Original Message:</strong> <span className="fst-italic">{alert.message}</span></p>
            <hr />
            {adviceList.map((item, index) => {
              if (item.text === "---") return <hr key={index} className="my-3" />;
              if (item.isHeading) return <h6 style={{paddingBottom: '1rem', paddingTop: '1rem'}} key={index} className="mt-3 mb-2 fw-bold"><u>{item.text}</u></h6>;
              if (item.isSubHeading) return <p key={index} className="text-muted">{item.text}</p>;
              if (item.type === 'point') {
                return (
                  <p key={index} className="mb-2">
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    <strong>{item.boldPart}:</strong> {item.regularPart}
                  </p>
                );
              }
              return <p key={index} className="mb-2">{item.text}</p>;
            })}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptiveAnalysisModal;