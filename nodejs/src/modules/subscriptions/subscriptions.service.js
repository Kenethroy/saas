import { SubscriptionsRepository } from "#modules/subscriptions/subscriptions.repository";

export class SubscriptionsService {
  constructor(repository = new SubscriptionsRepository()) {
    this.repository = repository;
  }

  async listPlans() {
    return this.repository.listActivePlans();
  }
}
