import { AccountsReceivableService } from "#modules/accounts-receivable/accounts-receivable.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class AccountsReceivableController {
  constructor(service = new AccountsReceivableService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId;
      const result = await this.service.list(tenantId, req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId;
      const data = await this.service.getById(tenantId, req.params.id);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId;
      const data = await this.service.update(req.params.id, req.body, {
        tenantId,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json({
        success: true,
        message: "Accounts Receivable updated successfully",
        data
      });
    } catch (error) {
      next(error);
    }
  };
}
