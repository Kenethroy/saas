import { PayslipsService } from "#modules/payslips/payslips.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class PayslipsController {
  constructor(service = new PayslipsService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const result = await this.service.list(tenantId, req.query);
      res.status(200).json(successResponse({
        message: "Payslips retrieved successfully",
        data: result.data,
        meta: result.meta
      }));
    } catch (error) {
      next(error);
    }
  };

  show = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const payslip = await this.service.show(tenantId, req.params.id);
      if (!payslip) {
        return res.status(404).json({ message: "Payslip not found" });
      }
      res.status(200).json(successResponse({
        message: "Payslip retrieved successfully",
        data: payslip
      }));
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const payslip = await this.service.create(req.body, {
        tenantId: req.auth?.user?.tenantId ?? null,
        ipAddress: getPersistedRequestIp(req),
        userId: req.auth?.user?.id ?? null
      });
      res.status(201).json(successResponse({
        message: "Payslip created successfully",
        data: payslip
      }));
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const payslip = await this.service.update(tenantId, req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req),
        userId: req.auth?.user?.id ?? null
      });
      res.status(200).json(successResponse({
        message: "Payslip updated successfully",
        data: payslip
      }));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      await this.service.delete(tenantId, req.params.id, {
        ipAddress: getPersistedRequestIp(req),
        userId: req.auth?.user?.id ?? null
      });
      res.status(200).json(successResponse({
        message: "Payslip deleted successfully",
        data: { success: true }
      }));
    } catch (error) {
      next(error);
    }
  };

  pdf = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const payslip = await this.service.show(tenantId, req.params.id);
      if (!payslip) {
        return res.status(404).json({ message: "Payslip not found" });
      }

      const { createPayslipPdf } = await import("#modules/payslips/payslip-pdf");
      const buffer = await createPayslipPdf(payslip);
      const pdfBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${payslip.payslip_number || `payslip-${payslip.id}`}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}

