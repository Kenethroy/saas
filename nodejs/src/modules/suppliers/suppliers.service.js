import { suppliersRepository } from "#modules/suppliers/suppliers.repository";
import { AppError } from "#shared/utils/app-error";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

export const suppliersService = {
  async getAllSuppliers(filters) {
    const scopedTenantId = requireTenantId(filters.tenantId);
    const { page = 1, limit = 10, search, status } = filters;
    const skip = (page - 1) * limit;

    let parsedStatus;
    if (status !== undefined && status !== "") {
      parsedStatus = parseInt(status, 10);
    }

    const { items, total } = await suppliersRepository.findAll({
      tenantId: scopedTenantId,
      search,
      status: parsedStatus,
      skip,
      take: limit
    });

    return {
      data: items.map(item => ({
        ...item,
        paymentTermsName: item.paymentTerm?.name || null
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  async getSupplierById(tenantId, id) {
    const supplier = await suppliersRepository.findById(requireTenantId(tenantId), id);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    return supplier;
  },

  async getSupplierDetails(tenantId, id) {
    const scopedTenantId = requireTenantId(tenantId);
    const supplier = await this.getSupplierById(scopedTenantId, id);
    const statistics = await suppliersRepository.getStatistics(scopedTenantId, id);

    return {
      data: {
        supplier,
        statistics
      }
    };
  },

  async createSupplier(tenantId, data, clientIp) {
    const scopedTenantId = requireTenantId(tenantId);
    const existingName = await suppliersRepository.findByName(scopedTenantId, data.name);
    if (existingName) {
      throw new AppError("Supplier name already exists", 400);
    }

    if (data.paymentTermId) {
      const paymentTerm = await suppliersRepository.findPaymentTermById(scopedTenantId, data.paymentTermId);
      if (!paymentTerm) {
        throw new AppError("Payment term not found", 404);
      }
    }

    const supplierData = {
      tenantId: scopedTenantId,
      ...data,
      createdIp: clientIp,
      updatedIp: clientIp
    };

    return await suppliersRepository.create(supplierData);
  },

  async updateSupplier(tenantId, id, data, clientIp) {
    const scopedTenantId = requireTenantId(tenantId);
    const supplier = await suppliersRepository.findById(scopedTenantId, id);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    if (data.name) {
      const existingName = await suppliersRepository.findByName(scopedTenantId, data.name, id);
      if (existingName) {
        throw new AppError("Supplier name already exists", 400);
      }
    }

    if (data.paymentTermId) {
      const paymentTerm = await suppliersRepository.findPaymentTermById(scopedTenantId, data.paymentTermId);
      if (!paymentTerm) {
        throw new AppError("Payment term not found", 404);
      }
    }

    const updateData = {
      ...data,
      updatedIp: clientIp
    };

    return await suppliersRepository.update(scopedTenantId, id, updateData);
  },

  async updateSupplierStatus(tenantId, id, status, clientIp) {
    const scopedTenantId = requireTenantId(tenantId);
    const supplier = await suppliersRepository.findById(scopedTenantId, id);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    return await suppliersRepository.update(scopedTenantId, id, {
      status,
      updatedIp: clientIp
    });
  },

  async deleteSupplier(tenantId, id, clientIp) {
    const scopedTenantId = requireTenantId(tenantId);
    const supplier = await suppliersRepository.findById(scopedTenantId, id);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    await suppliersRepository.softDelete(scopedTenantId, id, clientIp);
    return { success: true, message: "Supplier deleted successfully" };
  }
};
