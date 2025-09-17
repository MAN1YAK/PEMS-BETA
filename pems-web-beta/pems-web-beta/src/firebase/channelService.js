// src/firebase/channelService.js
import { db } from './firebaseConfig';
import {
  collection, getDocs, doc, setDoc, updateDoc, getDoc,
  Timestamp, deleteField, writeBatch, query, where
} from 'firebase/firestore';

// Retrieves all poultry houses from all branches.
export const getAllChannels = async () => {
  const branchCollectionRef = collection(db, 'poultryHouses');
  const querySnapshot = await getDocs(branchCollectionRef);
  const channelsList = [];

  for (const docSnap of querySnapshot.docs) {
    const branchName = docSnap.id;
    const houses = docSnap.data().houses || {};
    Object.entries(houses.withSensor || {}).forEach(([name, data]) => {
      channelsList.push({ branchName, firestoreId: name, Name: name, hasSensor: true, ID: data.databaseID, ReadAPI: data.databaseReadAPI, WriteAPI: data.databaseWriteAPI, "Date Created": data.dateAdded, "~Alerts": data.alerts || [], alertThreshold: data.alertThreshold || {} });
    });
    Object.entries(houses.withoutSensor || {}).forEach(([name, data]) => {
      channelsList.push({ branchName, firestoreId: name, Name: name, hasSensor: false, ID: null, ReadAPI: null, WriteAPI: null, "Date Created": data.dateAdded, "~Alerts": [] });
    });
  }
  return channelsList;
};

// Retrieves all branches with their name and key.
export const getBranches = async () => {
  const branchCollectionRef = collection(db, 'poultryHouses');
  const querySnapshot = await getDocs(branchCollectionRef);
  return querySnapshot.docs.map(doc => ({ name: doc.id, key: doc.data().key }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// Creates a new ThingSpeak channel with a description.
export const createThingSpeakChannel = async (adminUserApiKey, channelName, description) => {
  if (!adminUserApiKey) throw new Error("Admin ThingSpeak API Key is required.");
  const url = "https://api.thingspeak.com/channels.json";
  const bodyParams = new URLSearchParams({ api_key: adminUserApiKey, name: channelName, description, field1: 'Celsius', field2: 'Fahrenheit', field3: 'Ammonia', field4: 'Status' });
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: bodyParams.toString() });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error || `ThingSpeak API Error: ${response.statusText}`);
  return result;
};

// Updates a ThingSpeak channel's name and description.
export const updateThingSpeakChannel = async (adminUserApiKey, thingSpeakChannelId, newChannelName, description) => {
  if (!adminUserApiKey || !thingSpeakChannelId) throw new Error("API Key and Channel ID are required.");
  const url = `https://api.thingspeak.com/channels/${thingSpeakChannelId}.json`;
  const bodyParams = new URLSearchParams({ api_key: adminUserApiKey, name: newChannelName, description });
  const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: bodyParams.toString() });
  const result = await response.json();
  if (!response.ok) throw new Error(`Failed to update ThingSpeak channel: ${result?.error || response.statusText}`);
  return result;
};

// Deletes a ThingSpeak channel.
export const deleteThingSpeakChannel = async (adminUserApiKey, thingSpeakChannelId) => {
  if (!adminUserApiKey || !thingSpeakChannelId) throw new Error("API Key and Channel ID are required.");
  const url = `https://api.thingspeak.com/channels/${thingSpeakChannelId}.json?api_key=${adminUserApiKey}`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
    throw new Error(`Failed to delete ThingSpeak channel: ${result?.error || response.statusText}`);
  }
  return await response.json().catch(() => ({}));
};

// Creates a new branch document in Firestore.
export const createBranch = async (branchName, branchKey) => {
  if (!branchName || !branchKey) throw new Error("Branch Name and Key are required.");
  const branchDocRef = doc(db, "poultryHouses", branchName);
  const docSnap = await getDoc(branchDocRef);
  if (docSnap.exists()) throw new Error(`Branch "${branchName}" already exists.`);
  await setDoc(branchDocRef, { key: branchKey, houses: { withSensor: {}, withoutSensor: {} }, workers: [] });
};

// Updates a branch's name and/or key, handling document ID changes and worker references.
export const updateBranch = async (oldBranchName, newBranchName, newBranchKey) => {
  if (!oldBranchName || !newBranchName || !newBranchKey) throw new Error("Old name, new name, and key are required.");
  
  const oldBranchRef = doc(db, "poultryHouses", oldBranchName);
  const oldBranchSnap = await getDoc(oldBranchRef);
  if (!oldBranchSnap.exists()) throw new Error(`Branch "${oldBranchName}" not found.`);

  if (oldBranchName === newBranchName) {
    await updateDoc(oldBranchRef, { key: newBranchKey });
    return;
  }
  
  const newBranchRef = doc(db, "poultryHouses", newBranchName);
  const newBranchSnap = await getDoc(newBranchRef);
  if (newBranchSnap.exists()) throw new Error(`A branch named "${newBranchName}" already exists.`);

  const batch = writeBatch(db);
  batch.set(newBranchRef, { ...oldBranchSnap.data(), key: newBranchKey });
  
  const workersQuery = query(collection(db, "poultryWorkers"), where("branch", "array-contains", oldBranchRef));
  const workerSnaps = await getDocs(workersQuery);
  workerSnaps.forEach(workerDoc => {
    const updatedBranches = workerDoc.data().branch.map(ref => ref.path === oldBranchRef.path ? newBranchRef : ref);
    batch.update(workerDoc.ref, { branch: updatedBranches });
  });

  batch.delete(oldBranchRef);
  await batch.commit();
};

// Deletes a branch after ensuring it's empty and cleans up worker references.
export const deleteBranch = async (branchName) => {
  if (!branchName) throw new Error("Branch name is required.");

  const branchRef = doc(db, "poultryHouses", branchName);
  const branchSnap = await getDoc(branchRef);

  if (!branchSnap.exists()) throw new Error(`Branch "${branchName}" not found.`);

  const houses = branchSnap.data().houses || {};
  const hasHouses = Object.keys(houses.withSensor || {}).length > 0 || Object.keys(houses.withoutSensor || {}).length > 0;

  if (hasHouses) {
    throw new Error(`Cannot delete branch "${branchName}" as it still contains houses. Please delete all houses in this branch first.`);
  }

  const batch = writeBatch(db);
  const workersQuery = query(collection(db, "poultryWorkers"), where("branch", "array-contains", branchRef));
  const workerSnaps = await getDocs(workersQuery);
  
  workerSnaps.forEach(workerDoc => {
    const updatedBranches = workerDoc.data().branch.filter(ref => ref.path !== branchRef.path);
    batch.update(workerDoc.ref, { branch: updatedBranches });
  });

  batch.delete(branchRef);
  await batch.commit();
};

// Saves a new house without a sensor to Firestore.
export const saveNewChannelWithoutSensorToFirestore = async (channelName, branchName) => {
  if (!branchName || !channelName) throw new Error("Branch and house names are required.");
  const branchDocRef = doc(db, "poultryHouses", branchName);
  const branchSnap = await getDoc(branchDocRef);
  if (branchSnap.exists() && (branchSnap.data().houses?.withSensor?.[channelName] || branchSnap.data().houses?.withoutSensor?.[channelName])) {
    throw new Error(`A poultry house named "${channelName}" already exists in this branch.`);
  }
  await setDoc(branchDocRef, { houses: { withoutSensor: { [channelName]: { dateAdded: Timestamp.now() } } } }, { merge: true });
};

// Saves a new channel with a sensor and thresholds to Firestore.
export const saveNewChannelWithSensorToFirestore = async (thingSpeakResponse, branchName, alertThreshold) => {
  const channelName = thingSpeakResponse.name;
  if (!branchName || !channelName) throw new Error("Branch and channel names are required.");

  const dataToSave = {
    databaseID: thingSpeakResponse.id.toString(),
    databaseReadAPI: thingSpeakResponse.api_keys?.find(key => !key.write_flag)?.api_key || "",
    databaseWriteAPI: thingSpeakResponse.api_keys?.find(key => key.write_flag)?.api_key || "",
    dateAdded: Timestamp.fromDate(new Date(thingSpeakResponse.created_at)),
    alerts: [],
    alertThreshold,
  };
  const branchDocRef = doc(db, "poultryHouses", branchName);
  const branchSnap = await getDoc(branchDocRef);
  if (branchSnap.exists() && (branchSnap.data().houses?.withSensor?.[channelName] || branchSnap.data().houses?.withoutSensor?.[channelName])) {
    throw new Error(`A poultry house named "${channelName}" already exists in this branch.`);
  }
  await setDoc(branchDocRef, { houses: { withSensor: { [channelName]: dataToSave } } }, { merge: true });
};

// Upgrades a house from 'withoutSensor' to 'withSensor', creating a ThingSpeak channel.
export const addSensorToExistingHouse = async (channel, adminUserApiKey, alertThreshold) => {
  if (!channel?.branchName || !channel.firestoreId) throw new Error("Invalid channel data provided.");
  if (!adminUserApiKey) throw new Error("Admin ThingSpeak API key is required to add a sensor.");

  const { tempHigh = 'N/A', tempLow = 'N/A', ammoniaHigh = 'N/A' } = alertThreshold || {};
  const description = `Branch: ${channel.branchName}\nAlert Temp Threshold: High=${tempHigh}, Low=${tempLow}\nAlert Ammonia Threshold: High=${ammoniaHigh}`;
  const thingSpeakResponse = await createThingSpeakChannel(adminUserApiKey, channel.Name, description);
  
  const newSensorData = {
    databaseID: thingSpeakResponse.id.toString(),
    databaseReadAPI: thingSpeakResponse.api_keys?.find(key => !key.write_flag)?.api_key || "",
    databaseWriteAPI: thingSpeakResponse.api_keys?.find(key => key.write_flag)?.api_key || "",
    dateAdded: channel['Date Created'],
    alerts: [],
    alertThreshold,
  };

  const branchDocRef = doc(db, "poultryHouses", channel.branchName);
  const batch = writeBatch(db);
  batch.update(branchDocRef, { [`houses.withSensor.${channel.firestoreId}`]: newSensorData });
  batch.update(branchDocRef, { [`houses.withoutSensor.${channel.firestoreId}`]: deleteField() });
  await batch.commit();
};

// Removes sensor from a house, deleting ThingSpeak channel and moving it to 'withoutSensor'.
export const removeSensorFromHouse = async (channel, adminUserApiKey) => {
  if (!channel?.hasSensor || !channel.ID) throw new Error("Channel does not have a sensor or is invalid.");
  if (!adminUserApiKey) throw new Error("Admin ThingSpeak API Key is required.");

  await deleteThingSpeakChannel(adminUserApiKey, channel.ID);

  const branchDocRef = doc(db, "poultryHouses", channel.branchName);
  const batch = writeBatch(db);
  batch.update(branchDocRef, { [`houses.withoutSensor.${channel.firestoreId}`]: { dateAdded: channel["Date Created"] } });
  batch.update(branchDocRef, { [`houses.withSensor.${channel.firestoreId}`]: deleteField() });
  await batch.commit();
};

// Updates a channel's name and/or thresholds in Firestore.
export const updateChannelInFirestore = async (branchName, oldName, newName, hasSensor, alertThreshold) => {
  if (!branchName || !oldName || !newName) throw new Error("Branch name, old name, and new name are required.");

  const docRef = doc(db, "poultryHouses", branchName);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error(`Branch "${branchName}" not found.`);

  const houses = docSnap.data().houses || {};
  const sensorType = hasSensor ? 'withSensor' : 'withoutSensor';
  if (oldName !== newName && (houses.withSensor?.[newName] || houses.withoutSensor?.[newName])) {
    throw new Error(`A house named "${newName}" already exists.`);
  }
  
  const houseData = houses[sensorType]?.[oldName];
  if (!houseData) throw new Error(`Could not find house "${oldName}" to update.`);

  if (hasSensor && alertThreshold) {
    houseData.alertThreshold = alertThreshold;
  }

  const batch = writeBatch(db);
  batch.update(docRef, { [`houses.${sensorType}.${newName}`]: houseData });
  if (oldName !== newName) {
    batch.update(docRef, { [`houses.${sensorType}.${oldName}`]: deleteField() });
  }
  await batch.commit();
};

// Clears all sensor data feeds from ThingSpeak and all alerts from Firestore.
export const clearChannelDataInThingSpeakAndFirestore = async (channel, adminUserApiKey) => {
  if (!channel?.ID || !channel.hasSensor) throw new Error("Invalid channel data or channel has no sensor.");
  if (adminUserApiKey) {
    const tsUrl = `https://api.thingspeak.com/channels/${channel.ID}/feeds.json?api_key=${adminUserApiKey}`;
    const tsResponse = await fetch(tsUrl, { method: 'DELETE' });
    if (!tsResponse.ok) throw new Error(`ThingSpeak feed clearing failed. Response: ${await tsResponse.text()}`);
  }
  const branchDocRef = doc(db, "poultryHouses", channel.branchName);
  await updateDoc(branchDocRef, { [`houses.withSensor.${channel.firestoreId}.alerts`]: [] });
};

// Deletes a channel from both Firestore and ThingSpeak.
export const deleteChannelFromFirestoreAndThingSpeak = async (branchName, channelName, adminUserApiKey) => {
  const branchDocRef = doc(db, "poultryHouses", branchName);
  const branchSnap = await getDoc(branchDocRef);
  if (!branchSnap.exists()) throw new Error(`Branch ${branchName} not found.`);
  
  const houses = branchSnap.data().houses || {};
  const channelData = houses.withSensor?.[channelName] || houses.withoutSensor?.[channelName];
  const sensorType = houses.withSensor?.[channelName] ? 'withSensor' : 'withoutSensor';

  if (!channelData) throw new Error(`Channel ${channelName} not found in branch ${branchName}.`);
  if (sensorType === 'withSensor' && channelData.databaseID && adminUserApiKey) {
    await deleteThingSpeakChannel(adminUserApiKey, channelData.databaseID).catch(e => console.error(e.message));
  }
  await updateDoc(branchDocRef, { [`houses.${sensorType}.${channelName}`]: deleteField() });
};