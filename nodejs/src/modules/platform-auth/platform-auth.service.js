import bcrypt from "bcryptjs";
import { AppError } from "#shared/utils/app-error";
import { signAccessToken } from "#shared/auth/jwt";
import { PlatformAuthRepository } from "#modules/platform-auth/platform-auth.repository";
import { OnboardingRepository } from "#modules/onboarding/onboarding.repository";

function normalizeAccount(account) {
  return {
    id: Number(account.id),
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    status: account.status,
    emailVerifiedAt: account.emailVerifiedAt,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

export class PlatformAuthService {
  constructor(
    repository = new PlatformAuthRepository(),
    onboardingRepository = new OnboardingRepository()
  ) {
    this.repository = repository;
    this.onboardingRepository = onboardingRepository;
  }

  async register(payload) {
    const existing = await this.repository.findAccountByEmail(payload.email);
    if (existing) {
      throw new AppError("Account email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const account = await this.repository.createAccount({
      ...payload,
      passwordHash
    });

    return this.buildAuthResponse(account);
  }

  async login(payload) {
    const account = await this.repository.findAccountByEmail(payload.credential);
    if (!account || !["pending", "active"].includes(account.status)) {
      throw new AppError("Invalid credentials", 401);
    }

    const matches = await bcrypt.compare(payload.password, String(account.passwordHash ?? "").trim());
    if (!matches) {
      throw new AppError("Invalid credentials", 401);
    }

    await this.repository.touchLastLogin(account.id);
    const refreshedAccount = await this.repository.findAccountById(account.id);

    return this.buildAuthResponse(refreshedAccount ?? account);
  }

  async currentAccount(accountId) {
    const account = await this.repository.findAccountById(accountId);
    if (!account || !["pending", "active"].includes(account.status)) {
      throw new AppError("Unauthenticated", 401);
    }

    await this.onboardingRepository.ensureOnboardingRecord(account.id);

    return {
      account: normalizeAccount(account),
      onboarding: await this.onboardingRepository.findStatusByAccountId(account.id)
    };
  }

  async buildAuthResponse(account) {
    await this.onboardingRepository.ensureOnboardingRecord(account.id);

    const token = signAccessToken({
      scope: "platform",
      accountId: Number(account.id)
    });

    return {
      token,
      account: normalizeAccount(account),
      onboarding: await this.onboardingRepository.findStatusByAccountId(account.id)
    };
  }
}
