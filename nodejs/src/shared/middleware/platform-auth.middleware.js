import { verifyAccessToken } from "#shared/auth/jwt";
import { PlatformAuthRepository } from "#modules/platform-auth/platform-auth.repository";

function extractBearerToken(header) {
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : String(header).trim();
}

const repository = new PlatformAuthRepository();

export async function authenticatePlatformAccount(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    const payload = verifyAccessToken(token);
    if (payload?.scope !== "platform" || !payload?.accountId) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    const account = await repository.findAccountById(payload.accountId);
    if (!account || !["pending", "active"].includes(account.status)) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    req.auth = {
      ...(req.auth ?? {}),
      token,
      account: {
        id: Number(account.id),
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        status: account.status
      }
    };

    next();
  } catch (_error) {
    return res.status(401).json({
      message: "Unauthenticated"
    });
  }
}
