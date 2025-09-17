// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import PrescriptiveAnalysisModal from '../components/modals/PrescriptiveAnalysisModal';
import AllAlertsModal from '../components/modals/AllAlertsModals';
import styles from '../styles/DashboardPage.module.css';
import { db } from '../firebase/firebaseConfig';
import { doc, updateDoc, arrayRemove, collection, getDocs } from 'firebase/firestore';
import { getAllChannels } from '../firebase/channelService.js';
import { fetchAllUserAlerts } from '../firebase/fetch_alerts.js';
import { fetchDeviceStatus } from '../thingspeak/fetch_status.js';
import { fetchLatestReadings } from '../thingspeak/fetch_latest.js';
import { updateDashboardVisuals, createOrClearChart } from '../utils/dashboardMiniChart.js';

// Determines status badge based on value and thresholds.
const getStatus = (value, { danger_high, danger_low, warn_high, warn_low }) => {
  if (isNaN(value) || value === null) return { badgeClass: 'bg-secondary', text: 'N/A' };
  if (value > danger_high || (danger_low && value < danger_low)) return { badgeClass: 'bg-danger', text: 'Danger' };
  if (value > warn_high || (warn_low && value < warn_low)) return { badgeClass: 'bg-warning text-dark', text: 'Warning' };
  return { badgeClass: 'bg-success', text: 'Safe' };
};

const ammoniaThresholds = { danger_high: 25, warn_high: 10 };
const tempThresholds = { danger_high: 28, danger_low: 20, warn_high: 26, warn_low: 22 };

// Renders the main dashboard for real-time monitoring.
const DashboardPage = () => {
  const navigate = useNavigate();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const [branches, setBranches] = useState([]);
  const [channels, setChannels] = useState([]);
  const [allUserAlerts, setAllUserAlerts] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  
  const [selectedBranch, setSelectedBranch] = useState('');
  const [filteredChannels, setFilteredChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedChannelDetails, setSelectedChannelDetails] = useState(null);
  const [selectedChannelStatus, setSelectedChannelStatus] = useState({ text: 'Checking...', icon: 'bi-question-circle', colorClass: 'text-muted' });
  const [currentAmmonia, setCurrentAmmonia] = useState('-- ppm');
  const [currentTemp, setCurrentTemp] = useState('-- °C');
  const [ammoniaStatus, setAmmoniaStatus] = useState({ badgeClass: 'bg-secondary', text: 'N/A' });
  const [tempStatus, setTempStatus] = useState({ badgeClass: 'bg-secondary', text: 'N/A' });
  const [performanceSummary, setPerformanceSummary] = useState({ highestAmmoniaVal: '-- ppm', highestAmmoniaTime: '--', lowestAmmoniaVal: '-- ppm', lowestAmmoniaTime: '--', highestTempVal: '-- °C', highestTempTime: '--', lowestTempVal: '-- °C', lowestTempTime: '--' });
  
  const [healthOverviewBranch, setHealthOverviewBranch] = useState('');
  const [coopHealthData, setCoopHealthData] = useState([]);
  const [isHealthDataLoading, setIsHealthDataLoading] = useState(false);
  const [healthOverviewStats, setHealthOverviewStats] = useState({ onlineCount: 0, totalCount: 0, overallHealth: 'N/A' });


  const [isLoading, setIsLoading] = useState(true);
  const [isDashboardDataLoading, setIsDashboardDataLoading] = useState(false);
  const [error, setError] = useState(null);

  const ammoniaMiniChartRef = useRef(null);
  const tempMiniChartRef = useRef(null);
  const ammoniaChartInstanceRef = useRef(null);
  const tempChartInstanceRef = useRef(null);

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isPrescriptiveModalOpen, setIsPrescriptiveModalOpen] = useState(false);
  const [prescriptiveAlertDetails, setPrescriptiveAlertDetails] = useState(null);

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  const getBadgeDetailsForAlertType = useCallback((alertType) => {
    let iconClass = 'bi-info-circle-fill', iconColorClass = 'text-secondary';
    switch (alertType?.toLowerCase()) {
      case 'temperature': iconClass = 'bi-thermometer-half'; iconColorClass = 'text-warning'; break;
      case 'ammonia': iconClass = 'bi-wind'; iconColorClass = 'text-success'; break;
      case 'both': iconClass = 'bi-exclamation-triangle-fill'; iconColorClass = 'text-danger'; break;
      default: iconClass = 'bi-info-circle-fill'; iconColorClass = 'text-info'; break;
    }
    return { iconClass, iconColorClass };
  }, []);

  const loadAlerts = useCallback(async (allChannelsData) => {
    const freshAlerts = await fetchAllUserAlerts(allChannelsData);
    setAllUserAlerts(freshAlerts);
    setRecentAlerts(freshAlerts.slice(0, 5));
  }, []);

  const updateDashboardCards = useCallback(async (channelConfig) => {
    const { ammoniaValue, tempValue, error } = await fetchLatestReadings(channelConfig);
    if (error) {
        setCurrentAmmonia("Error"); setCurrentTemp("Error");
        setAmmoniaStatus(getStatus(NaN, ammoniaThresholds));
        setTempStatus(getStatus(NaN, tempThresholds));
        return;
    }
    setCurrentAmmonia(isNaN(ammoniaValue) ? "-- ppm" : `${ammoniaValue.toFixed(1)} ppm`);
    setCurrentTemp(isNaN(tempValue) ? "-- °C" : `${tempValue.toFixed(1)} °C`);
    setAmmoniaStatus(getStatus(ammoniaValue, ammoniaThresholds));
    setTempStatus(getStatus(tempValue, tempThresholds));
  }, []);
  
  const resetDashboardVisuals = useCallback(() => {
    setCurrentAmmonia('-- ppm');
    setCurrentTemp('-- °C');
    setAmmoniaStatus({ badgeClass: 'bg-secondary', text: 'N/A' });
    setTempStatus({ badgeClass: 'bg-secondary', text: 'N/A' });
    updateDashboardVisuals({ channelConfig: null, ammoniaMiniChartRef, tempMiniChartRef, ammoniaChartInstanceRef, tempChartInstanceRef, setPerformanceSummary });
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const initialize = async () => {
      try {
        const branchDocs = await getDocs(collection(db, 'poultryHouses'));
        const branchNames = branchDocs.docs.map(doc => doc.id).sort();
        if (branchNames.length === 0) throw new Error("No branches found. Please add a branch and poultry house configuration.");
        
        setBranches(branchNames);
        setSelectedBranch(branchNames[0]);
        setHealthOverviewBranch(branchNames[0]);
        const allFetchedChannels = await getAllChannels();
        if (allFetchedChannels.length === 0) setError("No poultry houses found across all branches.");
        setChannels(allFetchedChannels);
        await loadAlerts(allFetchedChannels);
      } catch (err) {
        setError(err.message);
        createOrClearChart(ammoniaMiniChartRef, ammoniaChartInstanceRef);
        createOrClearChart(tempMiniChartRef, tempChartInstanceRef);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
    return () => { 
        ammoniaChartInstanceRef.current?.destroy(); 
        tempChartInstanceRef.current?.destroy(); 
    };
  }, [loadAlerts]);

  useEffect(() => {
    if (!selectedBranch || channels.length === 0) {
        setFilteredChannels([]);
        setSelectedChannelId('');
        return;
    }
    const channelsForBranch = channels.filter(ch => ch.branchName === selectedBranch).sort((a, b) => a.Name.localeCompare(b.Name));
    setFilteredChannels(channelsForBranch);

    const firstEnabledChannel = channelsForBranch.find(ch => ch.hasSensor);
    if (firstEnabledChannel) {
        setSelectedChannelId(firstEnabledChannel.firestoreId);
    } else if (channelsForBranch.length > 0) {
        setSelectedChannelId(channelsForBranch[0].firestoreId);
    } else {
        setSelectedChannelId('');
        setSelectedChannelDetails(null);
        resetDashboardVisuals();
    }
  }, [selectedBranch, channels, resetDashboardVisuals]);

  useEffect(() => {
    if (!selectedChannelId || !selectedBranch) return;
    const loadChannelData = async () => {
      setIsDashboardDataLoading(true);
      const channel = channels.find(ch => ch.firestoreId === selectedChannelId && ch.branchName === selectedBranch);
      if (channel) {
        setSelectedChannelDetails(channel);
        if (channel.hasSensor) {
          const [status] = await Promise.all([
            fetchDeviceStatus(channel),
            updateDashboardCards(channel),
            updateDashboardVisuals({ channelConfig: channel, ammoniaMiniChartRef, tempMiniChartRef, ammoniaChartInstanceRef, tempChartInstanceRef, setPerformanceSummary }),
          ]);
          setSelectedChannelStatus(status);
        } else {
          setSelectedChannelStatus({ text: 'No Sensor', icon: 'bi-exclamation-circle', colorClass: 'text-muted' });
          resetDashboardVisuals();
        }
      }
      setIsDashboardDataLoading(false);
    };
    loadChannelData();
  }, [selectedChannelId, selectedBranch, channels, updateDashboardCards, resetDashboardVisuals]);

  useEffect(() => {
    const populateHealthOverview = async () => {
        if (!healthOverviewBranch || channels.length === 0) {
            setCoopHealthData([]);
            setHealthOverviewStats({ onlineCount: 0, totalCount: 0, overallHealth: 'N/A' });
            return;
        }
        setIsHealthDataLoading(true);
        const coopsForTable = channels.filter(ch => ch.branchName === healthOverviewBranch);

        if (coopsForTable.length === 0) {
            setCoopHealthData([]);
            setHealthOverviewStats({ onlineCount: 0, totalCount: 0, overallHealth: 'Safe' });
            setIsHealthDataLoading(false);
            return;
        }

        const healthPromises = coopsForTable.map(async (channel) => {
            if (!channel.hasSensor) {
              return { 
                firestoreId: channel.firestoreId, name: channel.Name, branchName: channel.branchName, hasSensor: false,
                ammoniaStatus: { text: 'N/A', class: 'bg-secondary' }, 
                tempStatus: { text: 'N/A', class: 'bg-secondary' }, 
                deviceStatus: { text: 'Not Installed', class: 'bg-secondary' }
              };
            }
            const ammoniaAlerts = allUserAlerts.filter(a => a.firestoreId === channel.firestoreId && (a.type?.toLowerCase() === 'ammonia' || a.type?.toLowerCase() === 'both'));
            const tempAlerts = allUserAlerts.filter(a => a.firestoreId === channel.firestoreId && (a.type?.toLowerCase() === 'temperature' || a.type?.toLowerCase() === 'both'));
            const ammoniaStatus = ammoniaAlerts.length > 0 ? { text: 'Warning', class: 'bg-warning text-dark' } : { text: 'Safe', class: 'bg-success' };
            const tempStatus = tempAlerts.length > 0 ? { text: 'Warning', class: 'bg-warning text-dark' } : { text: 'Safe', class: 'bg-success' };
            const statusResult = await fetchDeviceStatus(channel);
            const deviceStatus = { text: statusResult.text, class: statusResult.colorClass.replace('text-', 'bg-') };
            return { firestoreId: channel.firestoreId, name: channel.Name, branchName: channel.branchName, hasSensor: true, ammoniaStatus, tempStatus, deviceStatus };
        });

        const allHealthResults = (await Promise.allSettled(healthPromises))
            .filter(r => r.status === 'fulfilled').map(r => r.value);
            
        const onlineCount = allHealthResults.filter(coop => coop.deviceStatus.text === 'Online').length;
        const totalCount = coopsForTable.length;
        const hasWarning = allHealthResults.some(coop => coop.ammoniaStatus.text === 'Warning' || coop.tempStatus.text === 'Warning');
        const overallHealth = hasWarning ? 'Warning' : 'Safe';
        setHealthOverviewStats({ onlineCount, totalCount, overallHealth });

        setCoopHealthData(allHealthResults.sort((a, b) => a.name.localeCompare(b.name)));
        setIsHealthDataLoading(false);
    };
    populateHealthOverview();
  }, [healthOverviewBranch, channels, allUserAlerts]);


  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedChannelDetails && selectedChannelDetails.hasSensor) {
        Promise.all([
          fetchDeviceStatus(selectedChannelDetails).then(setSelectedChannelStatus),
          updateDashboardCards(selectedChannelDetails),
          updateDashboardVisuals({ channelConfig: selectedChannelDetails, ammoniaMiniChartRef, tempMiniChartRef, ammoniaChartInstanceRef, tempChartInstanceRef, setPerformanceSummary })
        ]);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedChannelDetails, updateDashboardCards]);

  useEffect(() => {
    document.body.classList.toggle(styles.modalOpenBlur, isAlertModalOpen || isPrescriptiveModalOpen);
    return () => document.body.classList.remove(styles.modalOpenBlur);
  }, [isAlertModalOpen, isPrescriptiveModalOpen]);

  const handleBranchChange = e => setSelectedBranch(e.target.value);
  const handleChannelChange = e => setSelectedChannelId(e.target.value);
  const handleHealthBranchChange = e => setHealthOverviewBranch(e.target.value);
  const openPrescriptiveModal = alert => { setPrescriptiveAlertDetails(alert); setIsPrescriptiveModalOpen(true); };
  const closePrescriptiveModal = () => setIsPrescriptiveModalOpen(false);

  const handleDeleteAlert = async (alertToDelete) => {
    if (!window.confirm(`Are you sure you want to delete this alert?\n\n"${alertToDelete.message}"`)) return;
    try {
      const branchDocRef = doc(db, "poultryHouses", alertToDelete.branchName);
      await updateDoc(branchDocRef, {
        [`houses.withSensor.${alertToDelete.firestoreId}.alerts`]: arrayRemove(alertToDelete.originalAlert)
      });
      await loadAlerts(channels);
    } catch (err) {
      console.error("Error deleting alert:", err);
      alert("Failed to delete alert.");
    }
  };

  if (isLoading) {
    return (
      <div className="wrapper d-flex">
        <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={toggleSidebar} />
        <div className={styles.mainContent} style={{ marginLeft: isSidebarExpanded ? '260px' : '70px' }}>
          <div className={`container-fluid py-3 d-flex justify-content-center align-items-center vh-100`}>
            <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wrapper d-flex">
        <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={toggleSidebar} />
        <div className={styles.mainContent} style={{ marginLeft: isSidebarExpanded ? '260px' : '70px' }}>
          <div className="container-fluid py-3">
            <div className="alert alert-danger" role="alert"><h4><i className="bi bi-exclamation-triangle-fill me-2"></i>Dashboard Error</h4><p>{error}</p><button onClick={() => window.location.reload()} className="btn btn-primary">Try Again</button></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrapper d-flex">
      <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={toggleSidebar} />
      <main className={styles.mainContent} style={{ marginLeft: isSidebarExpanded ? '260px' : '70px' }}>
        <div className="container-fluid py-3">
          <div className={`d-flex align-items-center mb-4 ${styles.pageHeaderContainer}`}>
            <div className={styles.pageHeader}>
              <h3><i className="bi bi-bar-chart me-2"></i>Dashboard</h3>
              <p className={`${styles.textMuted} mb-0`}>Real-time poultry environment monitoring overview</p>
            </div>
          </div>
          <div className={`card ${styles.monitoringCard}`} style={{ marginBottom: '2.5rem' }}>
            <div className={`card-header bg-white d-flex justify-content-between align-items-center ${styles.cardHeader}`}>
              <div>
                <h5 className="mb-1"><i className="bi bi-bar-chart-fill me-2"></i>Monitor Environment</h5>
                <small className={`${styles.textMuted} mb-0`}>Track ammonia and temperature levels in a poultry house</small>
              </div>
              {isDashboardDataLoading && <div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">Loading data...</span></div>}
            </div>

            <div className="row g-3 align-items-end px-3 pt-3">
                <div className="col-md-auto">
                  <label htmlFor="branchSelect" className="form-label">Choose Branch</label>
                  <select id="branchSelect" className={`form-select w-auto ${styles.coopSelect}`} value={selectedBranch} onChange={handleBranchChange} disabled={branches.length === 0 || isLoading}>
                    {branches.length === 0 ? <option value="">No Branches Found</option> : branches.map(branchName => <option key={branchName} value={branchName}>{branchName}</option>)}
                  </select>
                </div>
                <div className="col-md-auto">
                  <label htmlFor="coopSelect" className="form-label">Select Poultry House</label>
                  <select id="coopSelect" className={`form-select w-auto ${styles.coopSelect}`} value={selectedChannelId} onChange={handleChannelChange} disabled={filteredChannels.length === 0 || isDashboardDataLoading}>
                    {filteredChannels.length === 0 
                      ? <option value="">{selectedBranch ? 'No Poultry Houses in this Branch' : 'Select a Branch First'}</option> 
                      : filteredChannels.map(channel => (
                          <option key={channel.firestoreId} value={channel.firestoreId} disabled={!channel.hasSensor}>
                              {channel.Name}{!channel.hasSensor && " (No Sensor)"}
                          </option>
                      ))
                    }
                  </select>
                </div>
                {selectedChannelId && (
                  <div className="col-md-auto">
                    <div className={`${styles.deviceStatusIndicator} ${selectedChannelStatus.colorClass}`}>
                      <i className={`bi ${selectedChannelStatus.icon} me-2`}></i>
                      <strong>{selectedChannelStatus.text}</strong>
                    </div>
                  </div>
                )}
            </div>

            <div className={`card-body ${styles.cardBody}`}>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className={`card ${styles.statusCard} ${styles.statusSafe} h-100`}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center">
                        <div><h5 className="card-title mb-1">Ammonia Levels</h5><p className={`mb-0 ${styles.readingSubtitle}`}>Normal Range: 0-20ppm</p></div>
                        <span className={`badge ${ammoniaStatus.badgeClass}`}>{ammoniaStatus.text}</span>
                      </div>
                      <h2 className={`mt-2 mb-1 ${styles.currentReading}`} id="currentAmmoniaVal">{currentAmmonia}</h2>
                      <div className={styles.miniGraph}><canvas ref={ammoniaMiniChartRef} id="ammoniaMiniChart"></canvas></div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className={`card ${styles.statusCard} ${styles.statusWarning} h-100`}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center">
                        <div><h5 className="card-title mb-1">Temperature Levels</h5><p className={`mb-0 ${styles.readingSubtitle}`}>Ideal Range: 20-28°C</p></div>
                        <span className={`badge ${tempStatus.badgeClass}`}>{tempStatus.text}</span>
                      </div>
                      <h2 className={`mt-2 mb-1 ${styles.currentReading}`} id="currentTempVal">{currentTemp}</h2>
                      <div className={styles.miniGraph}><canvas ref={tempMiniChartRef} id="tempMiniChart"></canvas></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`row g-3 ${styles.statCardRow}`}>
                <div className={`col-md-3 col-6 ${styles.statCardCol}`}><div className={`card ${styles.statCard} ${styles.statCardAmmoniaHigh}`}><div className="card-body"><i className={`bi bi-graph-up-arrow ${styles.statCardIcon}`}></i><h6 className="card-subtitle mb-2 text-muted">Today's Highest Ammonia</h6><h4 id="highestAmmoniaVal" className="card-title">{performanceSummary.highestAmmoniaVal}</h4><p id="highestAmmoniaTime" className="card-text small">{performanceSummary.highestAmmoniaTime}</p></div></div></div>
                <div className={`col-md-3 col-6 ${styles.statCardCol}`}><div className={`card ${styles.statCard} ${styles.statCardAmmoniaLow}`}><div className="card-body"><i className={`bi bi-graph-down-arrow ${styles.statCardIcon}`}></i><h6 className="card-subtitle mb-2 text-muted">Today's Lowest Ammonia</h6><h4 id="lowestAmmoniaVal" className="card-title">{performanceSummary.lowestAmmoniaVal}</h4><p id="lowestAmmoniaTime" className="card-text small">{performanceSummary.lowestAmmoniaTime}</p></div></div></div>
                <div className={`col-md-3 col-6 ${styles.statCardCol}`}><div className={`card ${styles.statCard} ${styles.statCardTempHigh}`}><div className="card-body"><i className={`bi bi-graph-up-arrow ${styles.statCardIcon}`}></i><h6 className="card-subtitle mb-2 text-muted">Today's Highest Temperature</h6><h4 id="highestTempVal" className="card-title">{performanceSummary.highestTempVal}</h4><p id="highestTempTime" className="card-text small">{performanceSummary.highestTempTime}</p></div></div></div>
                <div className={`col-md-3 col-6 ${styles.statCardCol}`}><div className={`card ${styles.statCard} ${styles.statCardTempLow}`}><div className="card-body"><i className={`bi bi-graph-down-arrow ${styles.statCardIcon}`}></i><h6 className="card-subtitle mb-2 text-muted">Today's Lowest Temperature</h6><h4 id="lowestTempVal" className="card-title">{performanceSummary.lowestTempVal}</h4><p id="lowestTempTime" className="card-text small">{performanceSummary.lowestTempTime}</p></div></div></div>
              </div>
            </div>
          </div>
          <div className={`card ${styles.alertCard}`} style={{ marginBottom: '2.5rem' }}>
            <div className={`card-header bg-white d-flex justify-content-between align-items-center ${styles.cardHeader}`}>
              <div><h5 className="mb-0"><i className="bi bi-exclamation-triangle-fill me-2"></i>Recent Alerts</h5><small className={styles.textMuted}>View 5 recent health alerts from all poultry houses</small></div>
              <button id="viewAllAlertsBtn" className="btn btn-sm btn-outline-danger" onClick={() => setIsAlertModalOpen(true)} disabled={allUserAlerts.length === 0}>View All</button>
            </div>
            <div className={`card-body ${styles.cardBody}`}>
              <div className="table-responsive">
                <table className={`table table-hover ${styles.alertsTable}`}>
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Warning</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Poultry House</th>
                      <th scope="col">Message</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAlerts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-3">No recent alerts.</td>
                      </tr>
                    ) : (
                      recentAlerts.map(alert => {
                        const { iconClass, iconColorClass } = getBadgeDetailsForAlertType(alert.type);
                        const warningType = alert.type?.toLowerCase() === 'both' 
                          ? <>Ammonia &<br />Temperature</> 
                          : <span className="text-capitalize">{alert.type}</span>;
                        return (
                          <tr key={alert.id}>
                            <td className="text-nowrap"><span className={`badge bg-danger ${styles.alertTimeBadge}`}>{alert.time}</span></td>
                            <td><div className={`d-flex align-items-center justify-content-center gap-2 ${styles.alertTypeCell}`}><i className={`${iconClass} ${iconColorClass} fs-4`}></i>{warningType}</div></td>
                            <td>{alert.branchName}</td>
                            <td>{alert.channelName}</td>
                            <td className="fw-bold">{alert.message}</td>
                            <td className="text-nowrap">
                              <button className="btn btn-sm btn-outline-primary me-2" title={`View Analysis for: ${alert.message}`} onClick={(e) => { e.stopPropagation(); openPrescriptiveModal(alert); }}><i className="bi bi-clipboard-data"></i></button>
                              <button className="btn btn-sm btn-outline-danger" title={`Delete Alert: ${alert.message}`} onClick={(e) => { e.stopPropagation(); handleDeleteAlert(alert); }}><i className="bi bi-trash"></i></button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className={`card ${styles.healthOverviewCard}`} style={{ marginBottom: '2.5rem' }}>
                <div className={`card-header bg-white d-flex justify-content-between align-items-center ${styles.cardHeader}`}>
                    <div>
                        <h5 className="mb-1"><i className="bi bi-heart-pulse-fill me-2"></i>Branch Health Overview</h5>
                        <small className={`${styles.textMuted} mb-0`}>Summary of all poultry houses' operational and health status in a branch</small>
                    </div>
                    {isHealthDataLoading && <div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">Loading...</span></div>}
                </div>
                <div className="px-3 pt-3 d-flex align-items-end gap-3 flex-wrap">
                    <div>
                        <label htmlFor="healthBranchSelect" className="form-label">Choose Branch</label>
                        <select id="healthBranchSelect" className={`form-select w-auto ${styles.coopSelect}`} value={healthOverviewBranch} onChange={handleHealthBranchChange} disabled={branches.length === 0}>
                            {branches.map(branchName => <option key={branchName} value={branchName}>{branchName}</option>)}
                        </select>
                    </div>
                    {!isHealthDataLoading && healthOverviewStats.totalCount > 0 && (
                        <div className="d-flex align-items-center gap-2">
                            <div className={`${styles.deviceStatusIndicator} ${
                                healthOverviewStats.onlineCount === healthOverviewStats.totalCount
                                    ? 'text-success' : healthOverviewStats.onlineCount > 0
                                    ? 'text-warning' : 'text-danger'
                            }`}>
                                <i className="bi bi-hdd-stack-fill me-2"></i>
                                <strong>{healthOverviewStats.onlineCount}/{healthOverviewStats.totalCount} Online</strong>
                            </div>
                            <div className={`${styles.deviceStatusIndicator} ${healthOverviewStats.overallHealth === 'Safe' ? 'text-success' : 'text-warning'}`}>
                                <i className={`bi ${healthOverviewStats.overallHealth === 'Safe' ? 'bi-shield-check' : 'bi-shield-exclamation'} me-2`}></i>
                                <strong>{healthOverviewStats.overallHealth}</strong>
                            </div>
                        </div>
                    )}
                </div>
                <div className={`card-body ${styles.cardBody}`}>
                  <div className="table-responsive">
                    <table className={`table table-hover ${styles.coopStatusTable}`}>
                      <thead>
                        <tr>
                            <th>Poultry House</th>
                            <th>Sensor</th>
                            <th>Ammonia</th>
                            <th>Temperature</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isHealthDataLoading ? (
                            <tr><td colSpan="4" className="text-center text-muted py-3"><div className="spinner-border spinner-border-sm me-2" role="status"></div>Loading health overview...</td></tr>
                        ) : coopHealthData.length === 0 ? (
                            <tr><td colSpan="4" className="text-center text-muted py-3">No poultry houses to display for this branch.</td></tr>
                        ) : (
                            coopHealthData.map(coop => {
                                const isActive = coop.firestoreId === selectedChannelId && coop.branchName === selectedBranch;
                                const isClickable = coop.hasSensor;
                                const rowClass = `${isClickable ? styles.clickableCoopRow : styles.nonClickableCoopRow} ${isActive ? styles.activeCoopRow : ''}`;
                                
                                let rowTitle = `Switch to ${coop.name}`;
                                if (isActive) rowTitle = `Currently monitoring ${coop.name}`;
                                if (!isClickable) rowTitle = `Cannot monitor: No sensor installed`;
                                
                                return (
                                    <tr 
                                        key={coop.firestoreId} 
                                        onClick={() => {
                                            if (isClickable) {
                                                setSelectedBranch(coop.branchName); 
                                                setSelectedChannelId(coop.firestoreId);
                                                window.scrollTo({ top: 0, behavior: 'smooth' }); 
                                            }
                                        }} 
                                        className={rowClass} 
                                        title={rowTitle}
                                    >
                                        <td>{coop.name}</td>
                                        <td><span className={`badge ${coop.deviceStatus.class}`}>{coop.deviceStatus.text}</span></td>
                                        <td><span className={`badge ${coop.ammoniaStatus.class}`}>{coop.ammoniaStatus.text}</span></td>
                                        <td><span className={`badge ${coop.tempStatus.class}`}>{coop.tempStatus.text}</span></td>
                                    </tr>
                                );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <AllAlertsModal
        show={isAlertModalOpen}
        onHide={() => setIsAlertModalOpen(false)}
        alerts={allUserAlerts}
        onDelete={handleDeleteAlert}
        onAlertClick={openPrescriptiveModal}
        getBadgeDetailsForAlertType={getBadgeDetailsForAlertType}
      />

      <PrescriptiveAnalysisModal 
        show={isPrescriptiveModalOpen} 
        onHide={closePrescriptiveModal} 
        alert={prescriptiveAlertDetails} 
      />
    </div>
  );
};

export default DashboardPage;