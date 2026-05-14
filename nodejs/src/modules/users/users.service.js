import bcrypt from "bcryptjs";
import { AppError } from "#shared/utils/app-error";
import { UsersRepository } from "#modules/users/users.repository";

function normalizeUser(record) {
  return {
    id: Number(record.id),
    employeeId: record.employeeId ? Number(record.employeeId) : null,
    username: record.username,
    email: record.email,
    role: record.role,
    status: record.status,
    lastLoginAt: record.lastLoginAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    employee: record.employee
      ? {
          id: Number(record.employee.id),
          firstName: record.employee.firstName,
          lastName: record.employee.lastName,
          position: record.employee.position,
          status: record.employee.status,
          email: record.employee.email
        }
      : null
  };
}

function normalizeAvailableEmployee(record) {
  return {
    id: Number(record.id),
    firstName: record.firstName,
    lastName: record.lastName,
    position: record.position,
    email: record.email,
    status: record.status
  };
}

export class UsersService {
  constructor(repository = new UsersRepository()) {
    this.repository = repository;
  }

  async list(filters) {
    const { rows, total } = await this.repository.findPaginated({
      page: filters.page,
      perPage: filters.perPage,
      search: filters.search,
      role: filters.role,
      status: filters.status
    });

    return {
      data: rows.map(normalizeUser),
      meta: {
        currentPage: filters.page,
        perPage: filters.perPage,
        total,
        lastPage: Math.ceil(total / filters.perPage) || 1
      }
    };
  }

  async getById(id) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return normalizeUser(user);
  }

  async listAvailableEmployees(search) {
    const rows = await this.repository.findAvailableEmployees(search);
    return rows.map(normalizeAvailableEmployee);
  }

  async create(payload, context = {}) {
    if (payload.role === "admin") {
      throw new AppError("Admin accounts are not manageable from this screen", 403);
    }

    const employee = await this.repository.findEmployeeById(payload.employeeId);
    if (!employee) {
      throw new AppError("Selected employee does not exist", 422);
    }

    const existingEmployeeUser = await this.repository.findByEmployeeId(payload.employeeId);
    if (existingEmployeeUser) {
      throw new AppError("This employee already has a user account", 409);
    }

    const existingUsername = await this.repository.findByUsername(payload.username);
    if (existingUsername) {
      throw new AppError("Username already exists", 409);
    }

    const existingEmail = await this.repository.findByEmail(payload.email);
    if (existingEmail) {
      throw new AppError("Email already exists", 409);
    }

    const passwordHash = (await bcrypt.hash(payload.password, 10)).trim();

    const user = await this.repository.create({
      employeeId: payload.employeeId,
      username: payload.username,
      email: payload.email,
      passwordHash,
      role: payload.role,
      status: payload.status,
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    });

    return normalizeUser(user);
  }

  async update(id, payload, context = {}) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("User not found", 404);
    }

    if (existing.role === "admin" || payload.role === "admin") {
      throw new AppError("Admin accounts are protected and cannot be modified here", 403);
    }

    if (payload.username && payload.username !== existing.username) {
      const usernameMatch = await this.repository.findByUsername(payload.username);
      if (usernameMatch && usernameMatch.id !== existing.id) {
        throw new AppError("Username already exists", 409);
      }
    }

    if (payload.email && payload.email !== existing.email) {
      const emailMatch = await this.repository.findByEmail(payload.email);
      if (emailMatch && emailMatch.id !== existing.id) {
        throw new AppError("Email already exists", 409);
      }
    }

    const updateData = {
      username: payload.username,
      email: payload.email,
      role: payload.role,
      status: payload.status
    };

    if (payload.password) {
      updateData.passwordHash = (await bcrypt.hash(payload.password, 10)).trim();
    }

    const user = await this.repository.update(id, {
      ...updateData,
      updatedIp: context.ipAddress ?? null
    });

    return normalizeUser(user);
  }

  async delete(id, context = {}) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("User not found", 404);
    }

    if (existing.role === "admin") {
      throw new AppError("Admin accounts are protected and cannot be deleted", 403);
    }

    await this.repository.update(id, {
      deleteFlag: true,
      status: false,
      updatedIp: context.ipAddress ?? null
    });
  }
}
