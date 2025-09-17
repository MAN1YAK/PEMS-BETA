export async function fetchHourlyPattern(channelId, apiKey, fieldId, days = 1) {
let url;

      url = new URL(`https://api.thingspeak.com/channels/${channelId}/fields/${fieldId}.json`);
      url.searchParams.append("days", days);
      url.searchParams.append("results", 8000);
      if (apiKey) url.searchParams.append("api_key", apiKey);

    //  console.log("ThingSpeak request URL:", url.toString());


  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();

    const hourlyGroups = {};

    data.feeds.forEach(feed => {
      const dateTime = new Date(feed.created_at);
      const hour = dateTime.getUTCHours().toString().padStart(2, "0");
      const value = parseFloat(feed[`field${fieldId}`]);

      if (!isNaN(value)) {
        if (!hourlyGroups[hour]) hourlyGroups[hour] = [];
        hourlyGroups[hour].push(value);
      }
    });

    const hourlyAverages = {};
    for (let h = 0; h < 24; h++) {
      const hourKey = h.toString().padStart(2, "0");
      const values = hourlyGroups[hourKey] || [];
      hourlyAverages[hourKey + ":00"] = values.length
        ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
        : null;
    }

    return hourlyAverages;
  } catch (error) {
    console.error("Failed to fetch or process data:", error);
    return {};
  }
}

  // --- Hourly Pattern for a whole month ---
  export async function fetchMonthlyHourlyPattern(channelId, apiKey, fieldId, year, month) {
    // month is 1-based (1 = Jan, 12 = Dec)

    // Start = first day of month 00:00 UTC
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    // End = last day of month 23:59:59 UTC
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const url = new URL(`https://api.thingspeak.com/channels/${channelId}/fields/${fieldId}.json`);
    url.searchParams.append("api_key", apiKey);
    url.searchParams.append("start", start.toISOString());
    url.searchParams.append("end", end.toISOString());
    url.searchParams.append("average", "60"); // ✅ hourly average

    // console.log("ThingSpeak URL:", url.toString());

    try {
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();

      const hourlyGroups = {};

      data.feeds.forEach(feed => {
        const dateTime = new Date(feed.created_at);
        const hour = dateTime.getUTCHours().toString().padStart(2, "0");
        const value = parseFloat(feed[`field${fieldId}`]);

        if (!isNaN(value)) {
          if (!hourlyGroups[hour]) hourlyGroups[hour] = [];
          hourlyGroups[hour].push(value);
        }
      });

      // Build averages for all 24 hours
      const hourlyAverages = {};
      for (let h = 0; h < 24; h++) {
        const hourKey = h.toString().padStart(2, "0") + ":00";
        const values = hourlyGroups[h.toString().padStart(2, "0")] || [];
        hourlyAverages[hourKey] = values.length
          ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
          : null;
      }

      return hourlyAverages;
    } catch (error) {
      console.error("Failed to fetch or process monthly hourly data:", error);
      return {};
    }
  }
