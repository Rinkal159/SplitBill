import React, { use, useState } from "react";
import { useNavigate } from "react-router-dom";
import Error from "../error/Error";
import { Link } from "react-router-dom";
import Navbar from "../../layout/Navbar";
import api from "../../api/axios";
import LabelAndInput from "./LabelAndInput";
import RedirectLinks from "./RedirectLinks";

function Login() {
  const [person, setPerson] = new useState({
    email: "",
    password: "",
  });

  const [pageErrors, setPageErrors] = new useState({});

  const [loading, setLoading] = new useState(false);

  const navigate = useNavigate();

  const handleChange = (e, field) => {
    setPerson((prevPerson) => ({
      ...prevPerson,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post("/auth/login", person);
      return navigate("/dashboard");
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
        {/* Left Column — Login Form */}
        <div className="w-full sm:w-1/2 lg:w-1/3 max-w-lg m-8 flex justify-center lg:px-0 px-6 py-10 lg:py-16 bg-white border border-blue-100/60 shadow-xl shadow-blue-100/80 bg-gradient-to-br from-blue-50/60 via-white to-blue-50/60">
          <div>
            <div className="mb-8 place-self-center text-center">
              <h2 className="text-2xl font-normal text-slate-800 tracking-tight">
                Log into your
                {/* <br /> */}
                <span className="font-medium bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 bg-clip-text text-transparent drop-shadow-sm p-2">
                  SplitBill account
                </span>
              </h2>
              <p className="mt-2 text-sm text-slate-400 max-w-xs ">
                Pick up where you left off.
              </p>
            </div>

            <form
              className="w-full max-w-xs space-y-5 "
              onSubmit={handleSubmit}
            >
              {Object.keys(pageErrors).length !== 0 && (
                <Error errors={pageErrors.error} type={pageErrors.type} />
              )}

              {/* Email */}
              <LabelAndInput
                field={"email"}
                labelValue={"Email"}
                type={"email"}
                person={person}
                placeholder={"Your email"}
                handleEvent={(e) => handleChange(e, "email")}
                showError={false}
              />

              {/* Password */}
              <LabelAndInput
                field={"password"}
                labelValue={"Password"}
                type={"password"}
                person={person}
                placeholder={"Yourpassword"}
                handleEvent={(e) => handleChange(e, "password")}
                showError={false}
              />

              <Link
                className="text-sky-600 text-md block !my-2"
                to={"/forgot-password"}
              >
                Forgot password?
              </Link>

              {/* Submit Button */}
              <button
                disabled={!person.email || !person.password || loading}
                className="btn"
                type="submit"
              >
                {loading ? "Login..." : "Login"}
              </button>

              {/* <Link className="text-sky-600 text-md block !my-4 py-3 mt-2 border-2 rounded-xl border-blue-100 text-center" to={"/forgot-password"}>Forgot password?</Link> */}

              {/* Signup link */}
              <RedirectLinks
                message={"Don't have an account?"}
                path={"/signup"}
                value={"Signup"}
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
