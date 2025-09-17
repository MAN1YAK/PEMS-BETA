// src/pages/GenerateReportPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/layout/Sidebar';
import styles from '../styles/GenerateReportPage.module.css';
import { getAllChannels } from '../firebase/channelService.js';
import { createPdfDocument } from '../utils/reportGenerationUtils';

// Renders the page for generating and downloading PDF reports.
const GenerateReportPage = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const [allChannels, setAllChannels] = useState([]);
  const [branchList, setBranchList] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [channelList, setChannelList] = useState([]);

  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [message, setMessage] = useState({ text: '', type: '', show: false });

  const pdfPreviewRef = useRef(null);

  const [reportTableData, setReportTableData] = useState({
    table1: { observationPeriod: 'N/A', livestockCount: 'N/A', livestockAge: 'N/A' },
    table2: { avgTemp: 'N/A', avgAmmonia: 'N/A', peakTempTime: 'N/A', peakAmmoniaTime: 'N/A' },
    analysis: {
      para1: 'Over the analyzed period, sensor data was collected. Specific trends in ammonia and temperature levels are detailed in the charts above.',
      para2: 'Average concentrations and peak times provide insights into the environmental conditions within the poultry house. Further analysis may be required to correlate these with external factors or operational changes.',
      para3: 'Continuous monitoring is recommended to ensure optimal conditions and timely intervention if parameters deviate from desired ranges.'
    }
  });

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  const showAppMessage = (text, type = 'error', duration = 3000) => {
    setMessage({ text, type, show: true });
    setTimeout(() => setMessage({ text: '', type: '', show: false }), duration);
  };

  useEffect(() => {
    const loadChannels = async () => {
      setIsLoadingChannels(true);
      try {
        const rawChannels = await getAllChannels();
        const mappedChannels = rawChannels.map(ch => ({
          channelId: ch.ID, readAPIKey: ch.ReadAPI, name: ch.Name,
          branchName: ch.branchName, firestoreId: ch.firestoreId,
          hasSensor: ch.hasSensor, ammoniaField: "field3", tempField: "field1",
        }));

        if (mappedChannels.length > 0) {
          setAllChannels(mappedChannels);
          const uniqueBranches = [...new Set(mappedChannels.map(ch => ch.branchName))].sort();
          setBranchList(uniqueBranches);
          const defaultBranch = uniqueBranches[0];
          setSelectedBranch(defaultBranch);

          const initialFilteredChannels = mappedChannels.filter(ch => ch.branchName === defaultBranch).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
          setChannelList(initialFilteredChannels);

          const firstEnabledChannel = initialFilteredChannels.find(ch => ch.hasSensor);
          setSelectedChannelId(firstEnabledChannel ? firstEnabledChannel.channelId : 'ALL');
        } else {
          showAppMessage('No poultry houses found.', 'info');
        }
      } catch (error) {
        showAppMessage(`Error fetching channels: ${error.message}`, 'error');
      }
      setIsLoadingChannels(false);
    };
    loadChannels();
  }, []);

  const handleBranchChange = (e) => {
    const newBranch = e.target.value;
    setSelectedBranch(newBranch);
    const filteredChannels = allChannels.filter(ch => ch.branchName === newBranch).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setChannelList(filteredChannels);
    const firstEnabledInBranch = filteredChannels.find(ch => ch.hasSensor);
    setSelectedChannelId(firstEnabledInBranch ? firstEnabledInBranch.channelId : 'ALL');
  };

  const getSelectedChannelInfo = () => {
    if (!allChannels || allChannels.length === 0) return null;
    const createChannelInfo = (ch) => ({
        CHANNEL_ID: ch.channelId, READ_API_KEY: ch.readAPIKey,
        COOP_NAME: ch.name, BRANCH_NAME: ch.branchName,
        ammoniaField: parseInt(String(ch.ammoniaField).replace('field', ''), 10),
        tempField: parseInt(String(ch.tempField).replace('field', ''), 10),
    });
    if (selectedChannelId === "ALL") {
      const branchChannelsWithSensors = allChannels.filter(ch => ch.branchName === selectedBranch && ch.hasSensor);
      return branchChannelsWithSensors.length > 0 ? branchChannelsWithSensors.map(createChannelInfo) : null;
    }
    const channel = allChannels.find(c => c.channelId === selectedChannelId);
    return channel && channel.hasSensor ? createChannelInfo(channel) : null;
  };

  const generatePdf = async () => {
    const currentChannelInfo = getSelectedChannelInfo();
    if (!currentChannelInfo || !selectedMonth) {
      showAppMessage('Please select a valid poultry house with a sensor and a month.', 'error');
      return null;
    }

    const year = new Date().getFullYear();
    const firstDay = new Date(year, selectedMonth - 1, 1).toLocaleDateString();
    const lastDay = new Date(year, selectedMonth, 0).toLocaleDateString();

    const currentReportTableData = { ...reportTableData, table1: { ...reportTableData.table1, observationPeriod: `${firstDay} - ${lastDay}` } };

    try {
      return await createPdfDocument(currentChannelInfo, selectedMonth, currentReportTableData);
    } catch (error) {
      showAppMessage(`Error creating PDF: ${error.message}`, 'error');
      return null;
    }
  };

  const handlePreview = async () => {
    setIsGeneratingPreview(true);
    setPdfPreviewUrl('');
    const doc = await generatePdf();
    if (doc) {
      try {
        const url = doc.output('bloburl');
        setPdfPreviewUrl(url);
        setTimeout(() => pdfPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        showAppMessage('Preview generated.', 'success');
      } catch (e) {
        showAppMessage(`Error generating preview: ${e.message}`, 'error');
      }
    }
    setIsGeneratingPreview(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    const doc = await generatePdf();
    if (doc) {
      const channelInfo = getSelectedChannelInfo();
      const monthName = monthOptions.find(m => m.value === selectedMonth)?.label || 'Report';
      const fileName = `${Array.isArray(channelInfo) ? selectedBranch : channelInfo.COOP_NAME} - ${monthName} ${new Date().getFullYear()} Report.pdf`;
      doc.save(fileName);
      showAppMessage('Report downloaded successfully!', 'success');
    }
    setIsDownloading(false);
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(0, i).toLocaleString('default', { month: 'long' }) }));

  return (
    <div className="d-flex">
      <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={toggleSidebar} />
      <main className={styles.mainContent} style={{ marginLeft: isSidebarExpanded ? '260px' : '70px' }}>
        {message.show && (<div className={`${styles.messageDiv} ${styles[message.type]} ${message.show ? styles.show : ''}`}>{message.text}</div>)}
        <div className="container-fluid py-3">
          <div className={`d-flex justify-content-between align-items-center mb-4 ${styles.pageHeader}`}><div><h3><i className="bi bi-file-earmark-text me-2"></i>Generate Reports</h3><p className={`${styles.textMuted} mb-0`}>Create and download detailed poultry environment reports</p></div></div>
          <div className={`card mb-4 my-4 p-3 bg-white rounded shadow-sm`}><div className="card-header bg-white"><h5 className="mb-0"><i className="bi bi-gear me-2"></i>Customize Report</h5></div><div className="card-body">
            {isLoadingChannels ? (<div className={styles.spinnerContainer}><div className={styles.spinner}></div></div>) : allChannels.length === 0 ? (<div className="alert alert-warning">No poultry houses available. Please add one first.</div>) : (
            <form><div className="row g-3">
                <div className="col-md-4"><label htmlFor="branchSelect" className={`form-label ${styles.formLabel}`}>Select Branch</label><select id="branchSelect" className={`form-select ${styles.formSelect}`} value={selectedBranch} onChange={handleBranchChange} disabled={isGeneratingPreview || isDownloading}>{branchList.map(branch => (<option key={branch} value={branch}>{branch}</option>))}</select></div>
                <div className="col-md-4"><label htmlFor="coopSelect" className={`form-label ${styles.formLabel}`}>Select Poultry House</label><select id="coopSelect" className={`form-select ${styles.formSelect}`} value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)} disabled={isGeneratingPreview || isDownloading || channelList.length === 0}><option value="ALL">All Houses w/ Sensor in Branch</option>{channelList.length > 0 ? (channelList.map((channel) => (<option key={channel.firestoreId} value={channel.channelId} disabled={!channel.hasSensor}>{channel.name}{!channel.hasSensor && " (No Sensor)"}</option>))) : (<option value="">No houses in this branch</option>)}</select></div>
                <div className="col-md-4"><label htmlFor="monthSelect" className={`form-label ${styles.formLabel}`}>Select Month</label><select id="monthSelect" className={`form-select ${styles.formSelect}`} value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} disabled={isGeneratingPreview || isDownloading}>{monthOptions.map(month => (<option key={month.value} value={month.value}>{month.label}</option>))}</select></div>
            </div></form>
            )}
          </div></div>
          <div className={`card mb-4 ${styles.reportCard}`}>
            <div className="card-header bg-white d-flex justify-content-between align-items-center"><h5 className="mb-0"><i className="bi bi-eye me-2"></i>Report Preview</h5><button className={`btn btn-primary ${styles.actionButton}`} onClick={handlePreview} disabled={isLoadingChannels || isGeneratingPreview || isDownloading || !selectedChannelId}>{isGeneratingPreview ? (<><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Generating...</>) : (<><i className="bi bi-magic me-2"></i>Generate Preview</>)}</button></div>
            <div className="card-body">{!pdfPreviewUrl && !isGeneratingPreview && (<div className="alert alert-info"><i className="bi bi-info-circle me-2"></i>Customize your report above and click "Generate Preview". Reports can only be generated for houses with sensors.</div>)}{isGeneratingPreview && (<div className={styles.spinnerContainer}><div className={styles.spinner}></div><p className="ms-2">Generating PDF preview, please wait...</p></div>)}{pdfPreviewUrl && (<div><h5 className="mb-2">PDF Preview</h5><iframe ref={pdfPreviewRef} src={pdfPreviewUrl} className={`${styles.pdfPreviewFrame} ${pdfPreviewUrl ? styles.expanded : ''}`} title="PDF Preview" frameBorder="0"></iframe></div>)}</div>
            {pdfPreviewUrl && (<div className={`card-footer text-end ${styles.cardFooter}`}><button className={`btn btn-success ${styles.actionButton}`} onClick={handleDownload} disabled={isDownloading || isGeneratingPreview}>{isDownloading ? (<><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Downloading...</>) : (<><i className="bi bi-file-earmark-pdf me-2"></i>Download PDF</>)}</button></div>)}
          </div>
        </div>
      </main>
    </div>
  );
};

export default GenerateReportPage;