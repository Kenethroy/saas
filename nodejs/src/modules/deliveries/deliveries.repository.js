import { query, transaction } from "#shared/database/mysql";
import { deliverSalesOrder } from "#modules/sales-orders/sales-orders.delivery";
import { AppError } from "#shared/utils/app-error";
import { allocateDocumentNumber } from "#shared/utils/document-sequences";

export class DeliveriesRepository {
  async findPaginated(tenantId, { page, perPage, search, status, salesOrderId, dateFrom, dateTo, branchId = null }) {
    const offset = (page - 1) * perPage;

    let sql = `
      FROM deliveries d
      LEFT JOIN employees e ON d.driver_id = e.id AND e.tenant_id = d.tenant_id
      LEFT JOIN trucks t ON d.truck_id = t.id AND t.tenant_id = d.tenant_id
      WHERE d.tenant_id = ? AND d.delete_flg = 0
    `;
    const params = [tenantId];

    if (search) {
      sql += " AND (d.delivery_number LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ? OR t.plate_number LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (status) {
      sql += " AND d.status = ?";
      params.push(status);
    }

    if (dateFrom) {
      sql += " AND d.delivery_date >= ?";
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += " AND d.delivery_date <= ?";
      params.push(dateTo);
    }

    if (salesOrderId) {
      sql += " AND EXISTS (SELECT 1 FROM delivery_sales_orders dl WHERE dl.tenant_id = d.tenant_id AND dl.delivery_id = d.id AND dl.sales_order_id = ?)";
      params.push(salesOrderId);
    }

    if (branchId) {
      sql += " AND d.branch_id = ?";
      params.push(Number(branchId));
    }

    const countSql = `SELECT COUNT(*) as total ${sql}`;
    const dataSql = `
      SELECT d.*, e.first_name as driver_first_name, e.last_name as driver_last_name, 
             e.phone as driver_phone, e.email as driver_email,
             t.plate_number as truck_plate_number, t.model as truck_model
      ${sql}
      ORDER BY d.delivery_date DESC, d.id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, perPage, offset];

    const [countRows, rows] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams)
    ]);

    const formattedRows = await Promise.all(rows.map(async row => {
      const links = await query(`
        SELECT dl.*, so.sales_order_number, so.total_amount, c.name as customer_name
        FROM delivery_sales_orders dl
        JOIN sales_orders so ON dl.sales_order_id = so.id AND so.tenant_id = dl.tenant_id
        JOIN customers c ON so.customer_id = c.id AND c.tenant_id = dl.tenant_id
        WHERE dl.tenant_id = ? AND dl.delivery_id = ?
        ORDER BY dl.sequence_order ASC, dl.id ASC
      `, [tenantId, row.id]);

      return {
        ...row,
        id: row.id,
        deliveryNumber: row.delivery_number,
        driverId: row.driver_id,
        truckId: row.truck_id,
        deliveryDate: row.delivery_date,
        driver: row.driver_id ? {
          id: row.driver_id,
          firstName: row.driver_first_name,
          lastName: row.driver_last_name,
          phone: row.driver_phone,
          email: row.driver_email
        } : null,
        truck: row.truck_id ? {
          id: row.truck_id,
          plateNumber: row.truck_plate_number,
          model: row.truck_model
        } : null,
        salesOrders: links.map(link => ({
          ...link,
          id: link.id,
          salesOrderId: link.sales_order_id,
          sequenceOrder: link.sequence_order,
          totalAmount: Number(link.total_amount ?? 0),
          salesOrder: {
            salesOrderNumber: link.sales_order_number,
            totalAmount: Number(link.total_amount ?? 0),
            customer: { name: link.customer_name }
          }
        }))
      };
    }));

    return { rows: formattedRows, total: countRows[0].total };
  }

  async findById(tenantId, id) {
    const sql = `
      SELECT d.*, e.first_name as driver_first_name, e.last_name as driver_last_name, 
             e.phone as driver_phone, e.email as driver_email,
             t.plate_number as truck_plate_number, t.model as truck_model
      FROM deliveries d
      LEFT JOIN employees e ON d.driver_id = e.id AND e.tenant_id = d.tenant_id
      LEFT JOIN trucks t ON d.truck_id = t.id AND t.tenant_id = d.tenant_id
      WHERE d.tenant_id = ? AND d.id = ? AND d.delete_flg = 0
      LIMIT 1
    `;
    const rows = await query(sql, [tenantId, id]);
    if (!rows[0]) return null;

    const row = rows[0];
    const links = await query(`
      SELECT dl.*, so.sales_order_number, so.total_amount,
             c.name as customer_name, c.address as customer_address,
             c.phone as customer_phone, c.email as customer_email
      FROM delivery_sales_orders dl
      JOIN sales_orders so ON dl.sales_order_id = so.id AND so.tenant_id = dl.tenant_id
      JOIN customers c ON so.customer_id = c.id AND c.tenant_id = dl.tenant_id
      WHERE dl.tenant_id = ? AND dl.delivery_id = ?
      ORDER BY dl.sequence_order ASC, dl.id ASC
    `, [tenantId, id]);

    const salesOrderIds = links.map(link => link.sales_order_id);
    const itemsBySalesOrderId = new Map();

    if (salesOrderIds.length) {
      const placeholders = salesOrderIds.map(() => "?").join(", ");
      const itemRows = await query(`
        SELECT * FROM sales_order_items
        WHERE tenant_id = ? AND sales_order_id IN (${placeholders})
        ORDER BY sales_order_id ASC, id ASC
      `, [tenantId, ...salesOrderIds]);

      itemRows.forEach((item) => {
        const existingItems = itemsBySalesOrderId.get(item.sales_order_id) ?? [];
        existingItems.push(item);
        itemsBySalesOrderId.set(item.sales_order_id, existingItems);
      });
    }

    const formattedLinks = links.map((link) => {
      const items = itemsBySalesOrderId.get(link.sales_order_id) ?? [];

      return {
        ...link,
        id: link.id,
        salesOrderId: link.sales_order_id,
        sequenceOrder: link.sequence_order,
        totalAmount: Number(link.total_amount ?? 0),
        customerName: link.customer_name,
        customerAddress: link.customer_address,
        customerPhone: link.customer_phone,
        customerEmail: link.customer_email,
        salesOrder: {
          salesOrderNumber: link.sales_order_number,
          totalAmount: Number(link.total_amount ?? 0),
          customer: {
            name: link.customer_name,
            address: link.customer_address,
            phone: link.customer_phone,
            email: link.customer_email
          },
          items: items.map(item => ({
            ...item,
            id: item.id,
            productName: item.product_name,
            variantName: item.variant_name,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price ?? 0),
            lineTotal: Number(item.line_total ?? 0),
            subtotal: Number(item.line_total ?? 0)
          }))
        }
      };
    });

    return {
      ...row,
      id: row.id,
      deliveryNumber: row.delivery_number,
      driverId: row.driver_id,
      truckId: row.truck_id,
      deliveryDate: row.delivery_date,
      driver: row.driver_id ? {
        id: row.driver_id,
        firstName: row.driver_first_name,
        lastName: row.driver_last_name,
        phone: row.driver_phone,
        email: row.driver_email
      } : null,
      truck: row.truck_id ? {
        id: row.truck_id,
        plateNumber: row.truck_plate_number,
        model: row.truck_model
      } : null,
      salesOrders: formattedLinks
    };
  }

  async findLatestDelivery(tenantId) {
    const rows = await query("SELECT * FROM deliveries WHERE tenant_id = ? ORDER BY id DESC LIMIT 1", [tenantId]);
    return rows[0] || null;
  }

  async findSalesOrdersForSelection(tenantId, { branchId = null } = {}) {
    let sql = `
      SELECT so.*, c.name as customer_name
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id AND c.tenant_id = so.tenant_id
      WHERE so.tenant_id = ? AND so.delete_flg = 0 AND so.status = 'processing'
        AND NOT EXISTS (
          SELECT 1 FROM delivery_sales_orders dl
          JOIN deliveries d ON dl.delivery_id = d.id AND d.tenant_id = dl.tenant_id
          WHERE dl.tenant_id = so.tenant_id AND dl.sales_order_id = so.id AND d.delete_flg = 0 AND d.status <> 'cancelled'
        )
    `;
    const params = [tenantId];
    if (branchId) {
      sql += " AND so.branch_id = ?";
      params.push(Number(branchId));
    }
    sql += " ORDER BY so.order_date DESC, so.id DESC";
    const rows = await query(sql, params);
    return rows.map(row => ({
      ...row,
      id: row.id,
      salesOrderNumber: row.sales_order_number,
      customer: { name: row.customer_name }
    }));
  }

  async findActiveEmployees(tenantId, filters = {}) {
    let sql = "SELECT id, first_name as firstName, last_name as lastName, position, phone FROM employees WHERE tenant_id = ? AND delete_flg = 0 AND status = 'active'";
    const params = [tenantId];
    if (filters.position) {
      sql += " AND position = ?";
      params.push(filters.position);
    }
    sql += " ORDER BY first_name ASC, last_name ASC";
    return query(sql, params);
  }

  async findTrucksForAssignment(tenantId) {
    return query(
      "SELECT id, plate_number as plateNumber, model FROM trucks WHERE tenant_id = ? AND delete_flg = 0 AND status = 'active' ORDER BY plate_number ASC",
      [tenantId]
    );
  }

  async assertAssignableResources(tenantId, payload, options = {}) {
    const salesOrderIds = Array.isArray(payload.salesOrderIds) ? payload.salesOrderIds.map(Number) : [];
    const uniqueSalesOrderIds = [...new Set(salesOrderIds)];
    const excludeDeliveryId = options.excludeDeliveryId ? Number(options.excludeDeliveryId) : null;

    if (salesOrderIds.length !== uniqueSalesOrderIds.length) {
      throw new AppError("Duplicate sales orders are not allowed in a delivery.", 422);
    }

    if (payload.driverId) {
      const driverRows = await query(
        "SELECT id FROM employees WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 'active' LIMIT 1",
        [tenantId, Number(payload.driverId)]
      );
      if (!driverRows[0]) {
        throw new AppError("Driver not found.", 404);
      }
    }

    if (payload.truckId) {
      const truckRows = await query(
        "SELECT id FROM trucks WHERE tenant_id = ? AND id = ? AND delete_flg = 0 AND status = 'active' LIMIT 1",
        [tenantId, Number(payload.truckId)]
      );
      if (!truckRows[0]) {
        throw new AppError("Truck not found.", 404);
      }
    }

    if (!uniqueSalesOrderIds.length) {
      return;
    }

    const orderRows = await query(
      "SELECT id, status FROM sales_orders WHERE tenant_id = ? AND id IN (?) AND delete_flg = 0",
      [tenantId, uniqueSalesOrderIds]
    );

    if (orderRows.length !== uniqueSalesOrderIds.length) {
      throw new AppError("One or more sales orders were not found.", 404);
    }

    const currentDeliveryRows = excludeDeliveryId
      ? await query(
          "SELECT sales_order_id FROM delivery_sales_orders WHERE tenant_id = ? AND delivery_id = ?",
          [tenantId, excludeDeliveryId]
        )
      : [];
    const currentDeliveryOrderIds = new Set(currentDeliveryRows.map((row) => Number(row.sales_order_id)));

    const conflictingLinks = await query(`
      SELECT dl.sales_order_id
      FROM delivery_sales_orders dl
      JOIN deliveries d ON dl.delivery_id = d.id AND d.tenant_id = dl.tenant_id
      WHERE dl.tenant_id = ?
        AND dl.sales_order_id IN (?)
        AND d.delete_flg = 0
        AND d.status <> 'cancelled'
        ${excludeDeliveryId ? "AND d.id <> ?" : ""}
    `, excludeDeliveryId ? [tenantId, uniqueSalesOrderIds, excludeDeliveryId] : [tenantId, uniqueSalesOrderIds]);

    if (conflictingLinks.length > 0) {
      throw new AppError("One or more sales orders are already assigned to another active delivery.", 409);
    }

    for (const order of orderRows) {
      if (order.status === "processing") continue;
      if (order.status === "for_delivery" && currentDeliveryOrderIds.has(Number(order.id))) continue;
      throw new AppError("Only processing sales orders can be assigned to a delivery.", 422);
    }
  }

  async createWithLinks(deliveryData, links) {
    return transaction(async (tx) => {
      let effectiveBranchId = deliveryData.branchId ? Number(deliveryData.branchId) : null;
      if (!effectiveBranchId) {
        const [branchRows] = await tx.execute(
          `
            SELECT id
            FROM branches
            WHERE tenant_id = ?
              AND is_primary = 1
            LIMIT 1
          `,
          [Number(deliveryData.tenantId)]
        );
        effectiveBranchId = branchRows[0]?.id ? Number(branchRows[0].id) : null;
      }

      const deliveryNumber = deliveryData.deliveryNumber || await allocateDocumentNumber({
        tenantId: deliveryData.tenantId,
        branchId: effectiveBranchId,
        documentType: "delivery",
        at: deliveryData.deliveryDate,
        tx
      });

      const [dResult] = await tx.execute(`
        INSERT INTO deliveries (
          tenant_id, branch_id, delivery_number, driver_id, truck_id, delivery_date, status, notes, created_ip, updated_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        deliveryData.tenantId, effectiveBranchId, deliveryNumber, deliveryData.driverId || null,
        deliveryData.truckId || null, deliveryData.deliveryDate, deliveryData.status || 'pending',
        deliveryData.notes || null, deliveryData.createdIp || null, deliveryData.updatedIp || null
      ]);

      const deliveryId = dResult.insertId;

      for (const link of links) {
        await tx.execute(`
          INSERT INTO delivery_sales_orders (tenant_id, delivery_id, sales_order_id, sequence_order)
          VALUES (?, ?, ?, ?)
        `, [deliveryData.tenantId, deliveryId, link.salesOrderId, link.sequenceOrder]);

        // Update Sales Order status to for_delivery
        await tx.execute("UPDATE sales_orders SET status = 'for_delivery' WHERE tenant_id = ? AND id = ?", [deliveryData.tenantId, link.salesOrderId]);
      }

      return deliveryId;
    }).then(id => this.findById(deliveryData.tenantId, id));
  }

  async updateWithLinks(tenantId, id, deliveryData, links) {
    return transaction(async (tx) => {
      // Revert old sales orders to processing
      const [oldLinks] = await tx.execute("SELECT sales_order_id FROM delivery_sales_orders WHERE tenant_id = ? AND delivery_id = ?", [tenantId, id]);
      for (const oldLink of oldLinks) {
        await tx.execute("UPDATE sales_orders SET status = 'processing' WHERE tenant_id = ? AND id = ? AND status = 'for_delivery'", [tenantId, oldLink.sales_order_id]);
      }

      await tx.execute("DELETE FROM delivery_sales_orders WHERE tenant_id = ? AND delivery_id = ?", [tenantId, id]);

      await tx.execute(`
        UPDATE deliveries SET
          driver_id = ?, truck_id = ?, delivery_date = ?, notes = ?, updated_ip = ?
        WHERE tenant_id = ? AND id = ?
      `, [
        deliveryData.driverId || null, deliveryData.truckId || null,
        deliveryData.deliveryDate, deliveryData.notes || null, deliveryData.updatedIp || null, tenantId, id
      ]);

      for (const link of links) {
        await tx.execute(`
          INSERT INTO delivery_sales_orders (tenant_id, delivery_id, sales_order_id, sequence_order)
          VALUES (?, ?, ?, ?)
        `, [tenantId, id, link.salesOrderId, link.sequenceOrder]);

        await tx.execute("UPDATE sales_orders SET status = 'for_delivery' WHERE tenant_id = ? AND id = ?", [tenantId, link.salesOrderId]);
      }
    }).then(() => this.findById(tenantId, id));
  }

  async updateStatus(tenantId, id, status, ipAddress) {
    return transaction(async (tx) => {
      await tx.execute("UPDATE deliveries SET status = ?, updated_ip = ? WHERE tenant_id = ? AND id = ?", [status, ipAddress, tenantId, id]);

      if (status === "cancelled") {
        const [links] = await tx.execute("SELECT sales_order_id FROM delivery_sales_orders WHERE tenant_id = ? AND delivery_id = ?", [tenantId, id]);
        for (const link of links) {
          await tx.execute("UPDATE sales_orders SET status = 'processing' WHERE tenant_id = ? AND id = ? AND status = 'for_delivery'", [tenantId, link.sales_order_id]);
        }
      } else if (status === "delivered") {
        const [links] = await tx.execute("SELECT sales_order_id FROM delivery_sales_orders WHERE tenant_id = ? AND delivery_id = ?", [tenantId, id]);
        for (const link of links) {
          await tx.execute("UPDATE sales_orders SET status = 'delivered' WHERE tenant_id = ? AND id = ?", [tenantId, link.sales_order_id]);
        }
      }
    }).then(() => this.findById(tenantId, id));
  }

  async softDelete(tenantId, id, ipAddress) {
    return transaction(async (tx) => {
      const [links] = await tx.execute("SELECT sales_order_id FROM delivery_sales_orders WHERE tenant_id = ? AND delivery_id = ?", [tenantId, id]);
      for (const link of links) {
        await tx.execute("UPDATE sales_orders SET status = 'processing' WHERE tenant_id = ? AND id = ? AND status = 'for_delivery'", [tenantId, link.sales_order_id]);
      }
      await tx.execute("UPDATE deliveries SET delete_flg = 1, updated_ip = ? WHERE tenant_id = ? AND id = ?", [ipAddress, tenantId, id]);
    });
  }

  async updateStatusAndDeliver(tenantId, id, status, context = {}) {
    const ipAddress = context.ipAddress ?? null;
    const userId = context.userId ?? null;
    const recipientName = context.recipientName?.trim() || null;
    const deliveryNotes = context.deliveryNotes?.trim() || null;
    const completionDetails = Array.isArray(context.completionDetails) ? context.completionDetails : null;

    await transaction(async (tx) => {
      await tx.execute("UPDATE deliveries SET status = ?, updated_ip = ?, completion_time = NOW() WHERE tenant_id = ? AND id = ?", [status, ipAddress, tenantId, id]);
      const [links] = await tx.execute("SELECT sales_order_id FROM delivery_sales_orders WHERE tenant_id = ? AND delivery_id = ?", [tenantId, id]);
      const detailBySalesOrderId = new Map(
        (completionDetails ?? []).map((detail) => [
          Number(detail.salesOrderId),
          {
            recipientName: detail.recipientName?.trim() || null,
            deliveryNotes: detail.deliveryNotes?.trim() || null
          }
        ])
      );

      if (completionDetails?.length) {
        if (completionDetails.length !== links.length) {
          throw new AppError("Delivery completion details must be provided for each linked sales order.", 422);
        }

        for (const link of links) {
          if (!detailBySalesOrderId.has(Number(link.sales_order_id))) {
            throw new AppError("Delivery completion details do not match the linked sales orders.", 422);
          }
        }
      }

      for (const link of links) {
        const detail = detailBySalesOrderId.get(Number(link.sales_order_id)) ?? {
          recipientName,
          deliveryNotes
        };

        await tx.execute(
          "UPDATE delivery_sales_orders SET delivery_status = 'delivered', delivered_at = NOW(), recipient_name = ?, delivery_notes = ? WHERE tenant_id = ? AND delivery_id = ? AND sales_order_id = ?",
          [detail.recipientName, detail.deliveryNotes, tenantId, id, link.sales_order_id]
        );
      }

      for (const link of links) {
        await deliverSalesOrder(tx, link.sales_order_id, { tenantId, ipAddress, userId });
      }
    });

    return this.findById(tenantId, id);
  }
}
