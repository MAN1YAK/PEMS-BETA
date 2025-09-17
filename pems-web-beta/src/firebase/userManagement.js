// src/firebase/userManagement.js
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  collection,
  query,
  where,
  documentId,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { auth, db, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const encodeEmail = (email) => email.replace(/\./g, ',');
const decodeEmail = (encodedKey) => encodedKey.replace(/,/g, '.');

/**
 * @returns {Promise<Array>} A list of branch documents.
 */

export const fetchAllBranches = async () => {
  const branchCollectionRef = collection(db, 'poultryHouses');
  const querySnapshot = await getDocs(branchCollectionRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.id, ...doc.data() }));
};

/**
 * @returns {Promise<Array>}
 */

export const fetchAllUsersAndAdmins = async () => {
  const allUsers = [];

  const adminsDocRef = doc(db, 'poultryWorkers', 'Admins');
  const adminsDocSnap = await getDoc(adminsDocRef);
  if (adminsDocSnap.exists()) {
    const adminsData = adminsDocSnap.data();
    for (const encodedEmailKey in adminsData) {
      if (Object.hasOwnProperty.call(adminsData, encodedEmailKey)) {
        const decodedEmail = decodeEmail(encodedEmailKey);
        const adminRecord = adminsData[encodedEmailKey];
        const dateAdded = adminRecord.dateAdded ? adminRecord.dateAdded.toDate() : null;
        allUsers.push({
          id: decodedEmail,
          name: decodedEmail,
          contact: decodedEmail,
          role: 'Admin',
          branches: ['All Branches'],
          isAuthUser: true,
          ...adminRecord,
          dateAdded,
        });
      }
    }
  }

  const workersQuery = query(collection(db, 'poultryWorkers'), where(documentId(), '!=', 'Admins'));
  const workersSnapshot = await getDocs(workersQuery);
  const workerPromises = workersSnapshot.docs.map(async (docSnap) => {
    const workerData = docSnap.data();
    const branchRefs = workerData.branch || [];
    
    const branchNames = await Promise.all(
      branchRefs.map(async (ref) => {
        try {
          const branchDoc = await getDoc(ref);
          return branchDoc.exists() ? branchDoc.id : 'Unknown Branch';
        } catch {
          return 'Error Branch';
        }
      })
    );

    const dateAdded = workerData.dateAdded ? workerData.dateAdded.toDate() : null;

    return {
      id: docSnap.id,
      name: workerData.name || 'N/A',
      contact: docSnap.id,
      role: 'Worker',
      branches: branchNames.length > 0 ? branchNames : ['No branch assigned'],
      branchRefs: branchRefs,
      isAuthUser: false,
      ...workerData,
      dateAdded,
    };
  });
  
  const workersList = await Promise.all(workerPromises);
  allUsers.push(...workersList);

  return allUsers;
};

/**
 * @param {string} email
 * @param {string} password
 */

export const createAdmin = async (email, password) => {
  if (!email || !password) throw new Error("Email and password are required for admins.");
  if (!/\S+@\S+\.\S+/.test(email)) {
    throw new Error("A valid email is required for admins.");
  }
  
  await createUserWithEmailAndPassword(auth, email, password);

  const adminsDocRef = doc(db, 'poultryWorkers', 'Admins');
  const encodedEmail = encodeEmail(email);

  await updateDoc(adminsDocRef, {
    [encodedEmail]: { dateAdded: serverTimestamp(), deviceTokens: [] }
  }).catch(async (error) => {
    if (error.code === 'not-found') {
      await setDoc(adminsDocRef, {
        [encodedEmail]: { dateAdded: serverTimestamp(), deviceTokens: [] }
      });
    } else { throw error; }
  });
};

/**
 * @param {string} name
 * @param {string} phoneNumber
 * @param {string} branchId
 */

export const createWorker = async (name, phoneNumber, branchId) => {
  if (!name || !phoneNumber || !branchId) throw new Error("Name, phone number, and branch are required for workers.");

  const workerDocRef = doc(db, 'poultryWorkers', phoneNumber);
  const workerDocSnap = await getDoc(workerDocRef);
  if (workerDocSnap.exists()) {
    throw new Error(`A worker with the phone number "${phoneNumber}" already exists.`);
  }
  
  const branchDocRef = doc(db, 'poultryHouses', branchId);
  const batch = writeBatch(db);

  batch.set(workerDocRef, {
    name,
    branch: [branchDocRef],
    dateAdded: serverTimestamp(),
    deviceTokens: []
  });

  batch.update(branchDocRef, {
    workers: arrayUnion(workerDocRef)
  });

  await batch.commit();
};

/**
 * @param {string} email
 */

export const deleteAdmin = async (email) => {
  const adminsDocRef = doc(db, 'poultryWorkers', 'Admins');
  const encodedEmail = encodeEmail(email);

  await updateDoc(adminsDocRef, { [encodedEmail]: deleteField() });

  try {
    const deleteUserAuth = httpsCallable(functions, 'deleteUserAuthAccount');
    const result = await deleteUserAuth({ email });
    if (!result.data?.success) {
      throw new Error(result.data?.message || "Cloud function failed to delete auth user.");
    }
  } catch (error) {
    console.error("Error calling deleteUserAuthAccount Cloud Function:", error);
    throw new Error(`Firestore data deleted, but failed to delete Auth account: ${error.message}. Please delete it manually from the Firebase Console.`);
  }
};

/**
 * @param {string} workerId
 */

export const deleteWorker = async (workerId) => {
  const workerDocRef = doc(db, 'poultryWorkers', workerId);
  const workerSnap = await getDoc(workerDocRef);

  if (!workerSnap.exists()) { throw new Error("Worker not found."); }

  const workerData = workerSnap.data();
  const batch = writeBatch(db);

  if (workerData.branch && Array.isArray(workerData.branch)) {
    workerData.branch.forEach(branchRef => {
      batch.update(branchRef, {
        workers: arrayRemove(workerDocRef)
      });
    });
  }

  batch.delete(workerDocRef);
  await batch.commit();
};

/**
 * @param {string} originalPhoneNumber
 * @param {object} newData
 */

export const updateWorker = async (originalPhoneNumber, newData) => {
    const { name, phoneNumber, branchId } = newData;
    if (!name || !phoneNumber || !branchId) {
        throw new Error("Name, phone number, and branch are required for update.");
    }

    const batch = writeBatch(db);
    const oldWorkerRef = doc(db, 'poultryWorkers', originalPhoneNumber);
    const oldWorkerSnap = await getDoc(oldWorkerRef);

    if (!oldWorkerSnap.exists()) throw new Error("Original worker not found.");
    
    const oldData = oldWorkerSnap.data();
    const oldBranchRefs = oldData.branch || [];
    const newBranchRef = doc(db, 'poultryHouses', branchId);

    if (originalPhoneNumber !== phoneNumber) {
        const newWorkerRef = doc(db, 'poultryWorkers', phoneNumber);
        const newWorkerSnap = await getDoc(newWorkerRef);
        if (newWorkerSnap.exists()) {
            throw new Error(`A worker with the phone number "${phoneNumber}" already exists.`);
        }

        const newWorkerData = { ...oldData, name, branch: [newBranchRef] };
        batch.set(newWorkerRef, newWorkerData);

        batch.delete(oldWorkerRef);

        oldBranchRefs.forEach(ref => {
            batch.update(ref, { workers: arrayRemove(oldWorkerRef) });
        });
        
        batch.update(newBranchRef, { workers: arrayUnion(newWorkerRef) });

    } else {
        batch.update(oldWorkerRef, { name, branch: [newBranchRef] });

        const oldBranchPath = oldBranchRefs.length > 0 ? oldBranchRefs[0].path : null;
        if (oldBranchPath !== newBranchRef.path) {
            batch.update(newBranchRef, { workers: arrayUnion(oldWorkerRef) });
            if (oldBranchPath) {
                batch.update(doc(db, oldBranchPath), { workers: arrayRemove(oldWorkerRef) });
            }
        }
    }

    await batch.commit();
};