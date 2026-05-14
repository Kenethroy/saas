import { AccountsPayableService } from "#modules/accounts-payable/accounts-payable.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class AccountsPayableController {
  constructor(service = new AccountsPayableService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId;
      const result = await this.service.list(tenantId, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId;
      const data = await this.service.getById(tenantId, req.params.id);
      res.status(200).json(data);
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
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  };
}
