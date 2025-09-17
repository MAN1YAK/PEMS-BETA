// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PoultryListPage from './pages/PoultryListPage';
import AnalyticsPage from './pages/AnalyticsPage';
import GenerateReportPage from './pages/GenerateReportPage';
import WorkersPage from './pages/WorkersPage';
import SettingsPage from './pages/SettingsPage';

// A protected route component.
const ProtectedRoute = () => {
  const isLoggedIn = !!localStorage.getItem('loggedInUserEmail');
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />;
};

// Main application component with routing.
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes for any logged-in user */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/poultry-list" element={<PoultryListPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/generate-report" element={<GenerateReportPage />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        
        {/* Default route redirect logic */}
        <Route 
          path="/" 
          element={
            localStorage.getItem('loggedInUserEmail') 
            ? <Navigate to="/dashboard" replace /> 
            : <Navigate to="/login" replace />
          } 
        />
        {/* Catch-all route to redirect to the main entry point */}
        <Route path="*" element={<Navigate to="/" replace />} /> 
      </Routes>
    </Router>
  );
}

export default App;