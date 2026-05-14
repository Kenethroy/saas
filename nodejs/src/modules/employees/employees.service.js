import { AppError } from "#shared/utils/app-error";
import { EmployeesRepository } from "#modules/employees/employees.repository";

function normalizeEmployee(record) {
  return {
    id: Number(record.id),
    firstName: record.firstName,
    lastName: record.lastName,
    position: record.position,
    phone: record.phone,
    email: record.email,
    status: record.status,
    address: record.address,
    licenseNumber: record.licenseNumber,
    licenseExpiry: record.licenseExpiry,
    emergencyContactName: record.emergencyContactName,
    emergencyContactPhone: record.emergencyContactPhone,
    dateHired: record.dateHired,
    salaryRate: record.salaryRate ? Number(record.salaryRate) : 0,
    rateType: record.rateType === "Per_Trip" ? "Per Trip" : record.rateType,
    sssNo: record.sssNo,
    tinNo: record.tinNo,
    philhealthNo: record.philhealthNo,
    pagibigNo: record.pagibigNo,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    user: record.user
      ? {
          id: Number(record.user.id),
          username: record.user.username,
          email: record.user.email,
          role: record.user.role,
          status: record.user.status
        }
      : null
  };
}

function mapEmployeeInput(payload, context = {}) {
  const mapped = {};

  if (payload.firstName !== undefined) mapped.firstName = payload.firstName;
  if (payload.lastName !== undefined) mapped.lastName = payload.lastName;
  if (payload.position !== undefined) mapped.position = payload.position;
  if (payload.phone !== undefined) mapped.phone = payload.phone;
  if (payload.email !== undefined) mapped.email = payload.email;
  if (payload.status !== undefined) mapped.status = payload.status;
  if (payload.address !== undefined) mapped.address = payload.address;
  if (payload.licenseNumber !== undefined) mapped.licenseNumber = payload.licenseNumber;
  if (payload.licenseExpiry !== undefined) mapped.licenseExpiry = payload.licenseExpiry ? new Date(payload.licenseExpiry) : null;
  if (payload.emergencyContactName !== undefined) mapped.emergencyContactName = payload.emergencyContactName;
  if (payload.emergencyContactPhone !== undefined) mapped.emergencyContactPhone = payload.emergencyContactPhone;
  if (payload.dateHired !== undefined) mapped.dateHired = payload.dateHired ? new Date(payload.dateHired) : null;
  if (payload.salaryRate !== undefined) mapped.salaryRate = parseFloat(payload.salaryRate ?? 0);
  if (payload.rateType !== undefined) mapped.rateType = payload.rateType === "Per Trip" ? "Per_Trip" : payload.rateType;
  if (payload.sssNo !== undefined) mapped.sssNo = payload.sssNo;
  if (payload.tinNo !== undefined) mapped.tinNo = payload.tinNo;
  if (payload.philhealthNo !== undefined) mapped.philhealthNo = payload.philhealthNo;
  if (payload.pagibigNo !== undefined) mapped.pagibigNo = payload.pagibigNo;
  if (context.includeCreatedIp) mapped.createdIp = context.ipAddress ?? null;
  if (context.includeUpdatedIp) mapped.updatedIp = context.ipAddress ?? null;

  return mapped;
}

export class EmployeesService {
  constructor(repository = new EmployeesRepository()) {
    this.repository = repository;
  }

  async list(filters) {
    const { rows, total } = await this.repository.findPaginated({
      page: filters.page,
      perPage: filters.perPage,
      search: filters.search,
      position: filters.position,
      status: filters.status,
      excludeUsers: filters.excludeUsers
    });

    return {
      data: rows.map(normalizeEmployee),
      meta: {
        currentPage: filters.page,
        perPage: filters.perPage,
        total,
        lastPage: Math.ceil(total / filters.perPage) || 1
      }
    };
  }

  async getById(id) {
    const employee = await this.repository.findById(id);

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    return normalizeEmployee(employee);
  }

  async create(payload, context = {}) {
    try {
      const employee = await this.repository.create(
        mapEmployeeInput(payload, {
          includeCreatedIp: true,
          includeUpdatedIp: true,
          ipAddress: context.ipAddress ?? null
        })
      );
      return {
        id: Number(employee.id)
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async update(id, payload, context = {}) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError("Employee not found", 404);
    }

    if (existing.user?.role === "admin") {
      throw new AppError("Employees linked to admin accounts are protected and cannot be modified here", 403);
    }

    try {
      await this.repository.update(
        id,
        mapEmployeeInput(payload, {
          includeUpdatedIp: true,
          ipAddress: context.ipAddress ?? null
        })
      );
      return this.getById(id);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async delete(id, context = {}) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError("Employee not found", 404);
    }

    if (existing.user?.role === "admin") {
      throw new AppError("Employees linked to admin accounts are protected and cannot be deleted", 403);
    }

    await this.repository.update(id, {
      deleteFlag: true,
      updatedIp: context.ipAddress ?? null
    });
  }

  handleDatabaseError(error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("Employee email already exists", 409);
    }

    throw error;
  }
}
