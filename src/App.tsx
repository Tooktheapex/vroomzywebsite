import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Public pages
import { HomePage } from './pages/public/HomePage';
import { BrowsePage } from './pages/public/BrowsePage';
import { ProviderDetailPage } from './pages/public/ProviderDetailPage';
import { ServicesPage } from './pages/public/ServicesPage';
import { ServiceDetailPage } from './pages/public/ServiceDetailPage';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Consumer pages
import { ConsumerDashboardLayout, ConsumerOverview } from './pages/consumer/ConsumerDashboard';
import { GaragePage } from './pages/consumer/GaragePage';
import { MyLeadsPage } from './pages/consumer/MyLeadsPage';
import { ConsumerSettingsPage } from './pages/consumer/SettingsPage';

// Provider pages
import { ProviderDashboardLayout, ProviderOverview } from './pages/provider/ProviderDashboard';
import { OnboardingPage } from './pages/provider/OnboardingPage';
import { IncomingLeadsPage } from './pages/provider/IncomingLeadsPage';
import { BillingPage } from './pages/provider/BillingPage';
import { ProviderSettingsPage } from './pages/provider/ProviderSettingsPage';
import { GalleryPage } from './pages/provider/GalleryPage';
import { BillingSuccessPage } from './pages/provider/BillingSuccessPage';
import { ServiceRecordsPage } from './pages/provider/ServiceRecordsPage';

// Admin pages
import { AdminDashboardLayout, AdminOverview } from './pages/admin/AdminDashboard';
import { PendingProvidersPage } from './pages/admin/PendingProvidersPage';
import { AdminLeadsPage } from './pages/admin/AdminLeadsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminServiceRecordsPage } from './pages/admin/AdminServiceRecordsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ─── Public ─────────────────────────────────────────── */}
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:slug" element={<ServiceDetailPage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/provider/:id" element={<ProviderDetailPage />} />

          {/* ─── Auth ───────────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* ─── Consumer ────────────────────────────────────────── */}
          <Route
            path="/consumer"
            element={
              <ProtectedRoute allowedRoles={['consumer']}>
                <ConsumerDashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ConsumerOverview />} />
            <Route path="garage" element={<GaragePage />} />
            <Route path="requests" element={<MyLeadsPage />} />
            <Route path="settings" element={<ConsumerSettingsPage />} />
          </Route>

          {/* ─── Provider ────────────────────────────────────────── */}
          <Route
            path="/provider"
            element={
              <ProtectedRoute allowedRoles={['provider']}>
                <ProviderDashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ProviderOverview />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="leads" element={<IncomingLeadsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="billing/success" element={<BillingSuccessPage />} />
            <Route path="settings" element={<ProviderSettingsPage />} />
            <Route path="service-records" element={<ServiceRecordsPage />} />
          </Route>

          {/* ─── Admin ───────────────────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="providers" element={<PendingProvidersPage />} />
            <Route path="leads" element={<AdminLeadsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="service-records" element={<AdminServiceRecordsPage />} />
          </Route>

          {/* ─── Catch-all ───────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
