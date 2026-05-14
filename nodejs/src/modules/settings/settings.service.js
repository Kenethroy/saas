import bcrypt from "bcryptjs";
import { SettingsRepository } from "#modules/settings/settings.repository";
import { UsersRepository } from "#modules/users/users.repository";
import { AppError } from "#shared/utils/app-error";
import { toPublicFileUrl, toStoredUploadPath } from "#shared/utils/uploads";
import { ActivityLogsService } from "#modules/activity-logs/activity-logs.service";

export class SettingsService {
  constructor(
    repository = new SettingsRepository(),
    usersRepository = new UsersRepository(),
    activityLogs = new ActivityLogsService()
  ) {
    this.repository = repository;
    this.usersRepository = usersRepository;
    this.activityLogs = activityLogs;
  }

  async getSettings() {
    const settings = await this.repository.findAll();
    
    const result = {
      general: {},
      notifications: {},
      security: {},
      system: {}
    };

    settings.forEach(s => {
      const category = s.category || 'general';
      if (!result[category]) result[category] = {};
      
      if (s.key === 'system_logo' && s.value) {
        result[category][s.key] = toPublicFileUrl(s.value);
      } else {
        result[category][s.key] = s.value;
      }
    });

    return result;
  }

  async saveSettings(payload, context = {}) {
    if (!Array.isArray(payload)) {
      throw new AppError('Payload must be an array of settings', 400);
    }

    const normalizedPayload = payload.map(item => {
      if (item.key === 'system_logo' && item.value) {
        return { ...item, value: toStoredUploadPath(item.value) };
      }
      return item;
    });

    await this.repository.upsertMany(normalizedPayload);

    await this.activityLogs.log({
      userId: context.userId || null,
      action: 'UPDATE',
      module: 'SETTINGS',
      description: `Updated system configuration settings`,
      metadata: { count: payload.length },
      ipAddress: context.ipAddress || null
    });

    return true;
  }

  async getPublicSettings() {
    const settings = await this.repository.findByCategory('general');
    const result = {};
    settings.forEach(s => {
      if (['company_name', 'company_short_name', 'system_logo'].includes(s.key)) {
        result[s.key] = s.key === 'system_logo' ? toPublicFileUrl(s.value) : s.value;
      }
    });
    return result;
  }

  async updateLogoSetting(url, context = {}) {
    await this.repository.upsertMany([
      { key: 'system_logo', value: toStoredUploadPath(url), category: 'general' }
    ]);

    await this.activityLogs.log({
      userId: context.userId || null,
      action: 'UPDATE',
      module: 'SETTINGS',
      description: `Updated system branding logo`,
      ipAddress: context.ipAddress || null
    });

    return true;
  }

  async changePassword(userId, currentPassword, newPassword, context = {}) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new AppError('Current password is incorrect', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(userId, { passwordHash });

    await this.activityLogs.log({
      userId,
      action: 'UPDATE',
      module: 'SECURITY',
      description: `User successfully reset their administrative password`,
      ipAddress: context.ipAddress || null
    });

    return true;
  }
}
