import { AppError } from "#shared/utils/app-error";

export function validateRequest(schema, target = "body") {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[target]);

    if (!parsed.success) {
      return next(
        new AppError("Validation failed", 422, parsed.error.flatten())
      );
    }

    req[target] = parsed.data;
    next();
  };
}
