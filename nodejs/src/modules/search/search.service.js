import { SearchRepository } from "#modules/search/search.repository";
import { getUserPermissionSlugs } from "#shared/permissions/policy";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function joinParts(parts = []) {
  return parts.filter(Boolean).join(" • ");
}

function toDisplayLabel(value) {
  return String(value ?? "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export class SearchService {
  constructor(repository = new SearchRepository()) {
    this.repository = repository;
  }

  async globalSearch({ query, limit, user }) {
    const normalizedQuery = String(query ?? "").trim();

    if (normalizedQuery.length < 2) {
      return {
        query: normalizedQuery,
        groups: [],
        totalResults: 0
      };
    }

    const likeValue = `%${normalizedQuery}%`;
    const permissions = user?.role === "admin"
      ? null
      : new Set(await getUserPermissionSlugs(user.id, user.role));
    const groups = [];

    if (this.canAccess(user, permissions, "customers.view")) {
      const rows = await this.repository.searchCustomers(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "customers",
          label: "Customers",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.name || row.company || "Customer",
            subtitle: joinParts([row.company, row.email]),
            meta: row.phone || null,
            targetType: "customer"
          }))
        });
      }
    }

    if (this.canAccess(user, permissions, "products.view")) {
      const rows = await this.repository.searchProducts(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "products",
          label: "Products",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.name,
            subtitle: joinParts([row.category_name, row.matching_variants]),
            meta: Number(row.status) === 1 ? "Active" : "Inactive",
            targetType: "product",
            searchValue: row.name
          }))
        });
      }
    }

    if (this.canAccess(user, permissions, "suppliers.view")) {
      const rows = await this.repository.searchSuppliers(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "suppliers",
          label: "Suppliers",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.name,
            subtitle: joinParts([row.company_name, row.contact_person, row.email]),
            meta: row.phone || null,
            targetType: "supplier",
            searchValue: row.name
          }))
        });
      }
    }

    if (this.canAccess(user, permissions, "salesOrders.view")) {
      const rows = await this.repository.searchSalesOrders(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "sales_orders",
          label: "Sales Orders",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.sales_order_number,
            subtitle: row.customer_name || "Sales order",
            meta: formatCurrency(row.total_amount),
            targetType: "sales_order"
          }))
        });
      }
    }

    if (this.canAccess(user, permissions, "quotations.view")) {
      const rows = await this.repository.searchQuotations(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "quotations",
          label: "Quotations",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.quote_number,
            subtitle: joinParts([row.customer_name, row.contact_person]),
            meta: formatCurrency(row.total_amount),
            targetType: "quotation"
          }))
        });
      }
    }

    if (this.canAccess(user, permissions, "purchaseOrders.view")) {
      const rows = await this.repository.searchPurchaseOrders(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "purchase_orders",
          label: "Purchase Orders",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.po_number,
            subtitle: row.supplier_name || "Purchase order",
            meta: formatCurrency(row.total_amount),
            targetType: "purchase_order"
          }))
        });
      }
    }

    if (this.canAccess(user, permissions, "deliveries.view")) {
      const rows = await this.repository.searchDeliveries(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "deliveries",
          label: "Deliveries",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.delivery_number,
            subtitle: joinParts([row.driver_name, row.plate_number]),
            meta: formatDate(row.delivery_date),
            targetType: "delivery"
          }))
        });
      }
    }

    if (user) {
      const rows = await this.repository.searchAccountsReceivable(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "accounts_receivable",
          label: "Accounts Receivable",
          items: rows.map((row) => {
            const title = row.invoice_number || (Number(row.is_opening_balance) === 1 ? "Opening Balance" : `AR #${Number(row.id)}`);

            return {
              id: Number(row.id),
              title,
              subtitle: joinParts([row.customer_name, row.customer_company]),
              meta: joinParts([formatCurrency(row.outstanding_amount), toDisplayLabel(row.status)]),
              targetType: "accounts_receivable",
              searchValue: row.invoice_number || row.customer_name || title
            };
          })
        });
      }
    }

    if (this.canAccess(user, permissions, "payments.view")) {
      const rows = await this.repository.searchPayments(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "customer_collections",
          label: "Customer Collections",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.payment_number,
            subtitle: joinParts([row.customer_name, row.customer_company, row.reference_number || row.invoice_number || row.sales_order_number]),
            meta: joinParts([formatCurrency(row.amount), formatDate(row.payment_date)]),
            targetType: "customer_collection",
            searchValue: row.payment_number || row.reference_number || row.customer_name
          }))
        });
      }
    }

    if (this.canAccess(user, permissions, "customerReturns.view")) {
      const rows = await this.repository.searchCustomerReturns(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "customer_returns",
          label: "Customer Returns",
          items: rows.map((row) => ({
            id: Number(row.id),
            title: row.rma_number,
            subtitle: joinParts([row.customer_name, row.customer_company, row.invoice_number || null, row.reason]),
            meta: joinParts([formatCurrency(row.total_amount), toDisplayLabel(row.status)]),
            targetType: "customer_return",
            searchValue: row.rma_number || row.invoice_number || row.customer_name
          }))
        });
      }
    }

    if (this.canAccess(user, permissions, "users.view")) {
      const rows = await this.repository.searchUsers(likeValue, limit);
      if (rows.length > 0) {
        groups.push({
          key: "users",
          label: "Users",
          items: rows.map((row) => {
            const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();

            return {
              id: Number(row.id),
              title: fullName || row.username,
              subtitle: joinParts([row.username, row.email]),
              meta: joinParts([toDisplayLabel(row.role), Number(row.status) === 1 ? "Active" : "Inactive"]),
              targetType: "user",
              searchValue: row.username || row.email || fullName
            };
          })
        });
      }
    }

    return {
      query: normalizedQuery,
      groups,
      totalResults: groups.reduce((sum, group) => sum + group.items.length, 0)
    };
  }

  canAccess(user, permissions, permission) {
    if (!user) {
      return false;
    }

    if (user.role === "admin") {
      return true;
    }

    return permissions?.has(permission) ?? false;
  }
}
