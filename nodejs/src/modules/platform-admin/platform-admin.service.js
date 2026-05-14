import bcrypt from "bcryptjs";
import { AppError } from "#shared/utils/app-error";
import { signAccessToken } from "#shared/auth/jwt";
import { PlatformAuthRepository } from "#modules/platform-auth/platform-auth.repository";
import { PlatformAdminRepository } from "#modules/platform-admin/platform-admin.repository";

function normalizeAccount(account, roles) {
  return {
    id: Number(account.id),
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    status: account.status,
    roles: roles ?? []
  };
}

export class PlatformAdminService {
  constructor(
    authRepository = new PlatformAuthRepository(),
    repository = new PlatformAdminRepository()
  ) {
    this.authRepository = authRepository;
    this.repository = repository;
  }

  async login(payload) {
    const account = await this.authRepository.findAccountByEmail(payload.credential);
    if (!account || !["pending", "active"].includes(account.status)) {
      throw new AppError("Invalid credentials", 401);
    }

    const matches = await bcrypt.compare(payload.password, String(account.passwordHash ?? "").trim());
    if (!matches) {
      throw new AppError("Invalid credentials", 401);
    }

    const roles = await this.authRepository.listActiveRolesByAccountId(account.id);
    if (!roles.length) {
      throw new AppError("Forbidden", 403);
    }

    await this.authRepository.touchLastLogin(account.id);

    const token = signAccessToken({
      scope: "platform",
      accountId: Number(account.id)
    });

    return {
      token,
      account: normalizeAccount(account, roles)
    };
  }

  async currentAccount(accountId) {
    const account = await this.authRepository.findAccountById(accountId);
    if (!account || !["pending", "active"].includes(account.status)) {
      throw new AppError("Unauthenticated", 401);
    }

    const roles = await this.authRepository.listActiveRolesByAccountId(account.id);
    if (!roles.length) {
      throw new AppError("Forbidden", 403);
    }

    return {
      account: normalizeAccount(account, roles)
    };
  }

  async listTenants(query) {
    const filters = {
      q: query.q,
      status: query.status,
      subscriptionStatus: query.subscriptionStatus
    };

    const paging = {
      page: query.page,
      perPage: query.perPage
    };

    const total = await this.repository.countTenants(filters);
    const items = await this.repository.listTenants(filters, paging);

    return {
      items,
      page: paging.page,
      perPage: paging.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / paging.perPage))
    };
  }
}

