import React, { useEffect, useState } from "react";
import Navbar from "../../layout/Navbar";
import api from "../../api/axios";
import Error from "../error/Error";
import { useNavigate } from "react-router-dom";

function ForgotPassword() {
  const [cont, setCont] = useState({
    email: "",
    otp: "",
  });

  const [errors, setErrors] = useState({
    email: "",
  });

  const [pageErrors, setPageErrors] = useState([]);

  const [submittedEmail, setSubmittedEmail] = useState(false);

  const [timer, setTimer] = useState(0);

  const navigate = useNavigate();

  const handleErrorsChange = (field, value) => {
    setErrors((prevErrors) => ({
      ...prevErrors,
      [field]: value,
    }));
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    setCont((prevCont) => ({
      ...prevCont,
      email: value,
    }));

    if (!value) {
      handleErrorsChange("email", "");
    } else if (!emailRegex.test(value)) {
      handleErrorsChange("email", "Please enter a valid email");
    } else {
      handleErrorsChange("email", "");
    }
  };

  const call_route = async (route) => {
    try {
      setSubmittedEmail(true);
      setTimer(60);
      const response = await api.post(route, {
        email: cont.email,
      });
      return response;
    } catch (error) {
      setPageErrors({
        type: error.response?.status,
        error: [error.response?.data.error],
      });
    }
  };

  const handleVerifyEmail = async () => {
    await call_route("/auth/forgot-password");
  };

  const handleResendOTPClick = async () => {
    await call_route("/auth/fogot-passsword/resend");
  };

  useEffect(() => {
    if (timer <= 0) return;

    const timerInterval = setInterval(() => {
      setTimer((prevTimer) => prevTimer - 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [timer]);

  const handleOTPChange = (e) => {
    const value = e.target.value;

    setCont((prevCont) => ({
      ...prevCont,
      otp: value,
    }));
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    try {
      const response = await api.post("/auth/verify-otp", cont);
      return navigate("/reset-password");
    } catch (error) {
      setPageErrors([error.response?.data.error]);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <hr />

      <div className="flex justify-center">
        {/* Left Column — Login Form */}
        <div className="w-full sm:w-1/2 lg:w-1/3 m-8 flex justify-center lg:px-0 px-6 py-10 lg:py-16 bg-white border border-blue-100/60 shadow-xl shadow-blue-100/80 bg-gradient-to-br from-blue-50/60 via-white to-blue-50/60">
          <div className="mb-8 place-self-center text-center">
            <h2 className="text-2xl font-normal text-slate-800 tracking-tight">
              Forgot password
            </h2>

            <form className="w-full max-w-xl space-y-5 mt-6">
              {Object.keys(pageErrors).length !== 0 && (
                <Error errors={pageErrors} />
              )}

              {/* Email */}
              <div className="space-y-1.5 grid grid-cols-[1fr_7rem] items-center">
                <input
                  disabled={submittedEmail}
                  className="form-input !rounded-none !rounded-tl-lg !rounded-bl-lg disabled:text-slate-400"
                  type="email"
                  id="email"
                  name="email"
                  value={cont.email}
                  autoComplete="off"
                  required
                  placeholder="Your email"
                  onChange={(e) => handleEmailChange(e)}
                />

                <button
                  type="button"
                  onClick={handleVerifyEmail}
                  disabled={!cont.email || errors.email || submittedEmail}
                  className="!py-2.5 !my-0 rounded-tr-lg rounded-br-lg bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 text-white font-medium px-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-md hover:shadow-lg hover:shadow-sky-300/40"
                >
                  Verify
                </button>
              </div>

              {errors.email && (
                <div className="text-xs text-red-500 font-medium !mt-1 place-self-start">
                  {errors.email}
                </div>
              )}

              {/* OTP */}
              {submittedEmail && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[1fr_7rem] items-center">
                    <input
                      className="form-input !rounded-none !rounded-tl-lg !rounded-bl-lg disabled:text-slate-400"
                      type="text"
                      id="otp"
                      name="otp"
                      value={cont.otp}
                      autoComplete="off"
                      required
                      placeholder="OTP"
                      autoFocus
                      onChange={(e) => handleOTPChange(e)}
                    />

                    <button
                      type="button"
                      onClick={handleResendOTPClick}
                      disabled={timer > 0}
                      className="!py-2.5 !my-0 rounded-tr-lg rounded-br-lg bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 text-white font-medium px-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-md hover:shadow-lg hover:shadow-sky-300/40"
                    >
                      Resend&nbsp;OTP
                    </button>
                  </div>

                  {timer > 0 && (
                    <p className="text-sm text-slate-600">
                      You can request new OTP in{" "}
                      <span className="font-medium text-slate-700">
                        {timer}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {submittedEmail && (
                <button
                  type="submit"
                  onClick={handleVerifyOTP}
                  disabled={!cont.otp || errors.otp}
                  className="btn !w-auto px-4 py-2.5 !mt-4"
                >
                  Verify&nbsp;OTP
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
