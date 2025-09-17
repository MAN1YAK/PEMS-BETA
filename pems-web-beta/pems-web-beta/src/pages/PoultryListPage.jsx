// src/pages/PoultryListPage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ChannelModal from '../components/modals/ChannelModal';
import NotificationModal from '../components/modals/NotificationModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import ChannelDetailsModal from '../components/modals/ChannelDetailsModal';
import BranchModal from '../components/modals/BranchModal';
import styles from '../styles/PoultryListPage.module.css';
import {
  getAllChannels,
  createThingSpeakChannel,
  saveNewChannelWithSensorToFirestore,
  saveNewChannelWithoutSensorToFirestore,
  addSensorToExistingHouse,
  updateChannelInFirestore,
  deleteChannelFromFirestoreAndThingSpeak,
  updateThingSpeakChannel,
  clearChannelDataInThingSpeakAndFirestore,
  removeSensorFromHouse,
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from '../firebase/channelService';

const ADMIN_THINGSPEAK_API_KEY_STORAGE_KEY = "JG3C4IQDQ5O7HIW8";

// Manages the list of all poultry houses, including add, edit, and delete functionality.
const PoultryListPage = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [channels, setChannels] = useState([]);
  const [branchList, setBranchList] = useState([]);
  const [branchDetailsList, setBranchDetailsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  const [activeFilters, setActiveFilters] = useState({ branch: 'All', sensor: 'All', ammonia: 'All', temperature: 'All' });
  const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [currentChannelForModal, setCurrentChannelForModal] = useState(null);
  const [notification, setNotification] = useState({ isOpen: false, message: '', type: 'info', title: '' });
  const [confirmationState, setConfirmationState] = useState({ isOpen: false, title: '', message: '', onConfirmAction: null, isProcessing: false });
  const [adminThingSpeakApiKey, setAdminThingSpeakApiKey] = useState('');
  const mainContentRef = useRef(null);

  useEffect(() => {
    const storedApiKey = localStorage.getItem(ADMIN_THINGSPEAK_API_KEY_STORAGE_KEY) || "JG3C4IQDQ5O7HIW8";
    setAdminThingSpeakApiKey(storedApiKey);
  }, []);

  const getThingSpeakFieldLastValue = useCallback(async (channelId, readAPIKey, field) => {
    try {
      const response = await fetch(`https://api.thingspeak.com/channels/${channelId}/fields/${field}/last.json?api_key=${readAPIKey}`);
      if (!response.ok) return { value: null, text: response.status === 404 ? "No Data" : "Error" };
      const data = await response.json();
      const value = data?.[`field${field}`] ?? null;
      return { value, text: value === null ? "No Data" : value };
    } catch (error) {
      return { value: null, text: "Error" };
    }
  }, []);

  const getDeviceStatusBadge = (statusValueStr, hasSensor) => {
    if (!hasSensor) return <span className="badge bg-secondary">Not Installed</span>;
    if (statusValueStr === "1") return <span className="badge bg-success">Online</span>;
    if (statusValueStr === "0") return <span className="badge bg-danger">Offline</span>;
    return <span className="badge bg-secondary">No Data</span>;
  };

  const getRawEnvironmentalStatus = (channel, type) => {
    if (!channel.hasSensor) return 'N/A';
    const hasWarning = (channel["~Alerts"] || []).some(
      (alert) => alert.warning?.toLowerCase() === type || alert.warning?.toLowerCase() === 'both'
    );
    return hasWarning ? 'Warning' : 'Safe';
  };

  const getEnvironmentalStatusBadge = (status) => {
    if (status === 'Warning') return <span className="badge bg-warning text-dark">Warning</span>;
    if (status === 'Safe') return <span className="badge bg-success">Safe</span>;
    return <span className="badge bg-secondary">N/A</span>;
  };

  const processChannelWithStatus = useCallback(async (channel) => {
    if (!channel.hasSensor) {
      return { ...channel, rawDeviceStatus: 'Not Installed', rawAmmoniaStatus: 'N/A', rawTemperatureStatus: 'N/A', deviceStatusBadge: getDeviceStatusBadge(null, false), ammoniaStatusBadge: getEnvironmentalStatusBadge('N/A'), temperatureStatusBadge: getEnvironmentalStatusBadge('N/A') };
    }
    const { value: deviceStatusStr } = await getThingSpeakFieldLastValue(channel.ID, channel.ReadAPI, "4");
    const rawAmmoniaStatus = getRawEnvironmentalStatus(channel, 'ammonia');
    const rawTemperatureStatus = getRawEnvironmentalStatus(channel, 'temperature');
    return { ...channel, rawDeviceStatus: deviceStatusStr, rawAmmoniaStatus, rawTemperatureStatus, deviceStatusBadge: getDeviceStatusBadge(deviceStatusStr, true), ammoniaStatusBadge: getEnvironmentalStatusBadge(rawAmmoniaStatus), temperatureStatusBadge: getEnvironmentalStatusBadge(rawTemperatureStatus) };
  }, [getThingSpeakFieldLastValue]);
  
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [baseChannels, branches] = await Promise.all([getAllChannels(), getBranches()]);
      const processedChannels = await Promise.all(baseChannels.map(channel => processChannelWithStatus(channel)));
      const uniqueBranches = branches.map(b => b.name).sort();
      setBranchList(uniqueBranches);
      setBranchDetailsList(branches);
      setChannels(processedChannels);
    } catch (err) {
      setError("Failed to load poultry houses or branches. " + err.message);
      setChannels([]);
    } finally {
      setIsLoading(false);
    }
  }, [processChannelWithStatus]);

  useEffect(() => { fetchAllData() }, [fetchAllData]);

  useEffect(() => {
    const pageBlur = isAddEditModalOpen || notification.isOpen || confirmationState.isOpen || isDetailsModalOpen || isBranchModalOpen;
    mainContentRef.current?.classList.toggle(styles.pageBlurred, pageBlur);
  }, [isAddEditModalOpen, notification.isOpen, confirmationState.isOpen, isDetailsModalOpen, isBranchModalOpen]);

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);
  const handleCloseNotification = () => setNotification({ isOpen: false, message: '', type: 'info', title: '' });
  const handleCloseConfirmation = () => setConfirmationState({ isOpen: false, title: '', message: '', onConfirmAction: null, isProcessing: false });
  const handleCloseAllModals = () => { setAddEditModalOpen(false); setDetailsModalOpen(false); setIsBranchModalOpen(false); setCurrentChannelForModal(null); };

  const requestConfirmation = (title, message, onConfirmCallback, confirmButtonText = 'Confirm', confirmButtonType = 'primary') => {
    setConfirmationState({
      isOpen: true, title, message, onConfirmAction: async () => {
        setConfirmationState(prev => ({ ...prev, isProcessing: true }));
        try { await onConfirmCallback() } catch (error) { setNotification({ isOpen: true, title: "Action Failed", message: error.message, type: "error" }) } finally { setConfirmationState({ isOpen: false, isProcessing: false }) }
      }, confirmButtonText, confirmButtonType, isProcessing: false,
    });
  };

  const handleOpenAddModal = () => { setCurrentChannelForModal(null); setAddEditModalOpen(true) };
  const handleOpenEditModal = (channel) => { setCurrentChannelForModal(channel); setAddEditModalOpen(true) };
  const handleOpenDetailsModal = (channel) => { setCurrentChannelForModal(channel); setDetailsModalOpen(true) };
  const handleOpenBranchModal = () => setIsBranchModalOpen(true);

  const handleRequestRemoveSensor = (channel) => {
    handleCloseAllModals();
    requestConfirmation('Confirm Sensor Removal', `Are you sure you want to remove the sensor from "${channel.Name}"? This permanently deletes its ThingSpeak channel and all associated data.`, async () => {
      setIsLoading(true);
      await removeSensorFromHouse(channel, adminThingSpeakApiKey);
      setNotification({ isOpen: true, message: 'Sensor removed successfully.', type: 'success', title: 'Success' });
      fetchAllData();
    }, 'Remove Permanently', 'danger');
  };
  
  const handleRequestDeleteBranch = (branchName) => {
    handleCloseAllModals();
    requestConfirmation('Confirm Branch Deletion', `Are you sure you want to PERMANENTLY DELETE the branch "${branchName}"? This action is only possible if the branch has no houses.`, async () => {
      setIsLoading(true);
      await deleteBranch(branchName);
      setNotification({ isOpen: true, message: `Branch "${branchName}" deleted successfully.`, type: 'success', title: 'Deletion Successful' });
      fetchAllData();
    }, 'Delete Permanently', 'danger');
  };

  const createThingSpeakDescription = (branchName, alertThreshold) => {
    const { tempHigh = 'N/A', tempLow = 'N/A', ammoniaHigh = 'N/A' } = alertThreshold || {};
    return `Branch: ${branchName}\nAlert Temp Threshold: High=${tempHigh}, Low=${tempLow}\nAlert Ammonia Threshold: High=${ammoniaHigh}`;
  };

  const handleSubmitChannelForm = async (formData, isEditMode) => {
    try {
      if (isEditMode) {
        const originalChannel = currentChannelForModal;
        if (!originalChannel.hasSensor && formData.addSensor) {
          await addSensorToExistingHouse(originalChannel, adminThingSpeakApiKey, formData.alertThreshold);
          setNotification({ isOpen: true, message: `Sensor successfully added to "${originalChannel.Name}".`, type: "success", title: "Upgrade Successful" });
        } else if (originalChannel.hasSensor) {
          const { branchName, firestoreId: oldName, ID: thingSpeakId } = originalChannel;
          const { Name: newName, alertThreshold } = formData;
          const description = createThingSpeakDescription(branchName, alertThreshold);
          await updateThingSpeakChannel(adminThingSpeakApiKey, thingSpeakId, newName, description);
          await updateChannelInFirestore(branchName, oldName, newName, true, alertThreshold);
          setNotification({ isOpen: true, message: `Settings for "${newName}" updated successfully.`, type: "success", title: "Update Successful" });
        } else {
          await updateChannelInFirestore(originalChannel.branchName, originalChannel.firestoreId, formData.Name, false, null);
          setNotification({ isOpen: true, message: `House name updated successfully.`, type: "success", title: "Update Successful" });
        }
      } else {
        const { channelName, branchName, hasSensor, alertThreshold } = formData;
        if (hasSensor) {
          if (!adminThingSpeakApiKey || adminThingSpeakApiKey === "YOUR_ADMIN_THINGSPEAK_USER_API_KEY") throw new Error("Admin ThingSpeak API Key is not configured.");
          const description = createThingSpeakDescription(branchName, alertThreshold);
          const thingSpeakResponse = await createThingSpeakChannel(adminThingSpeakApiKey, channelName, description);
          await saveNewChannelWithSensorToFirestore(thingSpeakResponse, branchName, alertThreshold);
          setNotification({ isOpen: true, message: `House "${channelName}" with sensor created in branch "${branchName}"!`, type: "success", title: "House Created" });
        } else {
          await saveNewChannelWithoutSensorToFirestore(channelName, branchName);
          setNotification({ isOpen: true, message: `House "${channelName}" (no sensor) created in branch "${branchName}"!`, type: "success", title: "House Created" });
        }
      }
      fetchAllData();
      handleCloseAllModals();
    } catch (err) { throw err }
  };

  const handleSubmitBranchForm = async (formData, isEditMode, oldBranchName) => {
    try {
      if (isEditMode) {
        await updateBranch(oldBranchName, formData.name, formData.key);
        setNotification({ isOpen: true, message: `Branch "${oldBranchName}" updated successfully.`, type: "success", title: "Update Successful" });
      } else {
        await createBranch(formData.name, formData.key);
        setNotification({ isOpen: true, message: `Branch "${formData.name}" created successfully.`, type: "success", title: "Branch Created" });
      }
      fetchAllData();
      handleCloseAllModals();
    } catch (err) { throw err }
  };

  const handleDeleteChannel = (channel) => {
    requestConfirmation('Confirm Deletion', `Are you sure you want to PERMANENTLY DELETE "${channel.Name}" from branch "${channel.branchName}"? This action cannot be undone.`, async () => {
      setIsLoading(true);
      await deleteChannelFromFirestoreAndThingSpeak(channel.branchName, channel.firestoreId, adminThingSpeakApiKey);
      setNotification({ isOpen: true, message: 'Channel deleted successfully.', type: "success", title: "Deletion Successful" });
      fetchAllData();
    }, 'Delete Permanently', 'danger');
  };
  
  const handleClearChannelData = (channel) => {
    requestConfirmation('Confirm Clear Data', `Are you sure you want to clear all sensor data for "${channel.Name}"? This action cannot be undone.`, async () => {
      setIsLoading(true);
      await clearChannelDataInThingSpeakAndFirestore(channel, adminThingSpeakApiKey);
      setNotification({ isOpen: true, message: 'Channel data cleared successfully.', type: "success", title: "Data Cleared" });
      fetchAllData();
    }, 'Clear Data', 'warning');
  };

  const { totalHouses, onlineSensors, ammoniaWarnings, tempWarnings } = useMemo(() => channels.reduce((acc, channel) => {
    if (channel.hasSensor) {
      acc.totalHouses++;
      if (channel.rawDeviceStatus === "1") acc.onlineSensors++;
      if (channel.rawAmmoniaStatus === 'Warning') acc.ammoniaWarnings++;
      if (channel.rawTemperatureStatus === 'Warning') acc.tempWarnings++;
    }
    return acc;
  }, { totalHouses: 0, onlineSensors: 0, ammoniaWarnings: 0, tempWarnings: 0 }), [channels]);

  const handleFilterChange = (filterType, value) => setActiveFilters(prev => ({ ...prev, [filterType]: value }));

  const filteredChannels = useMemo(() => {
    const safeSearchTerm = (searchTerm || '').toLowerCase();
    return channels.filter(channel => {
      const branchMatch = activeFilters.branch === 'All' || channel.branchName === activeFilters.branch;
      const sensorStatus = channel.rawDeviceStatus === "1" ? 'Online' : channel.rawDeviceStatus === "0" ? 'Offline' : channel.rawDeviceStatus === 'Not Installed' ? 'Not Installed' : 'No Data';
      const sensorMatch = activeFilters.sensor === 'All' || activeFilters.sensor === sensorStatus;
      const ammoniaMatch = activeFilters.ammonia === 'All' || channel.rawAmmoniaStatus === activeFilters.ammonia;
      const tempMatch = activeFilters.temperature === 'All' || channel.rawTemperatureStatus === activeFilters.temperature;
      if (!(branchMatch && sensorMatch && ammoniaMatch && tempMatch)) return false;
      if (!safeSearchTerm) return true;
      return [channel.Name, channel.ID?.toString(), channel.firestoreId, channel.branchName].some(field => field?.toLowerCase().includes(safeSearchTerm));
    });
  }, [channels, searchTerm, activeFilters]);
  
  const renderTableBody = () => {
    if (isLoading) return <tr><td colSpan="7" className="text-center">Loading poultry houses...</td></tr>;
    if (error) return <tr><td colSpan="7" className="text-center text-danger">{error}</td></tr>;
    if (filteredChannels.length === 0) return <tr><td colSpan="7" className="text-center">{searchTerm || Object.values(activeFilters).some(v => v !== 'All') ? "No houses found matching criteria." : "No poultry houses found."}</td></tr>;
    return filteredChannels.map((channel, index) => (
      <tr key={channel.firestoreId}>
        <td>{index + 1}</td>
        <td>{channel.Name || 'N/A'}</td>
        <td>{channel.branchName}</td>
        <td>{channel.deviceStatusBadge}</td>
        <td>{channel.ammoniaStatusBadge}</td>
        <td>{channel.temperatureStatusBadge}</td>
        <td className="text-nowrap">
          <button className="btn btn-sm btn-outline-dark me-2" title="View Details" onClick={() => handleOpenDetailsModal(channel)}><i className="bi bi-info-circle"></i></button>
          <button className="btn btn-sm btn-outline-primary me-2" title="Settings" onClick={() => handleOpenEditModal(channel)}><i className="bi bi-gear"></i></button>
          {channel.hasSensor && (
            <button className={`btn btn-sm btn-outline-warning me-2 ${styles.btnDarkOrange}`} title="Clear All Data" onClick={() => handleClearChannelData(channel)}><i className="bi bi-eraser"></i></button>
          )}
          <button className="btn btn-sm btn-outline-danger" title="Delete House" onClick={() => handleDeleteChannel(channel)}><i className="bi bi-trash"></i></button>
        </td>
      </tr>
    ));
  };

  return (
    <div className={styles.wrapper}>
      <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={toggleSidebar} />
      <main ref={mainContentRef} className={styles.mainContent} style={{ marginLeft: isSidebarExpanded ? '260px' : '70px' }}>
        <div className="container-fluid py-3">
          <div className={`d-flex justify-content-between align-items-center mb-3 ${styles.pageHeaderContainer}`}>
            <div className={styles.pageHeader}><h1><i className="bi bi-houses me-2"></i>Poultry Houses</h1><p className={`${styles.textMuted} mb-0`}>View, add, or edit all poultry house from all branches</p></div>
          </div>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3"><div className={styles.statCard}><div className={`${styles.statIcon} ${styles.iconBgPrimary}`}><i className="bi bi-houses"></i></div><div className={styles.statContent}><span className={styles.statValue}>{channels.length}</span><span className={styles.statLabel}>Total Houses</span></div></div></div>
            <div className="col-sm-6 col-lg-3"><div className={styles.statCard}><div className={`${styles.statIcon} ${styles.iconBgSuccess}`}><i className="bi bi-broadcast-pin"></i></div><div className={styles.statContent}><span className={styles.statValue}>{onlineSensors}/{totalHouses}</span><span className={styles.statLabel}>Sensors Online</span></div></div></div>
            <div className="col-sm-6 col-lg-3"><div className={`${styles.statCard} ${ammoniaWarnings > 0 ? styles.cardWarning : styles.cardSafe}`}><div className={`${styles.statIcon} ${ammoniaWarnings > 0 ? styles.iconBgWarning : styles.iconBgSuccess}`}><i className="bi bi-wind"></i></div><div className={styles.statContent}><span className={styles.statValue}>{ammoniaWarnings > 0 ? ammoniaWarnings : 'Safe'}</span><span className={styles.statLabel}>Ammonia Warnings</span></div></div></div>
            <div className="col-sm-6 col-lg-3"><div className={`${styles.statCard} ${tempWarnings > 0 ? styles.cardWarning : styles.cardSafe}`}><div className={`${styles.statIcon} ${tempWarnings > 0 ? styles.iconBgWarning : styles.iconBgSuccess}`}><i className="bi bi-thermometer-half"></i></div><div className={styles.statContent}><span className={styles.statValue}>{tempWarnings > 0 ? tempWarnings : 'Safe'}</span><span className={styles.statLabel}>Temperature Warnings</span></div></div></div>
          </div>
          {(!adminThingSpeakApiKey || adminThingSpeakApiKey === "YOUR_ADMIN_THINGSPEAK_USER_API_KEY") && (<div className="alert alert-warning mt-3" role="alert"><strong>Admin ThingSpeak API Key is not configured!</strong> Operations involving sensors will fail.</div>)}
          <div className={`${styles.controlsHeader} d-flex justify-content-between align-items-center my-4 p-3 bg-white rounded shadow-sm`}>
             <div className={styles.searchContainer}><i className={`bi bi-search ${styles.searchIcon}`}></i><input type="text" className={`form-control ${styles.searchInput}`} placeholder="Search by Name, Branch, ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <div className="d-flex gap-2 align-items-center">
                <button className={`btn btn-primary ${styles.quickActionBtn}`} onClick={handleOpenBranchModal} disabled={isLoading}><i className="bi bi-diagram-3"></i> Manage Branches</button>
                <button className={`btn btn-primary ${styles.quickActionBtn}`} onClick={handleOpenAddModal} disabled={isLoading}><i className="bi bi-plus-lg"></i> Add House</button>
                {isLoading && <div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">Loading...</span></div>}
            </div>
          </div>
          <div className={styles.filterContainer}>
            <div className={styles.filterGroup}><span className={styles.filterLabel}>Branch:</span><select className={styles.filterDropdown} value={activeFilters.branch} onChange={(e) => handleFilterChange('branch', e.target.value)} disabled={isLoading}><option value="All">All Branches</option>{branchList.map(branchName => (<option key={branchName} value={branchName}>{branchName}</option>))}</select></div>
            <div className={styles.filterGroup}><span className={styles.filterLabel}>Sensor:</span><button className={`${styles.filterButton} ${activeFilters.sensor === 'All' ? styles.active : ''}`} onClick={() => handleFilterChange('sensor', 'All')}>All</button><button className={`${styles.filterButton} ${activeFilters.sensor === 'Online' ? styles.active : ''}`} onClick={() => handleFilterChange('sensor', 'Online')}>Online</button><button className={`${styles.filterButton} ${activeFilters.sensor === 'Offline' ? styles.active : ''}`} onClick={() => handleFilterChange('sensor', 'Offline')}>Offline</button><button className={`${styles.filterButton} ${activeFilters.sensor === 'Not Installed' ? styles.active : ''}`} onClick={() => handleFilterChange('sensor', 'Not Installed')}>Not Installed</button></div>
            <div className={styles.filterGroup}><span className={styles.filterLabel}>Ammonia:</span><button className={`${styles.filterButton} ${activeFilters.ammonia === 'All' ? styles.active : ''}`} onClick={() => handleFilterChange('ammonia', 'All')}>All</button><button className={`${styles.filterButton} ${activeFilters.ammonia === 'Warning' ? styles.active : ''}`} onClick={() => handleFilterChange('ammonia', 'Warning')}>Warning</button></div>
            <div className={styles.filterGroup}><span className={styles.filterLabel}>Temperature:</span><button className={`${styles.filterButton} ${activeFilters.temperature === 'All' ? styles.active : ''}`} onClick={() => handleFilterChange('temperature', 'All')}>All</button><button className={`${styles.filterButton} ${activeFilters.temperature === 'Warning' ? styles.active : ''}`} onClick={() => handleFilterChange('temperature', 'Warning')}>Warning</button></div>
          </div>
          <div className={`${styles.tableWrapper} bg-white p-3 rounded shadow-sm`}>
            <div className={styles.tableResponsive}><table className={`table table-hover align-middle ${styles.channelTable}`}><thead className="table-light"><tr><th>#</th><th>Name</th><th>Branch</th><th>Sensor</th><th>Ammonia</th><th>Temperature</th><th>Actions</th></tr></thead><tbody>{renderTableBody()}</tbody></table></div>
          </div>
        </div>
      </main>
      <ChannelModal isOpen={isAddEditModalOpen} onClose={handleCloseAllModals} onSubmit={handleSubmitChannelForm} onRemoveSensor={handleRequestRemoveSensor} currentChannel={currentChannelForModal} branchList={branchList} />
      <BranchModal isOpen={isBranchModalOpen} onClose={handleCloseAllModals} onSubmit={handleSubmitBranchForm} onDelete={handleRequestDeleteBranch} branches={branchDetailsList} />
      <ChannelDetailsModal isOpen={isDetailsModalOpen} onClose={handleCloseAllModals} channel={currentChannelForModal} />
      <NotificationModal isOpen={notification.isOpen} onClose={handleCloseNotification} title={notification.title} message={notification.message} type={notification.type} />
      <ConfirmationModal isOpen={confirmationState.isOpen} onClose={handleCloseConfirmation} onConfirm={confirmationState.onConfirmAction} title={confirmationState.title} message={confirmationState.message} confirmText={confirmationState.confirmButtonText} confirmButtonType={confirmationState.confirmButtonType} isProcessing={confirmationState.isProcessing} />
    </div>
  );
};

export default PoultryListPage;