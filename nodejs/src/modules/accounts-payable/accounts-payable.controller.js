import { AccountsPayableService } from "#modules/accounts-payable/accounts-payable.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class AccountsPayableController {
  constructor(service = new AccountsPayableService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.service.getById(req.params.id);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const data = await this.service.update(req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  };
}
