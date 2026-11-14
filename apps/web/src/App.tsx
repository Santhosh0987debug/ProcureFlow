import { Permission } from '@procureflow/shared';
import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './auth/AuthRoutes';
import { PermissionGate } from './auth/PermissionGate';
import { AppShell } from './components/layout/AppShell';
import InvitationAcceptPage from './pages/InvitationAcceptPage';
import LoginPage from './pages/LoginPage';
import ModulePage from './pages/ModulePage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PurchaseRequestsPage = lazy(() => import('./pages/PurchaseRequestsPage'));
const PurchaseRequestCreatePage = lazy(() => import('./pages/PurchaseRequestCreatePage'));
const PurchaseRequestDetailPage = lazy(() => import('./pages/PurchaseRequestDetailPage'));
const PurchaseRequestEditPage = lazy(() => import('./pages/PurchaseRequestEditPage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));
const ApprovalDetailPage = lazy(() => import('./pages/ApprovalDetailPage'));
const ApprovalWorkflowsPage = lazy(() => import('./pages/ApprovalWorkflowsPage'));
const ApprovalWorkflowEditorPage = lazy(() => import('./pages/ApprovalWorkflowEditorPage'));

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="invitations/accept" element={<InvitationAcceptPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route
              path="purchase-requests"
              element={
                <PermissionGate anyOf={[Permission.RequestsRead, Permission.RequestsReadOwn]}>
                  <PurchaseRequestsPage />
                </PermissionGate>
              }
            />
            <Route
              path="purchase-requests/new"
              element={
                <PermissionGate anyOf={[Permission.RequestsCreate]}>
                  <PurchaseRequestCreatePage />
                </PermissionGate>
              }
            />
            <Route
              path="purchase-requests/:requestId"
              element={
                <PermissionGate anyOf={[Permission.RequestsRead, Permission.RequestsReadOwn]}>
                  <PurchaseRequestDetailPage />
                </PermissionGate>
              }
            />
            <Route
              path="purchase-requests/:requestId/edit"
              element={
                <PermissionGate anyOf={[Permission.RequestsUpdate]}>
                  <PurchaseRequestEditPage />
                </PermissionGate>
              }
            />
            <Route
              path="approvals"
              element={
                <PermissionGate anyOf={[Permission.ApprovalsRead]}>
                  <ApprovalsPage />
                </PermissionGate>
              }
            />
            <Route
              path="approvals/:approvalId"
              element={
                <PermissionGate anyOf={[Permission.ApprovalsRead]}>
                  <ApprovalDetailPage />
                </PermissionGate>
              }
            />
            <Route
              path="vendors"
              element={
                <PermissionGate anyOf={[Permission.VendorsRead]}>
                  <ModulePage moduleKey="vendors" />
                </PermissionGate>
              }
            />
            <Route
              path="quotations"
              element={
                <PermissionGate anyOf={[Permission.QuotationsRead]}>
                  <ModulePage moduleKey="quotations" />
                </PermissionGate>
              }
            />
            <Route
              path="purchase-orders"
              element={
                <PermissionGate anyOf={[Permission.PurchaseOrdersRead]}>
                  <ModulePage moduleKey="purchaseOrders" />
                </PermissionGate>
              }
            />
            <Route
              path="deliveries"
              element={
                <PermissionGate anyOf={[Permission.DeliveriesRead]}>
                  <ModulePage moduleKey="deliveries" />
                </PermissionGate>
              }
            />
            <Route
              path="reports"
              element={
                <PermissionGate anyOf={[Permission.ReportsRead]}>
                  <ModulePage moduleKey="reports" />
                </PermissionGate>
              }
            />
            <Route
              path="audit-logs"
              element={
                <PermissionGate anyOf={[Permission.AuditLogsRead]}>
                  <ModulePage moduleKey="auditLogs" />
                </PermissionGate>
              }
            />
            <Route
              path="settings/approval-workflows"
              element={
                <PermissionGate anyOf={[Permission.ApprovalWorkflowsRead]}>
                  <ApprovalWorkflowsPage />
                </PermissionGate>
              }
            />
            <Route
              path="settings/approval-workflows/new"
              element={
                <PermissionGate anyOf={[Permission.ApprovalWorkflowsManage]}>
                  <ApprovalWorkflowEditorPage />
                </PermissionGate>
              }
            />
            <Route
              path="settings/approval-workflows/:workflowId/edit"
              element={
                <PermissionGate anyOf={[Permission.ApprovalWorkflowsManage]}>
                  <ApprovalWorkflowEditorPage />
                </PermissionGate>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
