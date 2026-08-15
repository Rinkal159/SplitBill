import React, { useState } from "react";
import { useEffect } from "react";
import api from "../../api/axios";
import { Link } from "react-router-dom";
import Navbar from "../../layout/Navbar";
import { Outlet } from "react-router-dom";

function ProtectedResetPassword() {
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const verify_reset_token = async () => {
      try {
        const response = await api.get("/auth/verify-reset-token");
        setValid(true);
      } catch (error) {
        setValid(false);
      } finally {
        setLoading(false);
      }
    };

    verify_reset_token();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return valid ? (
    <Outlet />
  ) : (
    <div>
      <Navbar />
      <div className="flex min-h-[70vh] flex-col items-center mt-8 px-6 text-center">
        <h1 className="text-xl font-medium tracking-tight text-slate-800">
          Oops! You've not verified email
        </h1>

        <p className="mt-2 max-w-sm text-sm text-slate-400">
          Please verify your email with OTP to reset password.
        </p>

        <Link to="/forgot-password" className="btn py-2 px-6 m-4 !w-auto">
          Verify
        </Link>
      </div>
    </div>
  );
}

export default ProtectedResetPassword;
