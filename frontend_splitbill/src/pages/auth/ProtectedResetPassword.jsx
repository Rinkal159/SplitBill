import React, { useState } from "react";
import { useEffect } from "react";
import api from "../../api/axios";
import { Link } from "react-router-dom";
import Navbar from "../../layout/Navbar";
import { Outlet } from "react-router-dom";
import getBackendError from "../../utils/getBackendError";
import Error from "../error/Error";
import Loading from "../loading/Loading";

function ProtectedResetPassword() {
  // loading
  const [loading, setLoading] = useState(true);

  // error
  const [backErrors, setBackErrors] = useState({});

  const [valid, setValid] = useState(false);

  useEffect(() => {
    const verify_reset_token = async () => {
      try {
        const response = await api.get("/auth/verify-reset-token");
        setValid(true);
      } catch (error) {
        setBackErrors(getBackendError(error));
        setValid(false);
      } finally {
        setLoading(false);
      }
    };

    verify_reset_token();
  }, []);

  if (loading) {
    return <Loading msg={"Loading"} />;
  }

  return valid ? (
    <Outlet />
  ) : (
    <div>
      <Navbar />

      {Object.keys(backErrors).length !== 0 && (
        <Error errors={backErrors.error} type={backErrors.type} />
      )}

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
