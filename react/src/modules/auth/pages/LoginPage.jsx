import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/shared/api/client";
import { useAuthStore } from "@/shared/store/auth.store";

const loginSchema = z.object({
  credential: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required")
});

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loginError, setLoginError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      credential: "admin",
      password: "ChangeMe123!"
    }
  });

  async function onSubmit(values) {
    try {
      setLoginError(null);
      const response = await apiClient.post("/api/auth/login", values);
      setAuth(response.data.data);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = error.response?.data?.message || "Invalid credentials. Please try again.";
      setLoginError(message);
    }
  }

  return (
    <>
      <div className="bg-[#2c5f8a] px-5 py-3">
        <div className="text-[14px] font-bold text-white">Welcome back</div>
        <div className="mt-0.5 text-[11px] text-[#b3d4f0]">Sign in to your account</div>
      </div>

      {loginError ? (
        <div className="erp-error-bar">
          <i className="fas fa-exclamation-circle"></i>
          <span>{loginError}</span>
        </div>
      ) : null}

      <div className="px-5 py-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="erp-label">Username or Email</label>
            <input
              {...register("credential")}
              className={`erp-input ${errors.credential ? "erp-input-error" : ""}`}
              placeholder="Enter username or email"
            />
            {errors.credential ? (
              <p className="mt-1 text-[10px] text-[#c62828]">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {errors.credential.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="erp-label">Password</label>
            <input
              {...register("password")}
              type="password"
              className={`erp-input ${errors.password ? "erp-input-error" : ""}`}
              placeholder="Enter password"
            />
            {errors.password ? (
              <p className="mt-1 text-[10px] text-[#c62828]">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <button type="submit" disabled={isSubmitting} className="erp-button-primary w-full py-2.5 text-[13px]">
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      <div className="border-t border-[#e8ecef] bg-[#f9fafc] px-5 py-2.5 text-center">
        <p className="text-[10px] text-[#90a4ae]">Use the bootstrap admin account or your assigned user credentials.</p>
      </div>
    </>
  );
}
