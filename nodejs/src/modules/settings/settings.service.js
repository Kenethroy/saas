import bcrypt from "bcryptjs";
import { SettingsRepository } from "#modules/settings/settings.repository";
import { UsersRepository } from "#modules/users/users.repository";
import { AppError } from "#shared/utils/app-error";
import { toPublicFileUrl, toStoredUploadPath } from "#shared/utils/uploads";
import { ActivityLogsService } from "#modules/activity-logs/activity-logs.service";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

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

  async getSettings(tenantId) {
    const scopedTenantId = requireTenantId(tenantId);
    const settings = await this.repository.findAll(scopedTenantId);
    
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

  async saveSettings(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    if (!Array.isArray(payload)) {
      throw new AppError('Payload must be an array of settings', 400);
    }

    const normalizedPayload = payload.map(item => {
      if (item.key === 'system_logo' && item.value) {
        return { ...item, value: toStoredUploadPath(item.value) };
      }
      return item;
    });

    await this.repository.upsertMany(scopedTenantId, normalizedPayload);

    await this.activityLogs.log({
      tenantId: scopedTenantId,
      userId: context.userId || null,
      action: 'UPDATE',
      module: 'SETTINGS',
      description: `Updated system configuration settings`,
      metadata: { count: payload.length },
      ipAddress: context.ipAddress || null
    });

    return true;
  }

  async getPublicSettings(tenantId) {
    const settings = await this.repository.findByCategory(requireTenantId(tenantId), 'general');
    const result = {};
    settings.forEach(s => {
      if (['company_name', 'company_short_name', 'system_logo'].includes(s.key)) {
        result[s.key] = s.key === 'system_logo' ? toPublicFileUrl(s.value) : s.value;
      }
    });
    return result;
  }

  async updateLogoSetting(tenantId, url, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    await this.repository.upsertMany(scopedTenantId, [
      { key: 'system_logo', value: toStoredUploadPath(url), category: 'general' }
    ]);

    await this.activityLogs.log({
      tenantId: scopedTenantId,
      userId: context.userId || null,
      action: 'UPDATE',
      module: 'SETTINGS',
      description: `Updated system branding logo`,
      ipAddress: context.ipAddress || null
    });

    return true;
  }

  async changePassword(tenantId, userId, currentPassword, newPassword, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const user = await this.usersRepository.findById(scopedTenantId, userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new AppError('Current password is incorrect', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(scopedTenantId, userId, { passwordHash });

    await this.activityLogs.log({
      tenantId: scopedTenantId,
      userId,
      action: 'UPDATE',
      module: 'SECURITY',
      description: `User successfully reset their administrative password`,
      ipAddress: context.ipAddress || null
    });

    return true;
  }
}
