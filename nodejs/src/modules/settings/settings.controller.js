import { SettingsService } from "#modules/settings/settings.service";
import { successResponse } from "#shared/utils/response";
import { toPublicFileUrl } from "#shared/utils/uploads";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class SettingsController {
  constructor(service = new SettingsService()) {
    this.service = service;
  }

  getSettings = async (req, res, next) => {
    try {
      const settings = await this.service.getSettings(req.auth?.user?.tenantId);
      res.status(200).json(successResponse({
        message: 'Settings retrieved successfully',
        data: settings
      }));
    } catch (error) {
      next(error);
    }
  };

  saveSettings = async (req, res, next) => {
    try {
      const { payload } = req.body;
      const context = {
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      };
      await this.service.saveSettings(req.auth?.user?.tenantId, payload, context);
      res.status(200).json(successResponse({
        message: 'Settings saved successfully'
      }));
    } catch (error) {
      next(error);
    }
  };

  getPublicSettings = async (req, res, next) => {
    try {
      const settings = await this.service.getPublicSettings(req.auth?.tenant?.id);
      res.status(200).json(successResponse({
        message: 'Public settings retrieved successfully',
        data: settings
      }));
    } catch (error) {
      next(error);
    }
  };

  uploadLogo = async (req, res, next) => {
    try {
      const url = req.uploadedFileUrl;
      const context = {
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      };
      await this.service.updateLogoSetting(req.auth?.user?.tenantId, url, context);
      res.status(200).json(successResponse({
        message: 'Logo uploaded and saved successfully',
        data: { url: toPublicFileUrl(url) }
      }));
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req, res, next) => {
    try {
      const { current_password, new_password } = req.body;
      const userId = req.auth.user.id;
      const context = {
        userId,
        ipAddress: getPersistedRequestIp(req)
      };
      await this.service.changePassword(req.auth?.user?.tenantId, userId, current_password, new_password, context);
      res.status(200).json(successResponse({
        message: 'Password updated successfully'
      }));
    } catch (error) {
      next(error);
    }
  };
}
