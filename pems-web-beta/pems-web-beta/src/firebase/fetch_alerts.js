// src/firebase/fetch_alerts.js
import { db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// Formats a raw alert object from Firestore into a standardized application-wide format.
const formatAlertObject = (alertDataFromFirestore, branchName, firestoreId, channelName) => {
    const timestamp = alertDataFromFirestore.timestamp?.toDate ? alertDataFromFirestore.timestamp.toDate() : new Date();
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const dayStr = timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return {
        branchName, firestoreId, channelName,
        originalAlert: alertDataFromFirestore,
        id: `${branchName}-${firestoreId}-${timestamp.getTime()}-${Math.random()}`,
        time: `${dayStr}, ${timeStr}`,
        timestampDate: timestamp,
        type: alertDataFromFirestore.type || alertDataFromFirestore.warning || 'info',
        message: alertDataFromFirestore.message,
        isRead: alertDataFromFirestore.isRead || false
    };
};

// Fetches all alerts for all channels with sensors across all branches.
export const fetchAllUserAlerts = async (allChannels) => {
    if (!db || !allChannels || allChannels.length === 0) return [];
    
    const freshAlerts = [];
    const uniqueBranches = [...new Set(allChannels.map(ch => ch.branchName))];

    for (const branchName of uniqueBranches) {
        const branchDocRef = doc(db, "poultryHouses", branchName);
        try {
            const branchSnap = await getDoc(branchDocRef);
            if (branchSnap.exists()) {
                const housesWithSensor = branchSnap.data().houses?.withSensor || {};
                const channelsInBranchWithSensor = allChannels.filter(ch => ch.branchName === branchName && ch.hasSensor);

                for (const channel of channelsInBranchWithSensor) {
                    const poultryHouseData = housesWithSensor[channel.firestoreId];
                    if (poultryHouseData?.alerts) { 
                        poultryHouseData.alerts.forEach((alertItem) => {
                            if (alertItem.message && alertItem.timestamp) {
                                freshAlerts.push(formatAlertObject(alertItem, branchName, channel.firestoreId, channel.Name));
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error fetching alerts for branch ${branchName}:`, error);
        }
    }

    freshAlerts.sort((a, b) => b.timestampDate - a.timestampDate);
    return freshAlerts;
};