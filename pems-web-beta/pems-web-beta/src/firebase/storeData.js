// src/firebase/storeData.js
import { db } from './firebaseConfig.js';
import { doc, updateDoc, getDoc, setDoc  } from "firebase/firestore";

// Saves fetched hourly pattern data to Firestore for a specific channel.
export async function saveFetchedDataToFirestore(branchName, firestoreId, dateKey, fieldData) {
  if (!branchName || !firestoreId) return;
  try {
    const branchRef = doc(db, "poultryHouses", branchName);
    const monthKey = dateKey.slice(0, 7);
    const updatePath = `houses.withSensor.${firestoreId}.hourlyPattern.${monthKey}`;
    
    await setDoc(branchRef, { houses: { withSensor: { [firestoreId]: { hourlyPattern: { [monthKey]: fieldData } } } } }, { merge: true });
    console.log(`✅ Saved hourly pattern data for ${branchName}/${firestoreId} under ${monthKey}`);
  } catch (error) {
    console.error("❌ Error saving hourly pattern data to Firestore:", error);
  }
}

// Saves aggregated annual report data to Firestore.
export async function saveTableDataToFirestore(branchName, firestoreId, year, tableData) {
  if (!branchName || !firestoreId) return;
  try {
    const branchRef = doc(db, "poultryHouses", branchName);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const annualReportMap = {};

    tableData.forEach((data, index) => {
      if (year < currentYear || (year === currentYear && index <= currentMonthIndex)) {
        const monthKey = `${String(index + 1).padStart(2, '0')}-${data.month.toLowerCase()}`;
        const { month, ...restOfData } = data;
        annualReportMap[monthKey] = restOfData;
      }
    });

    if (Object.keys(annualReportMap).length === 0) return;

    const updatePath = `houses.withSensor.${firestoreId}.annualReport.${year}`;
    await setDoc(branchRef, { houses: { withSensor: { [firestoreId]: { annualReport: { [year]: annualReportMap } } } } }, { merge: true });
    console.log(`✅ Saved annual report for ${branchName}/${firestoreId} for year ${year}.`);
  } catch (error) {
    console.error("❌ Error saving annual report data to Firestore:", error);
  }
}

// Loads cached annual report data from Firestore.
export async function loadTableDataFromFirestore(branchName, firestoreId, year) {
  if (!branchName || !firestoreId) return null;
  try {
    const branchRef = doc(db, "poultryHouses", branchName);
    const snapshot = await getDoc(branchRef);

    if (snapshot.exists()) {
      const annualReportMap = snapshot.data()?.houses?.withSensor?.[firestoreId]?.annualReport?.[year];
      if (!annualReportMap) return null; 

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return monthNames.map((monthName, i) => {
        const monthKey = `${String(i + 1).padStart(2, '0')}-${monthName.toLowerCase()}`;
        return {
          month: monthName,
          ...(annualReportMap[monthKey] || { ammoniaMax: "", ammoniaMin: "", ammoniaAvg: "", tempMax: "", tempMin: "", tempAvg: "" }),
        };
      });
    }
    return null;
  } catch (error) {
    console.error("❌ Error loading table data from Firestore:", error);
    return null;
  }
}