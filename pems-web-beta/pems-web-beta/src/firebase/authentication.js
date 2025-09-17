// src/firebase/authentication.js
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc as deleteFirestoreDoc,
  writeBatch,
  serverTimestamp,
  collection,
  getDocs,
  query as firestoreQuery,
  where,
  arrayUnion,
  arrayRemove,
  limit
} from 'firebase/firestore';
import { auth, db, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// Helper to get Channel DocumentReference by its 'ID' field (Product ID)
// This function is no longer used by adminCreateUserWithChannel but kept for other potential uses.
export const getChannelDocRefByProductId = async (productId) => {
  if (!productId) throw new Error("Product ID is required.");
  const channelsRef = collection(db, 'channels');
  const q = firestoreQuery(channelsRef, where("ID", "==", productId), limit(1));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }
  return querySnapshot.docs[0].ref;
};


// For creating a NEW user by admin (including Auth and Firestore doc)
// initialChannelFirestoreId here refers to the Firestore Document ID of the channel, not its Product ID (like ThingSpeak ID)
export const adminCreateUserWithChannel = async (email, password, role, initialChannelFirestoreId = null) => {
  const userEmailLower = email.toLowerCase();
  const userDocRef = doc(db, 'users', userEmailLower);

  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    throw new Error(`A user profile for email ${email} already exists in the database.`);
  }

  // Create Firebase Auth user
  await createUserWithEmailAndPassword(auth, email, password);

  const batch = writeBatch(db);
  const userDocPayload = {
    role: role,
    // email: userEmailLower, // Removed: Email is the document ID
    createdAt: serverTimestamp(),
  };

  // Only add "Poultry Houses" field for non-admin users
  if (role !== 'admin') {
    userDocPayload["Poultry Houses"] = []; // Default to empty array
  }

  let channelDataForReturn = null;

  // If an initialChannelFirestoreId is provided and role is not admin, try to assign the initial poultry house
  if (role !== 'admin' && initialChannelFirestoreId) {
    const channelRef = doc(db, 'channels', initialChannelFirestoreId); // Use Firestore ID directly
    const channelSnap = await getDoc(channelRef);
    
    if (!channelSnap.exists()) {
      // Consider deleting the created auth user here for atomicity, or instruct admin
      // For simplicity, we'll let the error propagate. If auth user needs deletion, it's a manual step or a more complex rollback.
      await auth.currentUser?.delete().catch(e => console.warn("Failed to delete auth user after channel assignment error:", e)); // Attempt to clean up auth user
      throw new Error(`Channel with Firestore ID "${initialChannelFirestoreId}" does not exist.`);
    }
    
    const channelData = channelSnap.data();
    if (channelData.User) {
      await auth.currentUser?.delete().catch(e => console.warn("Failed to delete auth user after channel assignment error:", e)); // Attempt to clean up auth user
      throw new Error(`Channel with Firestore ID "${initialChannelFirestoreId}" is already assigned to another user (${channelData.User.id}).`);
    }

    userDocPayload["Poultry Houses"] = [channelRef]; // Store the DocumentReference
    batch.update(channelRef, { User: userDocRef });
    channelDataForReturn = channelData;
  }

  batch.set(userDocRef, userDocPayload);
  await batch.commit();

  // Prepare data for return, including details for the initially assigned poultry house
  // Note: `email` field is not in userDocPayload, `id` will be the email.
  const createdUserData = { ...userDocPayload, id: userDocRef.id, createdAt: new Date() };
  
  if (role !== 'admin' && initialChannelFirestoreId && channelDataForReturn) {
    createdUserData.poultryHousesDetailed = [{
        name: channelDataForReturn.Name || `Channel ${initialChannelFirestoreId}`,
        productId: channelDataForReturn.ID, // The actual Product ID (e.g., ThingSpeak ID) from channel data
        firestoreId: initialChannelFirestoreId // The Firestore Document ID of the channel
    }];
  } else if (role !== 'admin') {
    createdUserData.poultryHousesDetailed = [];
  }
  // For 'admin' role, poultryHousesDetailed will be undefined, which is fine.
  
  return createdUserData;
};

// For updating an existing user's role by admin - THIS FUNCTION IS NO LONGER USED FOR EDITING ROLE FROM MODAL
// Kept for potential other uses.
export const adminUpdateUserRole = async (email, newRole) => {
  const userEmailLower = email.toLowerCase();
  const userDocRef = doc(db, 'users', userEmailLower);

  await updateDoc(userDocRef, { role: newRole });

  const updatedDoc = await getDoc(userDocRef);
  if (updatedDoc.exists()) {
    const userData = { id: updatedDoc.id, ...updatedDoc.data() };
    userData.poultryHousesDetailed = await fetchPoultryHouseDetailsForUser(userData);
    return userData;
  }
  throw new Error("User document not found after update.");
};


// For deleting a user's Firestore document AND their Firebase Auth account
export const adminDeleteFirestoreUserAndAuth = async (email) => {
  const userEmailLower = email.toLowerCase();
  const userDocRef = doc(db, 'users', userEmailLower);

  const batch = writeBatch(db);
  const userSnap = await getDoc(userDocRef);

  if (userSnap.exists()) {
    const userData = userSnap.data();
    if (userData.role !== 'admin' && userData["Poultry Houses"] && Array.isArray(userData["Poultry Houses"])) {
      userData["Poultry Houses"].forEach(channelRef => {
        if (channelRef && typeof channelRef.path === 'string') {
          const actualChannelRef = doc(db, channelRef.path);
          batch.update(actualChannelRef, { User: null });
        } else if (channelRef && channelRef.constructor.name === 'DocumentReference') {
           batch.update(channelRef, { User: null });
        }
      });
    }
  }
  const channelsQuery = firestoreQuery(collection(db, 'channels'), where('User', '==', userDocRef));
  const channelDocsToUpdate = await getDocs(channelsQuery);
  channelDocsToUpdate.forEach(channelDoc => {
    batch.update(channelDoc.ref, { User: null });
  });

  batch.delete(userDocRef);
  await batch.commit();
  console.log(`Firestore data for user ${userEmailLower} deleted successfully.`);

  try {
    const deleteUserAuth = httpsCallable(functions, 'deleteUserAuthAccount');
    const result = await deleteUserAuth({ email: userEmailLower });
    console.log("Firebase Auth user deletion initiated via Cloud Function:", result.data);
    if (!result.data || !result.data.success) {
        throw new Error(result.data.message || "Cloud function reported failure in deleting auth user.");
    }
  } catch (error) {
    console.error("Error calling deleteUserAuthAccount Cloud Function:", error);
    throw new Error(`Firestore data deleted, but failed to delete Auth user account: ${error.message}. Please check the Firebase Console for the Auth account and delete it manually if it still exists.`);
  }
};


// Helper to fetch detailed poultry house information for a user
export const fetchPoultryHouseDetailsForUser = async (userData) => {
    // No "Poultry Houses" field for admin, so this check is implicitly handled.
    if (!userData || userData.role === 'admin' || !userData["Poultry Houses"]) return [];
    
    const refs = Array.isArray(userData["Poultry Houses"]) ? userData["Poultry Houses"] : [];
    
    const validDocRefs = refs.map(refInput => {
      if (typeof refInput === "string" && refInput.includes('/')) {
        const parts = refInput.split('/');
        if (parts.length >= 2) return doc(db, parts[0], parts[1]);
        return null;
      } else if (refInput && typeof refInput.path === 'string' && typeof refInput.id === 'string') {
        return refInput;
      }
      return null;
    }).filter(ref => ref !== null);

    if (validDocRefs.length === 0) return [];

    try {
        const coopDocsSnaps = await Promise.all(validDocRefs.map(ref => getDoc(ref)));
        const details = coopDocsSnaps.map((cSnap, index) => {
            const originalRef = validDocRefs[index];
            if (cSnap.exists()) {
                const cData = cSnap.data();
                return {
                    name: cData.Name || `Unnamed Channel (${cSnap.id})`,
                    productId: cData.ID,
                    firestoreId: cSnap.id,
                };
            }
            return {
                name: `Unknown/Deleted Channel (Ref ID: ${originalRef.id})`,
                productId: null,
                firestoreId: originalRef.id,
                isDeleted: true
            };
        });
        return details.filter(d => d);
    } catch (error) {
        console.error("Error fetching poultry house details:", error);
        return validDocRefs.map(ref => ({ 
            name: "Error fetching name", 
            firestoreId: ref.id, 
            productId: null, 
            isError: true 
        }));
    }
};

// Add a poultry house to a user using the CHANNEL'S FIRESTORE DOCUMENT ID
export const adminAddPoultryHouseToUser = async (userEmail, channelFirestoreIdToAdd) => {
  const userEmailLower = userEmail.toLowerCase();
  const userDocRef = doc(db, 'users', userEmailLower);
  
  if (!channelFirestoreIdToAdd) {
    throw new Error("Channel Firestore Document ID is required to add a poultry house.");
  }
  const channelDocRefToAdd = doc(db, 'channels', channelFirestoreIdToAdd);

  const batch = writeBatch(db);
  const userSnap = await getDoc(userDocRef);
  const channelSnap = await getDoc(channelDocRefToAdd);

  if (!userSnap.exists()) {
    throw new Error(`User "${userEmailLower}" not found.`);
  }
  if (!channelSnap.exists()) {
    throw new Error(`Channel with Firestore ID "${channelFirestoreIdToAdd}" not found.`);
  }

  const userData = userSnap.data();
  const channelData = channelSnap.data();
  
  if (userData.role === 'admin') {
    throw new Error("Admins cannot be assigned poultry houses.");
  }

  if (channelData.User && channelData.User.path !== userDocRef.path) {
    throw new Error(`Poultry House "${channelData.Name || channelFirestoreIdToAdd}" is already assigned to user ${channelData.User.id}.`);
  }
  const userPoultryHouses = userData["Poultry Houses"] || [];
  if (userPoultryHouses.some(ref => ref && ref.path === channelDocRefToAdd.path)) {
    throw new Error(`User "${userEmailLower}" already has Poultry House "${channelData.Name || channelFirestoreIdToAdd}".`);
  }

  batch.update(userDocRef, { "Poultry Houses": arrayUnion(channelDocRefToAdd) });
  batch.update(channelDocRefToAdd, { User: userDocRef });

  await batch.commit();
  return { success: true, message: "Poultry house added successfully." };
};

// Remove a poultry house from a user using the CHANNEL'S FIRESTORE DOCUMENT ID
export const adminRemovePoultryHouseFromUser = async (userEmail, channelFirestoreIdToRemove) => {
  const userEmailLower = userEmail.toLowerCase();
  const userDocRef = doc(db, 'users', userEmailLower);

  if (!channelFirestoreIdToRemove) {
    throw new Error("Channel Firestore Document ID is required to remove a poultry house.");
  }
  const channelDocRefToRemove = doc(db, 'channels', channelFirestoreIdToRemove);

  const batch = writeBatch(db);
  const userSnap = await getDoc(userDocRef);

  if (!userSnap.exists()) {
    throw new Error(`User "${userEmailLower}" not found.`);
  }
  
  const userData = userSnap.data();
  if (userData.role === 'admin') {
    // This should ideally not happen if UI prevents it, but good to have a check.
    console.warn(`Attempted to remove poultry house from admin user ${userEmailLower}. Admins don't have poultry houses.`);
    return { success: true, message: "Admin users do not have poultry houses to remove." };
  }


  batch.update(userDocRef, { "Poultry Houses": arrayRemove(channelDocRefToRemove) });
  batch.update(channelDocRefToRemove, { User: null });

  await batch.commit();
  return { success: true, message: "Poultry house removed successfully." };
};