import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './auth/AuthRoutes';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import ModulePage from './pages/ModulePage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="purchase-requests" element={<ModulePage moduleKey="purchaseRequests" />} />
            <Route path="approvals" element={<ModulePage moduleKey="approvals" />} />
            <Route path="vendors" element={<ModulePage moduleKey="vendors" />} />
            <Route path="quotations" element={<ModulePage moduleKey="quotations" />} />
            <Route path="purchase-orders" element={<ModulePage moduleKey="purchaseOrders" />} />
            <Route path="deliveries" element={<ModulePage moduleKey="deliveries" />} />
            <Route path="reports" element={<ModulePage moduleKey="reports" />} />
            <Route path="audit-logs" element={<ModulePage moduleKey="auditLogs" />} />
            <Route path="settings" element={<ModulePage moduleKey="settings" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
