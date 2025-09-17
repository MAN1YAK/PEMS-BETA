// src/utils/reportGenerationUtils.js
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; // Import the function directly
import { Chart } from "chart.js/auto"; // /auto for all controllers, scales, etc.
import { getMonthlyData } from "../thingspeak/fetch_chartdata";
import { fetchMonthlyHourlyPattern } from "../thingspeak/fetch_bardata";
import logo from "../assets/logo_new.png"

// Core PDF creation logic (from old content_pdf.js)
// Setup pdf data
export async function createPdfDocument(channelOrBranch, selectedMonth, reportTableData) 
{
  const {
    coopName,
    ammoniaField,
    tempField,
    currentYear
  } = preparePdfData(channelOrBranch, selectedMonth);
  const doc = new jsPDF();

  const ammoniaChartResult = await fetchMonthlyChartImage(
    channelOrBranch,
    ammoniaField,
    currentYear,
    selectedMonth
  );
  const tempChartResult = await fetchMonthlyChartImage(
    channelOrBranch,
    tempField,
    currentYear,
    selectedMonth
  );

  const hourlyAmmoniaChartResult = await fetchHourlyBarChartImage(
    channelOrBranch,
    ammoniaField,
    currentYear,
    selectedMonth
  );
  const hourlyTempChartResult = await fetchHourlyBarChartImage(
    channelOrBranch,
    tempField,
    currentYear,
    selectedMonth
  );

  if (!ammoniaChartResult.imageDataUrl || !tempChartResult.imageDataUrl) {
    const errorMsg =
      ammoniaChartResult.error ||
      tempChartResult.error ||
      "Failed to generate one or more charts due to missing data.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
 
  // PDF CONTENT BELOW 

  // Header
  await drawPdfHeader(doc);

  let currentY = 45; // start below the header

  // -----------------------------
  // Poultry Info Table
  // -----------------------------

  autoTable(doc, {
    head: [[
      { content: "Poultry Information", colSpan: 2, styles: { halign: "left" } }
    ]],
    body: [
      ["Name", coopName],
      ["Observation Period", reportTableData.table1.observationPeriod],
      ["Livestock Count", reportTableData.table1.livestockCount],
      ["Livestock Age", reportTableData.table1.livestockAge],
    ],
    startY: currentY,
    margin: { left: 10 },
    tableWidth: 90,
    theme: "grid",
    styles: { lineWidth: 0.2, lineColor: [204, 255, 204], font: "helvetica" },
    headStyles: { fillColor: [144, 238, 144], textColor: 0, fontStyle: "bold" },
  });

  // -----------------------------
  // Environment Info Table
  // -----------------------------

  autoTable(doc, {
    head: [[
      { content: "Environment Information", colSpan: 2, styles: { halign: "left" } }
    ]],
    body: [
      ["Avg. Temperature Level", reportTableData.table2.avgTemp],
      ["Avg. Ammonia Level", reportTableData.table2.avgAmmonia],
      ["Peak Temperature Detected", reportTableData.table2.peakTempTime],
      ["Peak Ammonia Detected", reportTableData.table2.peakAmmoniaTime],
    ],
    startY: currentY,
    margin: { left: 110 },
    tableWidth: 80,
    theme: "grid",
    styles: { lineWidth: 0.2, lineColor: [204, 255, 204], font: "helvetica" },
    headStyles: { fillColor: [144, 238, 144], textColor: 0, fontStyle: "bold" },
  });

  currentY = Math.max(currentY, doc.lastAutoTable.finalY) + 10;

  // -----------------------------
  // Descriptive Analysis
  // -----------------------------
  drawLabeledRectangle(doc, 10, currentY, 190, 70, "Descriptive Analysis",
    [144, 238, 144], [0, 0, 0], [204, 255, 204]);

  currentY += 15; // move inside the analysis box

  const analysisText = [
    reportTableData.analysis.para1,
    reportTableData.analysis.para2,
    reportTableData.analysis.para3,
  ];

  doc
    .setFontSize(10)
    .setFont("helvetica", "normal")
    .setTextColor(0, 0, 0);

  const textOptions = {
    maxWidth: 186,
    align: "justify",
    lineHeightFactor: 1.4,
  };

  analysisText.forEach((para) => {
    const lines = doc.splitTextToSize(para, textOptions.maxWidth);
    doc.text(lines, 12, currentY, textOptions);

    const height =
      lines.length *
      (doc.getFontSize() / doc.internal.scaleFactor) *
      textOptions.lineHeightFactor;

    currentY += height + 5;
  });

  currentY += 15; 

  // -----------------------------
  // Charts (Ammonia + Temperature)
  // -----------------------------

  drawLabeledRectangle(doc, 10, currentY, 93, 50, "Ammonia",
    [144, 238, 144], [0, 0, 0], [204, 255, 204]);

  if (ammoniaChartResult.imageDataUrl) {
    doc.addImage(ammoniaChartResult.imageDataUrl, "PNG", 11.5, currentY + 9, 90, 40);
  }

  drawLabeledRectangle(doc, 108, currentY, 93, 50, "Temperature",
    [144, 238, 144], [0, 0, 0], [204, 255, 204]);

  if (tempChartResult.imageDataUrl) {
    doc.addImage(tempChartResult.imageDataUrl, "PNG", 109.5, currentY + 9, 90, 40);
  }

  currentY += 60;

   // -----------------------------
  // Discussion
  // -----------------------------
  drawLabeledRectangle(doc, 10, currentY, 190, 40, "Discussion",
    [144, 238, 144], [0, 0, 0], [204, 255, 204]);

  currentY += 15; // move inside the analysis box

  const analysisText2 = [
    reportTableData.analysis.para1,
    reportTableData.analysis.para2,
  ];

  doc
    .setFontSize(10)
    .setFont("helvetica", "normal")
    .setTextColor(0, 0, 0);

  const textOptions2 = {
    maxWidth: 186,
    align: "justify",
    lineHeightFactor: 1.4,
  };

  analysisText2.forEach((para) => {
    const lines = doc.splitTextToSize(para, textOptions2.maxWidth);
    doc.text(lines, 12, currentY, textOptions2);

    const height =
      lines.length *
      (doc.getFontSize() / doc.internal.scaleFactor) *
      textOptions2.lineHeightFactor;

    currentY += height + 5;
  });


  // -----------------------------
// Page 2
// -----------------------------
doc.addPage();

currentY = 45;
await drawPdfHeader(doc);

// -----------------------------
// Hourly Overview
// -----------------------------
const rectHeight = 60;
const rectWidth = 190; // full width
const chartPadding = 15;

// =============================
// Ammonia Section
// =============================
drawLabeledRectangle(
  doc,
  10,
  currentY,
  rectWidth,
  rectHeight,
  "Ammonia Trend",
  [144, 238, 144],
  [0, 0, 0],
  [204, 255, 204]
);

if (hourlyAmmoniaChartResult.imageDataUrl) {
  doc.addImage(hourlyAmmoniaChartResult.imageDataUrl, "PNG", 15, currentY + chartPadding, 180, 40);
}

// Move Y down
currentY += rectHeight + 5;

// Discussion for Ammonia
drawLabeledRectangle(doc, 10, currentY, 190, 40, "Discussion",
  [144, 238, 144], [0, 0, 0], [204, 255, 204]);

currentY += 15; // move inside the analysis box

const analysisText4 = [
  reportTableData.analysis.para1,
  reportTableData.analysis.para2,
];

doc
  .setFontSize(10)
  .setFont("helvetica", "normal")
  .setTextColor(0, 0, 0);

const textOptions4 = {
  maxWidth: 186,
  align: "justify",
  lineHeightFactor: 1.4,
};

analysisText4.forEach((para) => {
  const lines = doc.splitTextToSize(para, textOptions4.maxWidth);
  doc.text(lines, 12, currentY, textOptions4);

  const height =
    lines.length *
    (doc.getFontSize() / doc.internal.scaleFactor) *
    textOptions4.lineHeightFactor;

  currentY += height + 5;
});

// =============================
// Temperature Section
// =============================
drawLabeledRectangle(
  doc,
  10,
  currentY,
  rectWidth,
  rectHeight,
  "Temperature Trend",
  [144, 238, 144],
  [0, 0, 0],
  [204, 255, 204]
);

if (hourlyTempChartResult.imageDataUrl) {
  doc.addImage(hourlyTempChartResult.imageDataUrl, "PNG", 15, currentY + chartPadding, 180, 40);
}

// Move Y down
currentY += rectHeight + 5;

// Discussion for Temperature
drawLabeledRectangle(doc, 10, currentY, 190, 40, "Discussion",
  [144, 238, 144], [0, 0, 0], [204, 255, 204]);

currentY += 15; // move inside the analysis box

doc
  .setFontSize(10)
  .setFont("helvetica", "normal")
  .setTextColor(0, 0, 0);

const analysisText3 = [
  reportTableData.analysis.para1,
  reportTableData.analysis.para2,
];

const textOptions3 = {
  maxWidth: 186,
  align: "justify",
  lineHeightFactor: 1.4,
};

analysisText3.forEach((para) => {
  const lines = doc.splitTextToSize(para, textOptions3.maxWidth);
  doc.text(lines, 12, currentY, textOptions3);

  const height =
    lines.length *
    (doc.getFontSize() / doc.internal.scaleFactor) *
    textOptions3.lineHeightFactor;

  currentY += height + 5;
});

return doc;
}

// END OF PDF CONTENT

function preparePdfData(channelOrBranch, selectedMonth) {
  const isBranch = Array.isArray(channelOrBranch);
  const channels = isBranch ? channelOrBranch : [channelOrBranch];

  if (!channels || channels.length === 0) {
    throw new Error("Missing channel information.");
  }
  return {
    isBranch,
    channels,
    coopName: isBranch
      ? channelOrBranch[0].BRANCH_NAME   
      : channelOrBranch.COOP_NAME,       
    ammoniaField: isBranch
      ? channels[0].ammoniaField
      : channelOrBranch.ammoniaField,
    tempField: isBranch
      ? channels[0].tempField
      : channelOrBranch.tempField,
    currentYear: new Date().getFullYear(),
    selectedMonth
  };
}

async function drawPdfHeader(doc) {

  const logoBase64 = await toBase64(logo);

  //Set Metadata
  doc.setProperties({
    title: "PEMS Report",
    subject: "Sensor Data Analysis",
    author: "PEMS System",
    keywords: "ammonia, temperature, poultry, report",
    creator: "PEMS Web App",
  });

  // Report title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.addImage(logoBase64, "PNG", 10, 10, 20, 20);
  doc.text("PEMS Report", 35, 20);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Descriptive Analysis of Ammonia & Temperature Sensor Data", 35, 27);

  // Divider line
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(10, 36, 200, 36);

}

// Helper to draw a labeled rectangle (from old utils_pdf.js)
export function drawLabeledRectangle(
  doc,
  x,
  y,
  width,
  height,
  label,
  labelFillColor = [255, 255, 255],
  labelTextColor = [0, 0, 0],
  borderColor = [0, 0, 0]
) {
  doc.setFillColor(...labelFillColor);
  const labelHeight = 8;
  doc.rect(x, y, width, labelHeight, "F");

  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);
  doc.rect(x, y, width, height);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...labelTextColor); // Ensure text color is set correctly
  doc.text(label, x + 2, y + labelHeight - 2);
}

// Helper to build Chart.js instance and get canvas (from old utils_pdf.js)
function buildChart(labels, dataPoints, type = "line", label = "Trend", width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  const isLine = type === "line";

  const chart = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [
        {
          label,
          data: dataPoints,
          borderColor: isLine ? "green" : "rgba(0, 128, 0, 1)",
          backgroundColor: isLine
            ? "rgba(0, 128, 0, 0.1)"
            : "rgba(0, 128, 0, 0.6)",
          fill: isLine,
          pointRadius: isLine ? 0 : undefined,
          pointHoverRadius: isLine ? 0 : undefined,
          tension: isLine ? 0.4 : 0,
          borderWidth: isLine ? 2 : 1,
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      devicePixelRatio: 2,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMin: 0,
        },
        x: {
          ticks: {
            maxTicksLimit: 10,
            autoSkip: true,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  });

  return { chart, canvas };
}

// Fetch monthly data and render chart to image (from old utils_pdf.js)
export async function fetchMonthlyChartImage(
  channelOrBranch,
  fieldId,
  year,
  month
) {
  try {
    const isBranch = Array.isArray(channelOrBranch);
    const channels = isBranch ? channelOrBranch : [channelOrBranch];

    const results = await Promise.all(
      channels.map((ch) =>
        getMonthlyData(ch.CHANNEL_ID, ch.READ_API_KEY, fieldId, month, year)
      )
    );

    const dateMap = {};
    results.forEach((feeds) => {
  feeds.forEach((f) => {
    const date = new Date(f.created_at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
    const val = f.value; 
    if (val !== null && !isNaN(val)) {
      if (!dateMap[date]) dateMap[date] = [];
      dateMap[date].push(val);
    }
  });
});

    if (Object.keys(dateMap).length === 0) {
      return { imageDataUrl: null, error: "No monthly data available." };
    }

  // Fill labels for ALL days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = Array.from({ length: daysInMonth }, (_, i) =>
    new Date(year, month - 1, i + 1).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    })
  );

  const dataPoints = labels.map((label) => {
    const values = dateMap[label] || [];
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null; // Show gap if no data
  });


    const { chart, canvas } = buildChart(
      labels,
      dataPoints,
      "line",
      "Monthly Avg",
      600,
      300
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const imageDataUrl = canvas.toDataURL("image/png");
    chart.destroy();

    return { imageDataUrl };
  } catch (error) {
    console.error("Error fetching monthly chart:", error);
    return {
      imageDataUrl: null,
      error: error.message || "Failed to generate monthly chart.",
    };
  }
}

// --- Hourly Chart (single or branch) ---
export async function fetchHourlyBarChartImage(
  channelOrBranch,
  fieldId,
  year,
  month
) {
  try {
    const isBranch = Array.isArray(channelOrBranch);
    const channels = isBranch ? channelOrBranch : [channelOrBranch];

    const results = await Promise.all(
      channels.map((ch) =>
        fetchMonthlyHourlyPattern(ch.CHANNEL_ID, ch.READ_API_KEY, fieldId, year, month)
      )
    );

    const hourMap = {};
    results.forEach((hourlyObj) => {
      Object.entries(hourlyObj).forEach(([hour, value]) => {
        if (value !== null) {
          if (!hourMap[hour]) hourMap[hour] = [];
          hourMap[hour].push(value);
        }
      });
    });

    // Predefine all 24 hours
    const labels = Array.from({ length: 24 }, (_, i) =>
      i.toString().padStart(2, "0") + ":00"
    );

    const dataPoints = labels.map((hour) => {
      const values = hourMap[hour] || [];
      return values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null; // gap if no data
    });

    // If still all null → no data
    if (dataPoints.every((v) => v === null)) {
      return { imageDataUrl: null, error: "No hourly data available." };
    }

    const { chart, canvas } = buildChart(
      labels,
      dataPoints,
      "bar",
      "Hourly Avg",
      1500,
      400
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const imageDataUrl = canvas.toDataURL("image/png");
    chart.destroy();

    return { imageDataUrl };
  } catch (error) {
    console.error("Error fetching hourly chart:", error);
    return {
      imageDataUrl: null,
      error: error.message || "Failed to generate hourly chart.",
    };
  }
}

function toBase64(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // ✅ needed for local/public assets
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (err) => reject(err);
  });
}