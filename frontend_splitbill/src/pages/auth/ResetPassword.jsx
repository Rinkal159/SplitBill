import React, { useState } from "react";
import Navbar from "../../layout/Navbar";
import LabelAndInput from "./LabelAndInput";
import api from "../../api/axios";
import Error from "../error/Error";
import { useNavigate } from "react-router-dom";

function ResetPassword() {
  const [passwords, setPasswords] = useState({
    new_password: "",
    confirm_password: "",
  });

  const [errors, setErrors] = useState({
    new_password: "",
    confirm_password: "",
  });

  const [pageErrors, setPageErrors] = useState([]);

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e, field) => {
    setPasswords((prevPasswords) => ({
      ...prevPasswords,
      [field]: e.target.value,
    }));
  };

  const handleErrorsChange = (field, message) => {
    setErrors((prevErrors) => ({
      ...prevErrors,
      [field]: message,
    }));
  };

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;

    handleChange(e, "new_password");

    if (!value) {
      handleErrorsChange("new_password", "");
    } else if (value.length < 8) {
      handleErrorsChange(
        "new_password",
        "Password must be at least 8 characters long",
      );
    } else {
      handleErrorsChange("new_password", "");
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;

    handleChange(e, "confirm_password");

    if (!value) {
      handleErrorsChange("confirm_password", "");
    } else if (value != passwords.new_password) {
      handleErrorsChange(
        "confirm_password",
        "New password and Confirm password do not match",
      );
    } else {
      handleErrorsChange("confirm_password", "");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      
      const response = await api.post("/auth/reset-password", {
        new_password: passwords.new_password,
      });
      console.log(response);

      return navigate("/login")
    } catch (error) {
      setLoading(false);

      setPageErrors([error.response?.data.error]);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <hr />

      <div className="flex justify-center">
        {/* Left Column — Login Form */}
        <div className="w-full sm:w-1/2 lg:w-1/3 max-w-lg m-8 flex justify-center lg:px-0 px-6 py-10 lg:py-16 bg-white border border-blue-100/60 shadow-xl shadow-blue-100/80 bg-gradient-to-br from-blue-50/60 via-white to-blue-50/60">
          <div>
            <div className="mb-8 place-self-center text-center">
              <h2 className="text-2xl font-normal text-slate-800 tracking-tight">
                Reset password
              </h2>
            </div>

            <form
              className="w-full max-w-xs space-y-5 "
              onSubmit={handleSubmit}
            >
              {Object.keys(pageErrors).length !== 0 && (
                <Error errors={pageErrors.error} type={pageErrors.type} />
              )}

              {/* New password */}
              <LabelAndInput
                field={"new_password"}
                labelValue={"New password"}
                type={"password"}
                person={passwords}
                placeholder={""}
                handleEvent={handleNewPasswordChange}
                showError={true}
                errors={errors}
              />

              {/* Confirm password */}
              <LabelAndInput
                field={"confirm_password"}
                labelValue={"Confirm password"}
                type={"password"}
                person={passwords}
                placeholder={""}
                handleEvent={handleConfirmPasswordChange}
                showError={true}
                errors={errors}
              />

              {/* Submit Button */}
              <button
                disabled={
                  !passwords.new_password || !passwords.confirm_password || loading
                }
                className="btn"
                type="submit"
              >
                {loading ? "Resting password" : "Reset"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
