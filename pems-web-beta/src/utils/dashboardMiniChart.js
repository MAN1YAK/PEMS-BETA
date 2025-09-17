import Chart from 'chart.js/auto';

// Helper to create the configuration for the mini line charts
const getMiniChartConfig = (labels, data, lineBorderColor) => {
    // Determine gradient colors based on the line color
    const isAmmonia = lineBorderColor === "#28a745";
    const gradientStartColor = isAmmonia ? 'rgba(40, 167, 69, 0.05)' : 'rgba(255, 193, 7, 0.05)';
    const gradientEndColor = isAmmonia ? 'rgba(40, 167, 69, 0.4)' : 'rgba(255, 193, 7, 0.4)';

    return {
        type: "line",
        data: {
            labels,
            datasets: [{
                data,
                borderColor: lineBorderColor,
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                backgroundColor: (context) => {
                    const { ctx, chartArea } = context.chart;
                    if (!chartArea) return isAmmonia ? 'rgba(40, 167, 69, 0.1)' : 'rgba(255, 193, 7, 0.1)';
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, gradientStartColor);
                    gradient.addColorStop(1, gradientEndColor);
                    return gradient;
                },
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } },
            elements: { point: { radius: 0 } },
        },
    };
};

// Helper to create or clear a chart with a message
export const createOrClearChart = (canvasRef, chartInstanceRef, message = "No data") => {
    if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            chartInstanceRef.current = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [{ data: [], label: message }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: !!message && message !== "No data" } },
                    scales: { x: { display: false }, y: { display: false } },
                    elements: { point: { radius: 0 } }
                }
            });
        }
    }
};

// Default empty state for the performance summary
const emptyPerformanceSummary = {
    highestAmmoniaVal: '-- ppm', highestAmmoniaTime: '--',
    lowestAmmoniaVal: '-- ppm', lowestAmmoniaTime: '--',
    highestTempVal: '-- °C', highestTempTime: '--',
    lowestTempVal: '-- °C', lowestTempTime: '--',
};

// Main function to update mini charts and performance summary
export const updateDashboardVisuals = async ({
    channelConfig,
    ammoniaMiniChartRef,
    tempMiniChartRef,
    ammoniaChartInstanceRef,
    tempChartInstanceRef,
    setPerformanceSummary
}) => {
    // If no channel is selected, clear everything and exit
    if (!channelConfig || !channelConfig.ID || !channelConfig.ReadAPI) {
        createOrClearChart(ammoniaMiniChartRef, ammoniaChartInstanceRef);
        createOrClearChart(tempMiniChartRef, tempChartInstanceRef);
        setPerformanceSummary(emptyPerformanceSummary);
        return;
    }

    try {
        const ammoniaField = channelConfig.AmmoniaField || "field3";
        const tempField = channelConfig.TempField || "field1";

        // Fetch data for mini charts (last 48 results)
        const miniChartResponse = await fetch(`https://api.thingspeak.com/channels/${channelConfig.ID}/feeds.json?api_key=${channelConfig.ReadAPI}&results=48`);
        
        // --- Process Mini Chart Data ---
        if (!miniChartResponse.ok) throw new Error(`ThingSpeak API error for mini charts: ${miniChartResponse.status}`);
        const miniChartData = await miniChartResponse.json();

        if (miniChartData.feeds && miniChartData.feeds.length > 0) {
            const feeds = miniChartData.feeds;
            const labels = feeds.map((feed) => new Date(feed.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
            const ammoniaData = feeds.map((feed) => parseFloat(feed[ammoniaField]));
            const tempData = feeds.map((feed) => parseFloat(feed[tempField]));

            if (ammoniaChartInstanceRef.current) {
                ammoniaChartInstanceRef.current.data.labels = labels;
                ammoniaChartInstanceRef.current.data.datasets[0].data = ammoniaData;
                ammoniaChartInstanceRef.current.update();
            } else if (ammoniaMiniChartRef.current) {
                ammoniaChartInstanceRef.current = new Chart(ammoniaMiniChartRef.current.getContext('2d'), getMiniChartConfig(labels, ammoniaData, "#28a745"));
            }

            if (tempChartInstanceRef.current) {
                tempChartInstanceRef.current.data.labels = labels;
                tempChartInstanceRef.current.data.datasets[0].data = tempData;
                tempChartInstanceRef.current.update();
            } else if (tempMiniChartRef.current) {
                tempChartInstanceRef.current = new Chart(tempMiniChartRef.current.getContext('2d'), getMiniChartConfig(labels, tempData, "#ffc107"));
            }
        } else {
            createOrClearChart(ammoniaMiniChartRef, ammoniaChartInstanceRef, "No chart data");
            createOrClearChart(tempMiniChartRef, tempChartInstanceRef, "No chart data");
        }

        // --- Fetch and Process Summary Data for Today ---
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const formatThingSpeakDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}%20${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
        const startDateStr = formatThingSpeakDate(startOfDay);
        const endDateStr = formatThingSpeakDate(endOfDay);
        
        const summaryResponse = await fetch(`https://api.thingspeak.com/channels/${channelConfig.ID}/feeds.json?api_key=${channelConfig.ReadAPI}&start=${startDateStr}&end=${endDateStr}&timezone=Asia/Singapore`);

        if (!summaryResponse.ok) throw new Error(`ThingSpeak API error for summary: ${summaryResponse.status}`);
        const summaryData = await summaryResponse.json();

        if (summaryData.feeds && summaryData.feeds.length > 0) {
            let maxAmmonia = -Infinity, minAmmonia = Infinity, maxTemp = -Infinity, minTemp = Infinity;
            let maxAmmoniaTime = "--", minAmmoniaTime = "--", maxTempTime = "--", minTempTime = "--";
            
            summaryData.feeds.forEach((feed) => {
                const feedDate = new Date(feed.created_at);
                const timeStr = feedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                
                const ammonia = parseFloat(feed[ammoniaField]);
                if (!isNaN(ammonia)) {
                    if (ammonia > maxAmmonia) { maxAmmonia = ammonia; maxAmmoniaTime = timeStr; }
                    if (ammonia < minAmmonia) { minAmmonia = ammonia; minAmmoniaTime = timeStr; }
                }
                
                const temp = parseFloat(feed[tempField]);
                if (!isNaN(temp)) {
                    if (temp > maxTemp) { maxTemp = temp; maxTempTime = timeStr; }
                    if (temp < minTemp) { minTemp = temp; minTempTime = timeStr; }
                }
            });

            setPerformanceSummary({
                highestAmmoniaVal: maxAmmonia === -Infinity ? "-- ppm" : `${maxAmmonia.toFixed(1)} ppm`, highestAmmoniaTime: maxAmmoniaTime,
                lowestAmmoniaVal: minAmmonia === Infinity ? "-- ppm" : `${minAmmonia.toFixed(1)} ppm`, lowestAmmoniaTime: minAmmoniaTime,
                highestTempVal: maxTemp === -Infinity ? "-- °C" : `${maxTemp.toFixed(1)} °C`, highestTempTime: maxTempTime,
                lowestTempVal: minTemp === Infinity ? "-- °C" : `${minTemp.toFixed(1)} °C`, lowestTempTime: minTempTime,
            });
        } else {
            setPerformanceSummary(emptyPerformanceSummary);
        }

    } catch (err) {
        console.error("Error fetching data for charts or summary:", err);
        createOrClearChart(ammoniaMiniChartRef, ammoniaChartInstanceRef, "Error loading chart");
        createOrClearChart(tempMiniChartRef, tempChartInstanceRef, "Error loading chart");
        setPerformanceSummary({
            highestAmmoniaVal: 'Error', highestAmmoniaTime: '--',
            lowestAmmoniaVal: 'Error', lowestAmmoniaTime: '--',
            highestTempVal: 'Error', highestTempTime: '--',
            lowestTempVal: 'Error', lowestTempTime: '--',
        });
    }
};