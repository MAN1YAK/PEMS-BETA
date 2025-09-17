// src/pages/AnalyticsPage.jsx
import React, { useState, useEffect, useRef, act } from 'react';
import Sidebar from '../components/layout/Sidebar';
import styles from '../styles/AnalyticsPage.module.css';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, scales } from 'chart.js';
import { getAllChannels } from '../firebase/channelService.js';
import { fetchThingSpeakData , getMonthlyData } from '../thingspeak/fetch_chartdata.js';
import { getAnnualMinMaxData } from '../thingspeak/fetch_tabledata.js';
import { fetchHourlyPattern, fetchMonthlyHourlyPattern } from '../thingspeak/fetch_bardata.js';
import { NoDataResponse } from '../components/utils/noDataFallBack.jsx';
import { format } from 'date-fns';


ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CURRENT_YEAR = new Date().getFullYear();
const chartTitleMap = { daily: "Daily Poultry House Report", weekly: "Weekly Report", insights: "Monthly Report" };

// Renders analytics charts and data tables.
const AnalyticsPage = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const [allChannels, setAllChannels] = useState([]);
  const [branchList, setBranchList] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [filteredChannels, setFilteredChannels] = useState([]);

  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState('ammonia');
  const [activeTab, setActiveTab] = useState('daily');

  const [ammoniaLineData, setAmmoniaLineData] = useState({labels: [], datasets: [],});
  const [tempLineData, setTempLineData] = useState({labels: [], datasets: [],});
  const [annualSummaryData, setAnnualSummaryData] = useState([]);
  const [hourlyBarData, setHourlyBarData] = useState(null);
  const [hourlyRawData, setHourlyRawData] = useState(null);

  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [isLoadingHourlyBar, setIsLoadingHourlyBar] = useState(false);
  const [hourlyBarError, setHourlyBarError] = useState(null);

  const [chartsReportTitleText, setChartsReportTitleText] = useState("Loading Charts...");
  const [hourlyBarTitleText, setHourlyBarTitleText] = useState("Loading Chart...");
  const [tableReportTitleText, setTableReportTitleText] = useState("Loading Table...");

  const [hasAmmonia, setHasAmmonia] = useState(false);
  const [hasTemp, setHasTemp] = useState(false);
  const [ammoniaYAxisMax, setAmmoniaYAxisMax] = useState(20);


  const abortControllerRef = useRef(null);
  const tableAbortControllerRef = useRef(null);
  const prevChannelIdRef = useRef(null);
  

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = monthNames[new Date().getMonth()];
  const getNumDaysByTab = (tab) => ({ daily: 1, weekly: 7, insights: 30 }[tab] || 1)

  const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { autoSkip: true, maxTicksLimit: 6 } },
    y: { beginAtZero: true, ticks: { maxTicksLimit: 5 } },
    },
  };

  useEffect(() => {
    const loadChannelsAndBranches = async () => {
      setIsLoadingChannels(true);
      try {
        const rawChannels = await getAllChannels();
        const channels = rawChannels.map(ch => ({
            channelId: ch.ID, readAPIKey: ch.ReadAPI, name: ch.Name,
            hasSensor: ch.hasSensor, ammoniaField: "field3", tempField: "field1",
            firestoreId: ch.firestoreId, branchName: ch.branchName,
        }));

        if (channels.length > 0) {
          setAllChannels(channels);
          const uniqueBranches = [...new Set(channels.map(c => c.branchName))].sort();
          setBranchList(uniqueBranches);
          setSelectedBranch(uniqueBranches[0]);
        }
      } catch (error) {
        console.error("Error fetching channel list:", error);
      }
      setIsLoadingChannels(false);
    };
    loadChannelsAndBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      const channelsInBranch = allChannels
        .filter(c => c.branchName === selectedBranch)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFilteredChannels(channelsInBranch);
      
      const firstEnabledChannel = channelsInBranch.find(ch => ch.hasSensor);
      setSelectedChannelId(firstEnabledChannel ? firstEnabledChannel.channelId : '');
    } else {
      setFilteredChannels([]);
      setSelectedChannelId('');
    }
  }, [selectedBranch, allChannels]);

  useEffect(() => {
    setSelectedChannel(allChannels.find(c => c.channelId === selectedChannelId) || null);
  }, [selectedChannelId, allChannels]);

    useEffect(() => {
      if (selectedChannel) {
        // Cancel any previous requests
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const { channelId, readAPIKey, name: coopName, ammoniaField: afStr, tempField: tfStr } = selectedChannel;

        setIsLoadingCharts(true);
        setChartsReportTitleText("Loading Charts...");

        const ammoniaFieldNum = parseInt(afStr?.replace("field", ""), 10);
        const tempFieldNum = parseInt(tfStr?.replace("field", ""), 10);

        let ammoniaPromise, tempPromise;
        if (activeTab === "insights") {
          const now = new Date();
          const [currentYear, currentMonth] = [now.getFullYear(), now.getMonth() + 1];
          ammoniaPromise = getMonthlyData(channelId, readAPIKey, ammoniaFieldNum, currentMonth, currentYear);
          tempPromise = getMonthlyData(channelId, readAPIKey, tempFieldNum, currentMonth, currentYear);
        } else {
          const days = getNumDaysByTab(activeTab);
          ammoniaPromise = fetchThingSpeakData(channelId, readAPIKey, ammoniaFieldNum, days);
          tempPromise = fetchThingSpeakData(channelId, readAPIKey, tempFieldNum, days);
        }

        Promise.all([ammoniaPromise, tempPromise])
          .then(([ammoniaPoints, tempPoints]) => {
            if (signal.aborted) return;

            const _hasAmmonia = Array.isArray(ammoniaPoints) && ammoniaPoints.length > 0;
            const _hasTemp = Array.isArray(tempPoints) && tempPoints.length > 0;
           
                // compute max for ammonia chart
            const ammoniaValues = _hasAmmonia ? ammoniaPoints.map(p => p.value) : [0];
            const maxY = Math.max(...ammoniaValues);
            const yAxisMax = maxY <= 1 ? 1 : 30; 
            setAmmoniaYAxisMax(yAxisMax);


            const sourcePoints = _hasAmmonia ? ammoniaPoints : tempPoints;

            const labels = sourcePoints.map(p => {
              const date = new Date(p.created_at);
              if (activeTab === "daily") {
                return format(date, "HH:mm");        
              } else if (activeTab === "weekly") {
                return format(date, "EEE");  
              } else if (activeTab === "insights") {
                return format(date, "MMM dd");        
              } else {
                return format(date, "MMM dd HH:mm");  
              }
            });

            setAmmoniaLineData({
              labels,
              datasets: [
                {
                  data: _hasAmmonia ? ammoniaPoints.map(p => p.value) : [null],
                  borderColor: "rgba(0, 128, 0, 1)",
                  backgroundColor: "rgba(0, 128, 0, 0.5)",
                  fill: true,
                  tension: 0.3,
                  pointRadius: 2,
                },
              ],
            });
            setHasAmmonia(_hasAmmonia);

            setTempLineData({
              labels,
              datasets: [
                {
                  data: _hasTemp ? tempPoints.map(p => p.value) : [null],
                  borderColor: "rgba(255, 149, 0, 1)",
                  backgroundColor: "rgba(255, 149, 0, 0.5)",
                  fill: true,
                  tension: 0.3,
                  pointRadius: 2,
                },
              ],
            });
            setHasTemp(_hasTemp);

            // ✅ Clear loading only after data is set
            setChartsReportTitleText(`${chartTitleMap[activeTab] || "Report"} - ${coopName}`);
            setIsLoadingCharts(false);
          })
          .catch(err => {
            if (err.name !== "AbortError") {
              console.error("Error fetching chart data:", err);
              setChartsReportTitleText("Error loading chart data");
              setHasAmmonia(false);
              setHasTemp(false);
            }
            setIsLoadingCharts(false);
          });

        // Load table data only if channel changed
        if (prevChannelIdRef.current !== channelId) {
          tableAbortControllerRef.current?.abort();
          tableAbortControllerRef.current = new AbortController();
          const tableSignal = tableAbortControllerRef.current.signal;

          setIsLoadingTable(true);
          setTableReportTitleText("Loading Table...");

          if (isNaN(ammoniaFieldNum) || isNaN(tempFieldNum)) {
            console.error("Invalid field configuration for selected channel:", selectedChannel);
            setAnnualSummaryData([]);
            setTableReportTitleText(`Error: Invalid field configuration for ${coopName}`);
            setIsLoadingTable(false);
          } else {
            getAnnualMinMaxData(
              selectedChannel.branchName,
              selectedChannel.firestoreId,
              CURRENT_YEAR,
              channelId,
              readAPIKey,
              ammoniaFieldNum,
              tempFieldNum,
              tableSignal
            )
              .then(data => {
                if (!tableSignal.aborted) {
                  setAnnualSummaryData(data);
                  setTableReportTitleText(`Annual Report - ${coopName}`);
                }
              })
              .catch(error => {
                if (error.name !== "AbortError") {
                  console.error("Error fetching annual min/max table:", error);
                  setAnnualSummaryData([]);
                  setTableReportTitleText(`Error loading table data for ${coopName}`);
                }
              })
              .finally(() => {
                if (!tableSignal.aborted) setIsLoadingTable(false);
              });
          }
        }

        return () => {
          abortControllerRef.current?.abort();
        };
      } else {
        setAnnualSummaryData([]);
        if (!isLoadingChannels) {
          setChartsReportTitleText("Select a Poultry House");
          setTableReportTitleText("Select a Poultry House to view Annual Report");
        } else {
          setChartsReportTitleText("Loading Poultry Houses...");
          setTableReportTitleText("Loading Poultry Houses...");
        }
      }
    }, [selectedChannel, activeTab, isLoadingChannels]);

  useEffect(() => {
    
    if (!selectedChannel) {
      setHourlyBarData(null); setHourlyRawData(null); setIsLoadingHourlyBar(false);
      setHourlyBarError(null); setHourlyBarTitleText('Select a Poultry House to view Hourly Data');
      return;
    }
    
    const abortController = new AbortController();
    const { signal } = abortController;
    const { channelId, name: coopName, readAPIKey, ammoniaField, tempField } = selectedChannel;
    const ammoniaFieldNum = parseInt(ammoniaField?.replace('field', ''), 10);
    const tempFieldNum = parseInt(tempField?.replace('field', ''), 10);

    console.log("prev:", prevChannelIdRef.current, "new:", channelId);

   if (prevChannelIdRef.current !== channelId) {
    setIsLoadingHourlyBar(true); setHourlyBarTitleText("Loading Chart..."); setHourlyBarError(null); }

  prevChannelIdRef.current = channelId;

    if (isNaN(ammoniaFieldNum) || isNaN(tempFieldNum)) {
      setHourlyBarError('Invalid field configuration.'); setIsLoadingHourlyBar(false); setHourlyBarTitleText('Invalid field configuration');
      return;
    }

  const now = new Date();
  const [currentYear, currentMonth] = [now.getFullYear(), now.getMonth() + 1];
  const title = `Hourly Pattern for ${monthNames[currentMonth - 1]} - ${coopName}`;

  const ammoniaPromise = fetchMonthlyHourlyPattern(
    channelId, readAPIKey,
    ammoniaFieldNum,
    currentYear, currentMonth
  );
  const tempPromise = fetchMonthlyHourlyPattern(
    channelId, readAPIKey,
    tempFieldNum,
    currentYear, currentMonth
  );

  Promise.all([ammoniaPromise, tempPromise])
    .then(([ammoniaData, tempData]) => {
      if (signal.aborted) return;
      setHourlyRawData({ ammonia: ammoniaData, temperature: tempData });
      setHourlyBarTitleText(title);

      
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        setHourlyBarError("Failed to load hourly data.");
        setHourlyBarTitleText("Failed to load hourly data");
      }
    })
    .finally(() => {
      if (!signal.aborted) setIsLoadingHourlyBar(false);
    });
  return () => abortController.abort();
}, [selectedChannel]);

  useEffect(() => {
    if (!hourlyRawData) {
      setHourlyBarData(null);
      return;
    }
    const labels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ":00");
    const isAmmonia = selectedSensor === 'ammonia';
    const selectedData = isAmmonia ? hourlyRawData.ammonia : hourlyRawData.temperature;
    const dataPoints = labels.map(label => selectedData[label] ?? null);
    setHourlyBarData({
      labels,
      datasets: [{
        label: isAmmonia ? 'Average Ammonia (ppm)' : 'Average Temperature (°C)',
        backgroundColor: isAmmonia ? 'rgba(0, 128, 0, 0.6)' : 'rgba(255, 149, 0, 0.6)',
        borderColor: isAmmonia ? 'rgba(0, 128, 0, 1)' : 'rgba(255, 149, 0, 1)',
        borderWidth: 1, data: dataPoints,
      }],
    });

  }, [hourlyRawData, selectedSensor]);

  /* store hourly data to firestore
  useEffect(() => {
    if (!selectedChannel || !hourlyRawData || activeTab !== 'insights') return;
    const dateKey = new Date().toISOString().split("T")[0];
    saveFetchedDataToFirestore(selectedChannel.branchName, selectedChannel.firestoreId, dateKey, hourlyRawData); Saving Data To Firestore
  }, [selectedChannel, hourlyRawData, activeTab]);
  */

  const cellStyle = (value) => !value ? { fontStyle: 'italic', opacity: 0.6 } : {};

  
  

  return (
    <div className="d-flex">
      <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={toggleSidebar} />
      <main className={styles.mainContent} style={{ marginLeft: isSidebarExpanded ? '260px' : '70px' }}>
        {isLoadingChannels ? (
          <div className="container-fluid py-3 text-center"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Loading Branches and Poultry Houses...</p></div>
        ) : (
          <div className="container-fluid py-3">
            <div className={`d-flex justify-content-between align-items-center mb-4 ${styles.pageHeaderContainer}`}>
              <div className={styles.pageHeader}><h3><i className="bi bi-activity me-2"></i>Analytics</h3><p className={`${styles.textMuted} mb-0`}>Detailed data analysis and trends for poultry houses</p></div>
            </div>

            {branchList.length > 0 ? (
              <div className="d-flex align-items-end gap-3 mb-4 my-4 p-3 bg-white rounded shadow-sm">
                <div><label htmlFor="branchSelect" className="form-label fw-bold">Select Branch</label><select id="branchSelect" className={`form-select w-auto ${styles.coopSelect}`} value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} disabled={isLoadingChannels}>{branchList.map(branch => (<option key={branch} value={branch}>{branch}</option>))}</select></div>
                <div><label htmlFor="coopSelect" className="form-label fw-bold">Select Poultry House</label><select id="coopSelect" className={`form-select w-auto ${styles.coopSelect}`} value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)} disabled={isLoadingCharts || isLoadingTable || !selectedBranch || filteredChannels.length === 0}>
                    {filteredChannels.length > 0 ? (
                      filteredChannels.map(channel => (
                        <option key={channel.firestoreId} value={channel.channelId} disabled={!channel.hasSensor}>
                          {channel.name}{!channel.hasSensor && " (No Sensor)"}
                        </option>
                      ))
                    ) : (<option value="" disabled>No houses in this branch</option>)}
                  </select></div>
              </div>
            ) : (<div className="alert alert-warning">No poultry houses available. Please add one via the Poultry Houses page.</div>)}

            {selectedChannel ? (
              <><div className={`${styles.tableWrapper} bg-white p-3 rounded shadow-sm`}><div className="card-header bg-white"><h5 className="mb-0"><i className="bi bi-calendar-event me-2"></i>Select Analytics Timeframe</h5></div><div className="card-body mt-3">
                <ul className="nav nav-pills mb-4" id="reportTypeTab" role="tablist">
                  <li className="nav-item" role="presentation"><button className={`nav-link ${activeTab === 'daily' ? 'active' : ''}`} onClick={() => setActiveTab('daily')} disabled={isLoadingCharts}><i className="bi bi-calendar-day me-1"></i> Last 24 Hours</button></li>
                  <li className="nav-item" role="presentation"><button className={`nav-link ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')} disabled={isLoadingCharts}><i className="bi bi-calendar-week me-1"></i> Last 7 Days</button></li>
                  <li className="nav-item" role="presentation"><button className={`nav-link ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => setActiveTab('insights')} disabled={isLoadingCharts}><i className="bi bi-calendar-month me-1"></i> Current Month</button></li>
                </ul>
                
                <div className="tab-content" id="reportTypeTabContent">
                      <div className={`tab-pane fade show active`} role="tabpanel">
                        <div className={`card mb-3 ${styles.reportCard}`}>
                          <div className="card-body">
                            <h5 className={styles.chartsReportTitle}>
                              {isLoadingCharts ? (
                                <span
                                  className="spinner-border spinner-border-sm text-primary me-2"
                                  role="status"
                                  aria-hidden="true"
                                ></span>
                              ) : (
                                <i className="bi bi-graph-up me-2"></i>
                              )}
                              {chartsReportTitleText}
                            </h5>

                          <div className={styles.chartsRow}>
                            {/* Ammonia Chart */}
                            <div className={styles.chartWrapper}>
                              <h6 className={styles.chartTitle}>Ammonia Data Chart</h6>
                              <div className={styles.chartContainer}>
                                {isLoadingCharts ? (
                                  <p className="text-center p-5">
                                    <span className="spinner-border spinner-border-sm"></span> Loading...
                                  </p>
                                ) : !hasAmmonia ? (
                                  <div className='p-5'>
                                  <NoDataResponse message="No Ammonia Data Available" />
                                  </div>
                                ) : (
                                   <Line data={ammoniaLineData} options={{...chartOptions, scales:{y:{min:0, max:ammoniaYAxisMax, ticks:{maxTicksLimit:6}}, x:{ticks:{maxTicksLimit:6}}}}} />
                                )}
                              </div>
                            </div>

                              <div className={styles.chartWrapper}>
                                <h6 className={styles.chartTitle}>Temperature Data Chart</h6>
                                <div className={styles.temperatureChartContainer}>
                                  {isLoadingCharts ? (
                                    <p className="text-center p-5">
                                      <span className="spinner-border spinner-border-sm"></span> Loading...
                                    </p>
                                   ) : !hasTemp ? (
                                  <div className='p-5'>
                                  <NoDataResponse message="No Temperature Data Available" />
                                  </div>
                                  ) : (
                                   <Line data={tempLineData} options={{...chartOptions}} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                <div id="barChartContainer"><div className={`card mb-4 ${styles.reportCard}`}><div className="card-body">
                  <h5 className={`${styles.chartsReportTitle} d-flex justify-content-between align-items-center`}>
                    <div>
                      {isLoadingHourlyBar ? (<span className="spinner-border spinner-border-sm text-primary me-2 " role="status" aria-hidden="true"></span>) : (<i className="bi bi-bar-chart-line me-2"></i>)}
                      {hourlyBarTitleText}
                    </div>
                    <div className="btn-group btn-group-sm" role="group" aria-label="Sensor toggle">
                      <button type="button" className="btn" style={{ backgroundColor: selectedSensor === "ammonia" ? "#28a745" : "transparent", color: selectedSensor === "ammonia" ? "#fff" : "#28a745", border: `1px solid #28a745` }} onClick={() => setSelectedSensor("ammonia")}>Ammonia</button>
                      <button type="button" className="btn" style={{ backgroundColor: selectedSensor === "temperature" ? "#ffc107" : "transparent", color: selectedSensor === "temperature" ? "#000" : "#ffc107", border: `1px solid #ffc107` }} onClick={() => setSelectedSensor("temperature")}>Temperature</button>
                    </div>
                  </h5>
                  {isLoadingHourlyBar ? (<div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>) : hourlyBarError ? (<div className="alert alert-danger">{hourlyBarError}</div>) : hourlyBarData && hourlyBarData.datasets[0]?.data.some(v => v !== null && v !== 0) ? (
                    <div style={{ height: '400px' }}>
                    <Bar data={hourlyBarData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, min: selectedSensor === 'ammonia' ? 0 : 10, max: selectedSensor === 'ammonia' ? 30 : 40, title: { display: true, text: selectedSensor === 'ammonia' ? 'Ammonia (ppm)' : 'Temperature (°C)' } }, x: { title: { display: true, text: 'Hour of Day' } } }, plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false } } }} /></div>) 
                    : <div style={{ height: '200px', display: "flex", justifyContent: "center", alignItems: 'center' }}> <NoDataResponse message={ selectedSensor === "ammonia"  ? "No Ammonia Data Available" : "No Temperature Data Available" }/>  </div>}
                </div></div></div>
                <div id="annualTableContainer"><div className={`card mb-3 ${styles.reportCard} ${styles.annualCard}`}><div className="card-body"><h5 className={styles.tableReportTitle}>{isLoadingTable ? (<span className="spinner-border spinner-border-sm text-primary me-2" role="status" aria-hidden="true"></span>) : (<i className="bi bi-calendar-event me-2"></i>)}{tableReportTitleText}</h5>{(!isLoadingTable || annualSummaryData.length > 0) && (<div className={`table-responsive ${styles.tableResponsive}`}><table className={`table table-hover ${styles.annualTable}`}><thead><tr><th rowSpan="2" className={styles.monthHeader}>Month</th><th colSpan="3" className={styles.mainParameterHeader}>Ammonia (ppm)</th><th colSpan="3" className={styles.mainParameterHeader}>Temperature (°C)</th></tr><tr><th className={styles.subParameterHeader}>High</th><th className={styles.subParameterHeader}>Low</th><th className={styles.subParameterHeader}>Avg</th><th className={styles.subParameterHeader}>High</th><th className={styles.subParameterHeader}>Low</th><th className={styles.subParameterHeader}>Avg</th></tr></thead><tbody>
                  {!isLoadingTable && annualSummaryData.length > 0 ? (annualSummaryData.map((row, index) => (
                    <tr key={index} className={row.month === currentMonthName ? styles.currentMonthRow : ''}>
                      <td>{row.month}</td>
                      <td style={cellStyle(row.ammoniaMax)}>{row.ammoniaMax || 'No Data'}</td>
                      <td style={cellStyle(row.ammoniaMin)}>{row.ammoniaMin || 'No Data'}</td>
                      <td style={cellStyle(row.ammoniaAvg)}>{row.ammoniaAvg || 'No Data'}</td>
                      <td style={cellStyle(row.tempMax)}>{row.tempMax || 'No Data'}</td>
                      <td style={cellStyle(row.tempMin)}>{row.tempMin || 'No Data'}</td>
                      <td style={cellStyle(row.tempAvg)}>{row.tempAvg || 'No Data'}</td>
                    </tr>
                  ))) : !isLoadingTable && selectedChannel ? (<tr><td colSpan="7" className="text-center p-4">No annual data for {selectedChannel.name} for {CURRENT_YEAR}.</td></tr>) : (<tr><td colSpan="7" className="text-center py-5"><div className="spinner-border spinner-border-sm me-2"></div> Fetching annual data...</td></tr>)}
                </tbody></table></div>)}</div></div></div>
              </div></div></>
            ) : (!isLoadingChannels && (
              <div className="alert alert-info mt-4">
                {branchList.length > 0 
                  ? (selectedBranch && filteredChannels.length === 0 
                      ? `There are no poultry houses configured for the '${selectedBranch}' branch.` 
                      : 'Please select a branch and a poultry house with a sensor to view analytics.')
                  : 'No branches or poultry houses available. Please add one via the Poultry Houses page.'
                }
              </div>
            ))}
          </div>
        )}
      </main >
    </div >
  );
};

export default AnalyticsPage;