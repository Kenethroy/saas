import express from "express";
import { agentPerformanceRoutes } from "#modules/agent-performance/agent-performance.routes";
import { env } from "#config/env";
import { errorHandler, notFoundHandler } from "#shared/middleware/error.middleware";
import { corsMiddleware } from "#shared/middleware/cors.middleware";
import { requestLogger } from "#shared/middleware/request-logger.middleware";
import { getUploadsRootPath } from "#shared/utils/uploads";
import { resolveRequestIp } from "#shared/utils/request-ip";
import { authRoutes } from "#modules/auth/auth.routes";
import { activityLogsRoutes } from "#modules/activity-logs/activity-logs.routes";
import { employeesRoutes } from "#modules/employees/employees.routes";
import { dashboardRoutes } from "#modules/dashboard/dashboard.routes";
import { usersRoutes } from "#modules/users/users.routes";
import { customersRoutes } from "#modules/customers/customers.routes";
import { suppliersRoutes } from "#modules/suppliers/suppliers.routes";
import { productsRoutes } from "#modules/products/products.routes";
import { categoriesRoutes } from "#modules/categories/categories.routes";
import { permissionsRoutes } from "#modules/permissions/permissions.routes";
import { purchaseOrdersRoutes } from "#modules/purchase-orders/purchase-orders.routes";
import { salesOrdersRoutes } from "#modules/sales-orders/sales-orders.routes";
import { inventoryRoutes } from "#modules/inventory/inventory.routes";
import { stockAdjustmentsRoutes } from "#modules/stock-adjustments/stock-adjustments.routes";
import { trucksRoutes } from "#modules/trucks/trucks.routes";
import { deliveriesRoutes } from "#modules/deliveries/deliveries.routes";
import { accountsPayableRoutes } from "#modules/accounts-payable/accounts-payable.routes";
import { accountsReceivableRoutes } from "#modules/accounts-receivable/accounts-receivable.routes";
import { paymentTermsRoutes } from "#modules/payment-terms/payment-terms.routes";
import { paymentsRoutes } from "#modules/payments/payments.routes";
import { customerReturnsRoutes } from "#modules/customer-returns/customer-returns.routes";
import { businessExpensesRoutes } from "#modules/business-expenses/business-expenses.routes";
import { quotationsRoutes } from "#modules/quotations/quotations.routes";
import { reportsRoutes } from "#modules/reports/reports.routes";
import { settingsRoutes } from "#modules/settings/settings.routes";
import { searchRoutes } from "#modules/search/search.routes";
import { payslipsRoutes } from "#modules/payslips/payslips.routes";
import { assistantRoutes } from "#modules/assistant/assistant.routes";
import { platformAuthRoutes } from "#modules/platform-auth/platform-auth.routes";
import { platformAccountsRoutes } from "#modules/platform-auth/platform-accounts.routes";
import { onboardingRoutes } from "#modules/onboarding/onboarding.routes";
import { subscriptionsRoutes } from "#modules/subscriptions/subscriptions.routes";
import { billingRoutes } from "#modules/billing/billing.routes";
import { tenantsRoutes } from "#modules/tenants/tenants.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.TRUST_PROXY_HOPS > 0) {
    app.set("trust proxy", env.TRUST_PROXY_HOPS);
  }
  app.use(corsMiddleware);
  app.use(express.json({
    limit: "10mb",
    verify: (req, _res, buffer) => {
      req.rawBody = buffer.toString("utf8");
    }
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(env.UPLOADS_BASE_PATH, express.static(getUploadsRootPath()));

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "success",
      message: "JRSPC Node (Raw SQL) API is running",
      data: {
        env: env.APP_ENV,
        timezone: "Asia/Manila",
        requestIp: resolveRequestIp(req),
        timestamp: new Date().toISOString()
      }
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/activity/logs", activityLogsRoutes);
  app.use("/api/agent-performance", agentPerformanceRoutes);
  app.use("/api/business-expenses", businessExpensesRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/employees", employeesRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/suppliers", suppliersRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/categories", categoriesRoutes);
  app.use("/api", permissionsRoutes);
  app.use("/api/auth/access", permissionsRoutes);
  app.use("/api/purchase-orders", purchaseOrdersRoutes);
  app.use("/api/sales-orders", salesOrdersRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/stock-adjustments", stockAdjustmentsRoutes);
  app.use("/api/trucks", trucksRoutes);
  app.use("/api/deliveries", deliveriesRoutes);
  app.use("/api/accounts-payable", accountsPayableRoutes);
  app.use("/api/accounts-receivable", accountsReceivableRoutes);
  app.use("/api/payment-terms", paymentTermsRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/payslips", payslipsRoutes);
  app.use("/api/customer-returns", customerReturnsRoutes);
  app.use("/api/quotations", quotationsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/assistant", assistantRoutes);
  app.use("/platform/auth", platformAuthRoutes);
  app.use("/platform/accounts", platformAccountsRoutes);
  app.use("/platform/onboarding", onboardingRoutes);
  app.use("/platform/tenants", tenantsRoutes);
  app.use("/platform", subscriptionsRoutes);
  app.use("/platform", billingRoutes);
  app.use("/api/platform/auth", platformAuthRoutes);
  app.use("/api/platform/accounts", platformAccountsRoutes);
  app.use("/api/platform/onboarding", onboardingRoutes);
  app.use("/api/platform/tenants", tenantsRoutes);
  app.use("/api/platform", subscriptionsRoutes);
  app.use("/api/platform", billingRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
