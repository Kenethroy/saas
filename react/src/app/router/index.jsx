import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthLayout } from "@/app/layouts/AuthLayout";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { ProtectedRoute } from "@/app/guards/ProtectedRoute";
import { PermissionRoute } from "@/app/guards/PermissionRoute";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { AssistantPage } from "@/modules/assistant/pages/AssistantPage";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { EmployeesPage } from "@/modules/employees/pages/EmployeesPage";
import { AgentHistoryPage } from "@/modules/agents/pages/AgentHistoryPage";
import { AgentPerformancePage } from "@/modules/agents/pages/AgentPerformancePage";
import { UsersPage } from "@/modules/users/pages/UsersPage";
import { PermissionsPage } from "@/modules/permissions/pages/PermissionsPage";
import { CategoriesPage } from "@/modules/categories/pages/CategoriesPage";
import { ProductsPage } from "@/modules/products/pages/ProductsPage";
import { InventoryPage } from "@/modules/inventory/pages/InventoryPage";
import { StockMovementLogsPage } from "@/modules/inventory/pages/StockMovementLogsPage";
import { StockAdjustmentsPage } from "@/modules/inventory/pages/StockAdjustmentsPage";
import { StockAdjustmentCreatePage } from "@/modules/inventory/pages/StockAdjustmentCreatePage";
import { StockAdjustmentViewPage } from "@/modules/inventory/pages/StockAdjustmentViewPage";
import { StockAdjustmentEditPage } from "@/modules/inventory/pages/StockAdjustmentEditPage";
import { TrucksPage } from "@/modules/trucks/pages/TrucksPage";
import { CustomersPage } from "@/modules/customers/pages/CustomersPage";
import { CustomerDetailPage } from "@/modules/customers/pages/CustomerDetailPage";
import { SuppliersPage } from "@/modules/suppliers/pages/SuppliersPage";
import { SupplierDetailPage } from "@/modules/suppliers/pages/SupplierDetailPage";
import { SalesOrdersPage } from "@/modules/sales-orders/pages/SalesOrdersPage";
import { SalesOrderCreatePage } from "@/modules/sales-orders/pages/SalesOrderCreatePage";
import { SalesOrderViewPage } from "@/modules/sales-orders/pages/SalesOrderViewPage";
import { DeliveryCreatePage } from "@/modules/deliveries/pages/DeliveryCreatePage";
import { DeliveriesPage } from "@/modules/deliveries/pages/DeliveriesPage";
import { DeliveryViewPage } from "@/modules/deliveries/pages/DeliveryViewPage";
import { AccountsReceivablePage } from "@/modules/accounts-receivable/pages/AccountsReceivablePage";
import { AccountsPayablePage } from "@/modules/accounts-payable/pages/AccountsPayablePage";
import { BusinessExpensesPage } from "@/modules/expenses/pages/BusinessExpensesPage";
import { PaymentTermsPage } from "@/modules/payment-terms/pages/PaymentTermsPage";
import { CustomerPaymentsPage } from "@/modules/customer-payments/pages/CustomerPaymentsPage";
import { CustomerReturnRmaPage } from "@/modules/customer-returns/pages/CustomerReturnRmaPage";
import { CustomerReturnCreatePage } from "@/modules/customer-returns/pages/CustomerReturnCreatePage";
import { QuotationCreatePage } from "@/modules/quotations/pages/QuotationCreatePage";
import { QuotationsPage } from "@/modules/quotations/pages/QuotationsPage";
import { QuotationViewPage } from "@/modules/quotations/pages/QuotationViewPage";
import { PurchaseOrdersPage } from "@/modules/purchase-orders/pages/PurchaseOrdersPage";
import { PurchaseOrderCreatePage } from "@/modules/purchase-orders/pages/PurchaseOrderCreatePage";
import { PurchaseOrderViewPage } from "@/modules/purchase-orders/pages/PurchaseOrderViewPage";
import { ProfitAndLossPage } from "@/modules/reports/pages/ProfitAndLossPage";
import { SalesAndPurchaseAnalysisPage } from "@/modules/reports/pages/SalesAndPurchaseAnalysisPage";
import { InventoryMovementAnalysisPage } from "@/modules/reports/pages/InventoryMovementAnalysisPage";
import { SettingsPage } from "@/modules/settings/pages/SettingsPage";
import { ActivityLogsPage } from "@/modules/settings/pages/ActivityLogsPage";
import { PdfViewerPage } from "@/modules/pdf-viewer/pages/PdfViewerPage";
import { ProfilePage } from "@/modules/profile/pages/ProfilePage";
import { ForbiddenPage } from "@/modules/errors/pages/ForbiddenPage";
import { PayslipsPage } from "@/modules/payslips/pages/PayslipsPage";
import { TenantSubscriptionPage } from "@/modules/tenant/pages/TenantSubscriptionPage";
import { TenantSettingsPage } from "@/modules/tenant/pages/TenantSettingsPage";
import { BranchManagementPage } from "@/modules/tenant/pages/BranchManagementPage";

function withPermission(element, config = {}) {
  if (!config.permission && !(Array.isArray(config.permissions) && config.permissions.length > 0)) {
    return element;
  }

  return <PermissionRoute {...config}>{element}</PermissionRoute>;
}

export function AppRouter() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tenant/subscription" element={<TenantSubscriptionPage />} />
          <Route path="/tenant/settings" element={withPermission(<TenantSettingsPage />, { permission: "tenant.profile.view" })} />
          <Route path="/tenant/branches" element={withPermission(<BranchManagementPage />, { permission: "branches.view" })} />
          <Route path="/assistant" element={withPermission(<AssistantPage />, { permission: "customers.view" })} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
          <Route path="/admin/employees" element={withPermission(<EmployeesPage />, { permission: "employees.view" })} />
          <Route path="/admin/agent-operations" element={<AgentPerformancePage />} />
          <Route path="/admin/agents/performance" element={<Navigate to="/admin/agent-operations" replace />} />
          <Route path="/admin/agent-operations/agents/:id/history" element={<AgentHistoryPage />} />
          <Route path="/admin/agents/:id/history" element={<AgentHistoryPage />} />
          <Route path="/admin/users" element={withPermission(<UsersPage />, { permission: "users.view" })} />
          <Route path="/admin/permissions" element={withPermission(<PermissionsPage />, { permission: "users.permissions.manage" })} />
          <Route path="/categories" element={withPermission(<CategoriesPage />, { permission: "categories.view" })} />
          <Route path="/products" element={withPermission(<ProductsPage />, { permission: "products.view" })} />
          <Route path="/trucks" element={withPermission(<TrucksPage />, { permission: "trucks.view" })} />
          <Route path="/master-data/categories" element={<Navigate to="/categories" replace />} />
          <Route path="/master-data/products" element={<Navigate to="/products" replace />} />
          <Route path="/master-data/trucks" element={<Navigate to="/trucks" replace />} />
          <Route path="/inventory" element={withPermission(<InventoryPage />, { permission: "products.view" })} />
          <Route path="/stock-movement-logs" element={withPermission(<StockMovementLogsPage />, { permission: "inventory.viewLogs" })} />
          <Route path="/stock-adjustments" element={withPermission(<StockAdjustmentsPage />, { permissions: ["view_stock_adjustments", "inventory.viewLogs"], requireAny: true })} />
          <Route path="/stock-adjustments/create" element={withPermission(<StockAdjustmentCreatePage />, { permissions: ["create_stock_adjustments", "inventory.adjust"], requireAny: true })} />
          <Route path="/stock-adjustments/:id" element={withPermission(<StockAdjustmentViewPage />, { permissions: ["view_stock_adjustments", "inventory.viewLogs"], requireAny: true })} />
          <Route path="/stock-adjustments/:id/edit" element={withPermission(<StockAdjustmentEditPage />, { permissions: ["edit_stock_adjustments", "inventory.adjust"], requireAny: true })} />
          <Route path="/admin/inventory/stock-adjustments" element={<Navigate to="/stock-adjustments" replace />} />
          <Route path="/admin/inventory/stock-adjustments/create" element={<Navigate to="/stock-adjustments/create" replace />} />
          <Route path="/customer-return-rma" element={withPermission(<CustomerReturnRmaPage />, { permission: "customerReturns.view" })} />
          <Route path="/admin/customer-returns" element={withPermission(<CustomerReturnRmaPage />, { permission: "customerReturns.view" })} />
          <Route path="/admin/customer-returns/create" element={withPermission(<CustomerReturnCreatePage />, { permission: "customerReturns.create" })} />
          <Route path="/customers" element={withPermission(<CustomersPage />, { permission: "customers.view" })} />
          <Route path="/customers/:id" element={withPermission(<CustomerDetailPage />, { permission: "customers.view" })} />
          <Route path="/suppliers" element={withPermission(<SuppliersPage />, { permission: "suppliers.view" })} />
          <Route path="/suppliers/:id" element={withPermission(<SupplierDetailPage />, { permission: "suppliers.view" })} />
          <Route path="/sales-orders" element={withPermission(<SalesOrdersPage />, { permission: "salesOrders.view" })} />
          <Route path="/sales-orders/create" element={withPermission(<SalesOrderCreatePage />, { permission: "salesOrders.create" })} />
          <Route path="/sales-orders/:id/edit" element={withPermission(<SalesOrderCreatePage />, { permission: "salesOrders.update" })} />
          <Route path="/sales-orders/:id" element={withPermission(<SalesOrderViewPage />, { permission: "salesOrders.view" })} />
          <Route path="/quotations" element={withPermission(<QuotationsPage />, { permission: "quotations.view" })} />
          <Route path="/quotations/create" element={withPermission(<QuotationCreatePage />, { permission: "quotations.create" })} />
          <Route path="/quotations/:id/edit" element={withPermission(<QuotationCreatePage />, { permission: "quotations.update" })} />
          <Route path="/quotations/:id" element={withPermission(<QuotationViewPage />, { permission: "quotations.view" })} />
          <Route path="/purchase-orders" element={withPermission(<PurchaseOrdersPage />, { permission: "purchaseOrders.view" })} />
          <Route path="/purchase-orders/create" element={withPermission(<PurchaseOrderCreatePage />, { permission: "purchaseOrders.create" })} />
          <Route path="/purchase-orders/:id/edit" element={withPermission(<PurchaseOrderCreatePage />, { permission: "purchaseOrders.update" })} />
          <Route path="/purchase-orders/:id" element={withPermission(<PurchaseOrderViewPage />, { permission: "purchaseOrders.view" })} />
          <Route path="/deliveries" element={withPermission(<DeliveriesPage />, { permission: "deliveries.view" })} />
          <Route path="/deliveries/create" element={withPermission(<DeliveryCreatePage />, { permission: "deliveries.create" })} />
          <Route path="/deliveries/:id/edit" element={withPermission(<DeliveryCreatePage />, { permission: "deliveries.update" })} />
          <Route path="/deliveries/:id" element={withPermission(<DeliveryViewPage />, { permission: "deliveries.view" })} />
          <Route path="/inventory/movement-logs" element={<Navigate to="/stock-movement-logs" replace />} />
          <Route path="/inventory/adjustments" element={<Navigate to="/stock-adjustments" replace />} />
          <Route path="/inventory/customer-rma" element={<Navigate to="/customer-return-rma" replace />} />
          <Route path="/returns/customer-rma" element={<Navigate to="/customer-return-rma" replace />} />
          <Route path="/payment-terms" element={withPermission(<PaymentTermsPage />, { permission: "paymentTerms.view" })} />
          <Route path="/accounts-receivable" element={<AccountsReceivablePage />} />
          <Route path="/customer-collections" element={withPermission(<CustomerPaymentsPage />, { permission: "payments.view" })} />
          <Route path="/customer-payments" element={<Navigate to="/customer-collections" replace />} />
          <Route path="/accounts-payable" element={withPermission(<AccountsPayablePage />, { permission: "accountsPayable.view" })} />
          <Route path="/business-expenses" element={withPermission(<BusinessExpensesPage />, { permission: "businessExpenses.view" })} />
          <Route path="/reports/profit-and-loss" element={<ProfitAndLossPage />} />
          <Route path="/reports/sales-and-purchase-analysis" element={<SalesAndPurchaseAnalysisPage />} />
          <Route path="/reports/inventory-movement-analysis" element={<InventoryMovementAnalysisPage />} />
          <Route path="/admin/settings" element={withPermission(<SettingsPage />, { permission: "settings.view" })} />
          <Route path="/admin/settings/:tab" element={withPermission(<SettingsPage />, { permission: "settings.view" })} />
          <Route path="/admin/activity-logs" element={withPermission(<ActivityLogsPage />, { permission: "activity_logs.view" })} />
          <Route path="/admin/payslips" element={withPermission(<PayslipsPage />, { permission: "payslips.view" })} />
          <Route path="/pdf-viewer" element={<PdfViewerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
