import multer from "multer";
import path from "node:path";
import {
  buildPaymentUploadUrl,
  buildProductUploadUrl,
  buildSystemUploadUrl,
  getPaymentsUploadsDirectoryPath,
  getProductsUploadsDirectoryPath,
  getSystemUploadsDirectoryPath
} from "#shared/utils/uploads";

const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);
const extensionMap = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp"
};

const productImageStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, getProductsUploadsDirectoryPath());
  },
  filename: (req, file, callback) => {
    const extension = extensionMap[file.mimetype] ?? path.extname(file.originalname) ?? ".jpg";
    const filename = `product_${Math.random().toString(16).slice(2, 14)}_${Date.now()}${extension}`;
    req.uploadedFileUrl = buildProductUploadUrl(filename);
    callback(null, filename);
  }
});

const paymentProofStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, getPaymentsUploadsDirectoryPath());
  },
  filename: (req, file, callback) => {
    const extension = extensionMap[file.mimetype] ?? path.extname(file.originalname) ?? ".jpg";
    const filename = `payment_${Math.random().toString(16).slice(2, 14)}_${Date.now()}${extension}`;
    req.uploadedFileUrl = buildPaymentUploadUrl(filename);
    callback(null, filename);
  }
});

const systemLogoStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, getSystemUploadsDirectoryPath());
  },
  filename: (req, file, callback) => {
    const extension = extensionMap[file.mimetype] ?? path.extname(file.originalname) ?? ".jpg";
    const filename = `system_${Math.random().toString(16).slice(2, 14)}_${Date.now()}${extension}`;
    req.uploadedFileUrl = buildSystemUploadUrl(filename);
    callback(null, filename);
  }
});

function imageFileFilter(_req, file, callback) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "image"));
    return;
  }

  callback(null, true);
}

const upload = multer({
  storage: productImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: imageFileFilter
});

const paymentUpload = multer({
  storage: paymentProofStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: imageFileFilter
});

const paymentScanUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: imageFileFilter
});

const systemLogoUpload = multer({
  storage: systemLogoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: imageFileFilter
});

export const uploadProductImage = upload.single("image");
export const uploadPaymentProof = paymentUpload.single("proof_image");
export const uploadPaymentScanImage = paymentScanUpload.single("payment_image");
export const uploadSystemLogo = systemLogoUpload.single("logo");
