import { PaymentsService } from "#modules/payments/payments.service";
import { PaymentScannerService } from "#modules/payments/payment-scanner.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class PaymentsController {
  constructor(service = new PaymentsService(), scannerService = new PaymentScannerService()) {
    this.service = service;
    this.scannerService = scannerService;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(req.query, {
        tenantId: req.auth?.user?.tenantId ?? null,
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(successResponse({
        message: "Payments retrieved successfully",
        data: result.data,
        meta: result.meta
      }));
    } catch (error) {
      next(error);
    }
  };

  createCustomerPayment = async (req, res, next) => {
    try {
      const data = await this.service.createCustomerPayment(req.body, {
        tenantId: req.auth?.user?.tenantId ?? null,
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req),
        fileUrl: req.uploadedFileUrl ?? null,
        userId: req.auth?.user?.id ?? null
      });

      res.status(201).json(successResponse({
        message: "Customer payment recorded successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };

  createSupplierPayment = async (req, res, next) => {
    try {
      const data = await this.service.createSupplierPayment(req.body, {
        tenantId: req.auth?.user?.tenantId ?? null,
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req),
        fileUrl: req.uploadedFileUrl ?? null,
        userId: req.auth?.user?.id ?? null
      });

      res.status(201).json(successResponse({
        message: "Supplier payment recorded successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };

  accountsPayableHistory = async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.getAccountsPayableHistory(id, {
        tenantId: req.auth?.user?.tenantId ?? null,
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(successResponse({
        message: "Accounts payable payment history retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };

  scanReceipt = async (req, res, next) => {
    try {
      const parsed = await this.scannerService.extractFromBuffer(req.file?.buffer);
      res.status(200).json(parsed);
    } catch (error) {
      next(error);
    }
  };
}
