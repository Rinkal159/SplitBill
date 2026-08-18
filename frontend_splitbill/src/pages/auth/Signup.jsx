import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import axios from "axios";
import Error from "../error/Error";
import Navbar from "../../layout/Navbar";
import LabelAndInput from "./LabelAndInput";
import RedirectLinks from "./RedirectLinks";

export default function Signup() {
  const [person, setPerson] = new useState({
    name: "",
    email: "",
    mobileNumber: "",
    password: "",
  });

  const [imagePreview, setImagePreview] = new useState("../../../default.png");

  const [errors, setErrors] = new useState({
    email: "",
    mobileNumber: "",
    password: "",
  });

  const [pageErrors, setPageErrors] = new useState({});

  const [loading, setLoading] = new useState(false);

  const navigate = useNavigate();

  const handlePersonChange = (e, field) => {
    setPerson((prevPerson) => ({
      ...prevPerson,
      [field]: e.target.value,
    }));
  };

  const handleErrorsChange = (field, value) => {
    setErrors((prevErrors) => ({
      ...prevErrors,
      [field]: value,
    }));
  };

  const handleEmailChange = (e) => {
    handlePersonChange(e, "email");

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const value = e.target.value;

    if (!value) {
      handleErrorsChange("email", "");
    } else if (!emailRegex.test(value)) {
      handleErrorsChange("email", "Please enter a valid email");
    } else {
      handleErrorsChange("email", "");
    }
  };

  const handleMobileNumberChange = (e) => {
    handlePersonChange(e, "mobileNumber");

    const mobileNumberRegex = /^\d+$/;
    const value = e.target.value;

    if (!value) {
      handleErrorsChange("mobileNumber", "");
    } else if (!mobileNumberRegex.test(value)) {
      handleErrorsChange(
        "mobileNumber",
        "Only digits are allowed in mobile number",
      );
    } else if (value.length < 10) {
      handleErrorsChange("mobileNumber", "Mobile number must be 10 digits");
    } else if (value.length > 10) {
      handleErrorsChange(
        "mobileNumber",
        "Mobile number cannot exceed 10 digits",
      );
    } else {
      handleErrorsChange("mobileNumber", "");
    }
  };

  const handlePasswordChange = (e) => {
    handlePersonChange(e, "password");

    const value = e.target.value;

    if (!value) {
      handleErrorsChange("password", "");
    } else if (value.length < 8) {
      handleErrorsChange(
        "password",
        "Password must be at least 8 characters long",
      );
    } else {
      handleErrorsChange("password", "");
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];

    setPerson((prevPerson) => ({
      ...prevPerson,
      profilePicture: file,
    }));

    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (errors.email || errors.mobileNumber || errors.password) {
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      person.profilePicture &&
        formData.append("profilePicture", person.profilePicture);
      formData.append("name", person.name);
      formData.append("email", person.email);
      formData.append("mobile_number", person.mobileNumber);
      formData.append("password", person.password);

      const response = await axios.post(
        "http://localhost:8000/api/auth/signup",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return navigate("/login");
    } catch (error) {
      setLoading(false);
      setPageErrors({
        type: error.response?.status,
        error: [error.response?.data.error],
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <hr />

      <div className="flex justify-center">
        {/* Left Column — Signup Form */}
        <div className="w-1/2 m-8 flex items-start justify-center lg:px-0 px-6 py-10 lg:py-16 bg-white border border-blue-100/60 shadow-xl shadow-blue-100/90 bg-gradient-to-br from-blue-50/60 via-white to-blue-50/60">
          <div className="w-full max-w-md">
            <div className="mb-8 place-self-center text-center">
              <h2 className="text-2xl font-normal text-slate-800 tracking-tight">
                Create your
                {/* <br /> */}
                <span className="heading-shadow p-2">
                  SplitBill account
                </span>
              </h2>
              <p className="mt-2 text-sm text-slate-400 max-w-xs ">
                Start splitting expenses with friends.
              </p>
            </div>

            <form className="space-y-5 " onSubmit={handleFormSubmit}>
              {Object.keys(pageErrors).length !== 0 && (
                <Error errors={pageErrors.error} type={pageErrors.type} />
              )}

              {/* Profile picture */}
              <div className="flex items-center gap-4 pb-1">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-200/80 bg-slate-50 flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <label
                    htmlFor="profilePicture"
                    className="absolute -bottom-0.5 -right-0.5 bg-white border border-slate-200 rounded-full p-1.5 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </label>
                  <input
                    type="file"
                    id="profilePicture"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 leading-none">
                    Profile picture
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Optional</p>
                </div>
              </div>

              {/* Name */}
              <LabelAndInput
                field={"name"}
                labelValue={"Name"}
                type={"text"}
                person={person}
                placeholder={"Your full name"}
                handleEvent={(e) => handlePersonChange(e, "name")}
              />

              {/* Email */}
              <LabelAndInput
                field={"email"}
                labelValue={"Email"}
                type={"email"}
                person={person}
                placeholder={"Your email"}
                handleEvent={handleEmailChange}
                showError={true}
                errors={errors}
              />

              {/* Mobile Number */}
              <LabelAndInput
                field={"mobileNumber"}
                labelValue={"Mobile number"}
                type={"text"}
                person={person}
                placeholder={"i.e. 9876543210"}
                handleEvent={handleMobileNumberChange}
                showError={true}
                errors={errors}
              />

              {/* Password */}
              <LabelAndInput
                field={"password"}
                labelValue={"Password"}
                type={"password"}
                person={person}
                placeholder={"At least 8 characters"}
                handleEvent={handlePasswordChange}
                showError={true}
                errors={errors}
              />

              {/* Submit Button */}
              <button
                disabled={
                  !person.name ||
                  !person.email ||
                  !person.mobileNumber ||
                  !person.password ||
                  errors.email ||
                  errors.mobileNumber ||
                  errors.password || 
                  loading
                }
                className="btn"
                type="submit"
              >
                {loading ? "Signing up..." : "Create account"}
              </button>

              {/* Login link */}
              <RedirectLinks message={"Already have an account?"} path={"/login"} value={"Log in"} />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
