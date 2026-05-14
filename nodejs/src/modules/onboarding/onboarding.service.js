import { AppError } from "#shared/utils/app-error";
import { OnboardingRepository } from "#modules/onboarding/onboarding.repository";

export class OnboardingService {
  constructor(repository = new OnboardingRepository()) {
    this.repository = repository;
  }

  async start(accountId, payload) {
    await this.repository.ensureOnboardingRecord(accountId);
    await this.repository.start(accountId, payload.preferredSubdomain);

    const onboarding = await this.repository.findStatusByAccountId(accountId);
    if (!onboarding) {
      throw new AppError("Onboarding state not found", 404);
    }

    return onboarding;
  }

  async status(accountId, onboardingId) {
    const onboarding = await this.repository.findStatusByIdForAccount(onboardingId, accountId);
    if (!onboarding) {
      throw new AppError("Onboarding state not found", 404);
    }

    return onboarding;
  }
}
