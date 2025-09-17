// src/pages/WorkersPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/layout/Sidebar';
import UserModal from '../components/modals/UserModal';
import NotificationModal from '../components/modals/NotificationModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import styles from '../styles/WorkersPage.module.css';

// Import from the new userManagement file
import {
  fetchAllUsersAndAdmins,
  fetchAllBranches,
  createAdmin,
  createWorker,
  deleteAdmin,
  deleteWorker,
  updateWorker,
} from '../firebase/userManagement';

const WorkersPage = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  const [activeFilters, setActiveFilters] = useState({ role: 'All', branch: 'All' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUserForModal, setCurrentUserForModal] = useState(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [pageBlur, setPageBlur] = useState(false);

  const [notification, setNotification] = useState({ isOpen: false, message: '', type: 'info', title: '' });

  const [confirmationState, setConfirmationState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirmAction: null,
    confirmButtonText: 'Confirm',
    confirmButtonType: 'primary',
    isProcessing: false,
  });

  const loggedInUserEmail = useMemo(() => localStorage.getItem('loggedInUserEmail'), []);

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersList, branchesList] = await Promise.all([
        fetchAllUsersAndAdmins(),
        fetchAllBranches()
      ]);
      setUsers(usersList);
      setBranches(branchesList);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load workers and branches. " + err.message);
      setUsers([]);
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    setPageBlur(isModalOpen || notification.isOpen || confirmationState.isOpen);
  }, [isModalOpen, notification.isOpen, confirmationState.isOpen]);

  const { adminCount, workerCount } = useMemo(() => {
    return users.reduce(
      (counts, user) => {
        if (user.role === 'Admin') {
          counts.adminCount++;
        } else if (user.role === 'Worker') {
          counts.workerCount++;
        }
        return counts;
      },
      { adminCount: 0, workerCount: 0 }
    );
  }, [users]);

  const handleFilterChange = (filterType, value) => {
    setActiveFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const handleOpenAddModal = () => {
    setCurrentUserForModal(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setCurrentUserForModal(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentUserForModal(null);
    setIsSubmittingModal(false);
  };

  const handleCloseNotification = () => {
    setNotification({ isOpen: false, message: '', type: 'info', title: '' });
  };

  const handleCloseConfirmation = () => {
    setConfirmationState({ isOpen: false, title: '', message: '', onConfirmAction: null, isProcessing: false });
  };

  const requestConfirmation = (title, message, onConfirmCallback, confirmButtonText = 'Confirm', confirmButtonType = 'primary') => {
    setConfirmationState({
      isOpen: true,
      title,
      message,
      onConfirmAction: async () => {
        setConfirmationState(prev => ({ ...prev, isProcessing: true }));
        try {
          await onConfirmCallback();
        } catch (error) {
          console.error("Confirmation action failed:", error);
          setNotification({
            isOpen: true,
            title: "Action Failed",
            message: error.message || "An unexpected error occurred.",
            type: "error",
          });
        } finally {
          setConfirmationState(prev => ({ ...prev, isOpen: false, isProcessing: false }));
        }
      },
      confirmButtonText,
      confirmButtonType,
      isProcessing: false,
    });
  };

  const handleSubmitUserForm = async (formData, isEditMode) => {
    setIsSubmittingModal(true);
    setError(null);
    const { role } = formData;
    try {
      if (isEditMode) {
        if (role === 'Worker') {
          await updateWorker(currentUserForModal.id, formData);
          setNotification({ isOpen: true, message: 'Worker updated successfully!', type: "success", title: "Update Successful" });
        } else {
          throw new Error("Editing admin details is not supported through this form.");
        }
      } else {
        if (role === 'Admin') {
          await createAdmin(formData.email, formData.password);
          setNotification({ isOpen: true, message: 'Admin created successfully!', type: "success", title: "Admin Created" });
        } else if (role === 'Worker') {
          await createWorker(formData.name, formData.phoneNumber, formData.branchId);
          setNotification({ isOpen: true, message: 'Worker created successfully!', type: "success", title: "Worker Created" });
        }
      }
      fetchAllData();
      handleCloseModal();
    } catch (err) {
      console.error("Error submitting user form:", err);
      throw err;
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.role === 'Admin' && user.id === loggedInUserEmail) {
      setNotification({
        isOpen: true,
        title: "Action Prohibited",
        message: "You cannot delete your own account.",
        type: "warning",
      });
      return;
    }

    const displayName = user.role === 'Admin' ? user.contact : user.name;
    const actionType = user.role === 'Admin' ? 'delete their Auth account' : 'remove their record';

    requestConfirmation(
      `Confirm ${user.role} Deletion`,
      `Are you sure you want to delete ${displayName}? This will ${actionType} and cannot be undone.`,
      async () => {
        setIsLoading(true);
        setError(null);
        try {
          if (user.role === 'Admin') {
            await deleteAdmin(user.id);
          } else {
            await deleteWorker(user.id);
          }
          setNotification({ isOpen: true, message: `${user.role} ${displayName} deleted successfully.`, type: "success", title: "Deletion Successful" });
          fetchAllData();
        } catch (err) {
          console.error(`Error deleting ${user.role}:`, err);
          setError(`Failed to delete ${displayName}: ${err.message}`);
          setNotification({ isOpen: true, message: `Failed to delete ${displayName}. ${err.message}`, type: "error", title: "Deletion Failed" });
        } finally {
          setIsLoading(false);
        }
      },
      `Delete ${user.role}`,
      'danger'
    );
  };

  const sortedAndFilteredUsers = useMemo(() => {
    const safeSearchTerm = (searchTerm || '').toLowerCase();
    
    let filtered = users.filter(user => {
      const roleMatch = activeFilters.role === 'All' || user.role === activeFilters.role;
      const branchMatch = activeFilters.branch === 'All' || (Array.isArray(user.branches) && user.branches.some(b => b === activeFilters.branch));
      return roleMatch && branchMatch;
    });

    if (safeSearchTerm) {
      // --- START: MODIFICATION ---
      // Update search logic to match the new date format
      const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(safeSearchTerm) ||
        user.contact?.toLowerCase().includes(safeSearchTerm) ||
        (user.dateAdded && user.dateAdded.toLocaleDateString('en-US', dateOptions).toLowerCase().includes(safeSearchTerm))
      );
      // --- END: MODIFICATION ---
    }

    filtered.sort((a, b) => {
      if (a.role === 'Admin' && b.role !== 'Admin') return -1;
      if (a.role !== 'Admin' && b.role === 'Admin') return 1;

      const dateA = a.dateAdded || 0;
      const dateB = b.dateAdded || 0;
      return dateB - dateA;
    });

    return filtered;
  }, [users, searchTerm, activeFilters]);

  const mainContentStyle = {
    marginLeft: isSidebarExpanded ? '260px' : '70px',
  };

  const renderTableBody = () => {
    if (isLoading) {
      return <tr><td colSpan="7" className="text-center">Loading users...</td></tr>;
    }
    if (error) {
      return <tr><td colSpan="7" className="text-center text-danger">Error: {error}</td></tr>;
    }
    if (sortedAndFilteredUsers.length === 0) {
      return <tr><td colSpan="7" className="text-center">No users found matching your criteria.</td></tr>;
    }
    return sortedAndFilteredUsers.map((user, index) => {
      const isCurrentUser = user.role === 'Admin' && user.id === loggedInUserEmail;

      return (
        <tr key={user.id}>
          <td>{index + 1}</td>
          <td>
            {user.role === 'Admin' 
              ? <span className={styles.notApplicable}>N/A</span> 
              : user.name}
          </td>
          <td>{user.contact}</td>
          <td>
            <span className={`badge ${user.role === 'Admin' ? 'bg-primary' : 'bg-secondary'}`}>
              {user.role}
            </span>
          </td>
          <td>{user.branches.join(', ')}</td>
          <td>
            {/* --- START: MODIFICATION --- */}
            {/* Update date format to "Month Day, Year" */}
            {user.dateAdded 
              ? user.dateAdded.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : <span className={styles.notApplicable}>N/A</span>
            }
            {/* --- END: MODIFICATION --- */}
          </td>
          <td className="text-nowrap">
            {user.role !== 'Admin' && (
              <button
                className="btn btn-sm btn-outline-primary me-2"
                title="Edit User"
                onClick={() => handleOpenEditModal(user)}
              >
                <i className="bi bi-pencil-square"></i>
              </button>
            )}
            <button
              className="btn btn-sm btn-outline-danger"
              title={isCurrentUser ? "You cannot delete your own account" : "Delete User"}
              onClick={() => handleDeleteUser(user)}
              disabled={isCurrentUser}
            >
              <i className="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className={styles.wrapper}>
      <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={toggleSidebar} />
      <main className={`${styles.mainContent} ${pageBlur ? styles.pageBlurred : ''}`} style={mainContentStyle}>
        <div className="container-fluid py-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className={styles.pageHeader}>
              <h1><i className="bi bi-people-fill me-2"></i>Workers</h1>
              <p className={`${styles.textMuted} mb-0`}>Oversee all workers and admins, and manage branch access.</p>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6 col-lg-4">
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.iconBgPrimary}`}>
                  <i className="bi bi-person-badge"></i>
                </div>
                <div className={styles.statContent}>
                  <span className={styles.statValue}>{workerCount}</span>
                  <span className={styles.statLabel}>Total Workers</span>
                </div>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.iconBgSuccess}`}>
                  <i className="bi bi-person-video3"></i>
                </div>
                <div className={styles.statContent}>
                  <span className={styles.statValue}>{adminCount}</span>
                  <span className={styles.statLabel}>Total Admins</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${styles.controlsHeader} d-flex justify-content-between align-items-center my-4 p-3 bg-white rounded shadow-sm`}>
            <div className={styles.searchContainer}>
              <i className={`bi bi-search ${styles.searchIcon}`}></i>
              <input
                type="text"
                className={`form-control ${styles.searchInput}`}
                placeholder="Search by Name, Contact, or Date Added..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <button
              className={`btn btn-primary ${styles.quickActionBtn}`}
              onClick={handleOpenAddModal}
              disabled={isLoading}
            >
              <i className="bi bi-plus-lg"></i> Add User
            </button>
          </div>

          <div className={styles.filterContainer}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Role:</span>
              <button className={`${styles.filterButton} ${activeFilters.role === 'All' ? styles.active : ''}`} onClick={() => handleFilterChange('role', 'All')}>All</button>
              <button className={`${styles.filterButton} ${activeFilters.role === 'Worker' ? styles.active : ''}`} onClick={() => handleFilterChange('role', 'Worker')}>Workers</button>
              <button className={`${styles.filterButton} ${activeFilters.role === 'Admin' ? styles.active : ''}`} onClick={() => handleFilterChange('role', 'Admin')}>Admins</button>
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Branch:</span>
              <select
                className={styles.filterDropdown}
                value={activeFilters.branch}
                onChange={(e) => handleFilterChange('branch', e.target.value)}
                disabled={isLoading}
              >
                <option value="All">All Branches</option>
                {branches
                  .filter(branch => branch && branch.name)
                  .map(branch => (
                    <option key={branch.id} value={branch.name}>
                      {branch.name}
                    </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${styles.tableWrapper} bg-white p-3 rounded shadow-sm`}>
            <div className={styles.tableResponsive}>
              <table className={`table table-hover align-middle ${styles.userTable}`}>
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email / Phone Number</th>
                    <th>Role</th>
                    <th>Branch</th>
                    <th>Date Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>{renderTableBody()}</tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <UserModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitUserForm}
        currentUser={currentUserForModal}
        isLoading={isSubmittingModal}
        branches={branches}
      />
      <NotificationModal {...notification} onClose={handleCloseNotification} />
      <ConfirmationModal {...confirmationState} onClose={handleCloseConfirmation} onConfirm={confirmationState.onConfirmAction} />
    </div>
  );
};

export default WorkersPage;