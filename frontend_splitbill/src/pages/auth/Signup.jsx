import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Error from "../error/Error";
import Navbar from "../../layout/Navbar";
import LabelAndInput from "./LabelAndInput";
import RedirectLinks from "./RedirectLinks";
import getBackendError from "../../utils/getBackendError";
import loadGoogleIdentityServices from "../../utils/loadGoogleIdentityServices";
import { AuthContext } from "../../context/AuthProvider";
import Loading from "../loading/Loading";
import ProfilePictureInput from "./ProfilePictureInput";

export default function Signup() {
  const [person, setPerson] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    password: "",
  });
  const [imagePreview, setImagePreview] = useState("/default_profile_picture.png");

  // loading
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // errors
  const [frontErrors, setFrontErrors] = useState({
    email: "",
    mobileNumber: "",
    password: "",
  });
  const [backErrors, setBackErrors] = useState({});
  const googleButtonRef = useRef(null);

  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

  const handlePersonChange = (e, field) => {
    setBackErrors({});
    setPerson((prevPerson) => ({
      ...prevPerson,
      [field]: e.target.value,
    }));
  };

  const handleErrorsChange = (field, value) => {
    setFrontErrors((prevErrors) => ({
      ...prevErrors,
      [field]: value,
    }));
  };

  const handleEmailChange = (e) => {
    setBackErrors({});
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
    setBackErrors({});
    handlePersonChange(e, "mobileNumber");

    const value = e.target.value;
    if (!value) {
      handleErrorsChange("mobileNumber", "");
    } else if (!/^\d{10}$/.test(value)) {
      handleErrorsChange("mobileNumber", "Mobile number must be 10 digits");
    } else {
      handleErrorsChange("mobileNumber", "");
    }
  };

  const handlePasswordChange = (e) => {
    setBackErrors({});
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
    setBackErrors({});
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
    if (frontErrors.email || frontErrors.mobileNumber || frontErrors.password) {
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      person.profilePicture &&
        formData.append("profilePicture", person.profilePicture);
      formData.append("name", person.name);
      formData.append("email", person.email);
      if (person.mobileNumber) {
        formData.append("mobile_number", person.mobileNumber);
      }
      formData.append("password", person.password);

      await api.post("/auth/signup", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return navigate("/login");
    } catch (error) {
      setLoading(false);
      setBackErrors(getBackendError(error));
    }
  };

  const handleGoogleSignup = useCallback(
    async (response) => {
      if (!response?.credential) {
        setBackErrors({
          type: "501",
          error:
            "Google did not return a sign in credential. Please try again.",
        });
        return;
      }

      setBackErrors("");
      setGoogleLoading(true);

      try {
        const res = await api.post(
          "/auth/google",
          { credential: response.credential },
          { headers: { "X-Requested-With": "XMLHttpRequest" } },
        );

        const { data: user } = await api.get("/auth/me");
        setUser(user);

        return res.data.is_new_user
          ? navigate("/create", { replace: true })
          : navigate("/dashboard", { replace: true });
      } catch (error) {
        setBackErrors(getBackendError(error));
      } finally {
        setGoogleLoading(false);
      }
    },
    [navigate, setUser],
  );

  useEffect(() => {
    let cancelled = false;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setBackErrors({
        type: "501",
        error: "Google sign up is not configured for this environment.",
      });
      return undefined;
    }

    loadGoogleIdentityServices()
      .then((googleIdentity) => {
        if (cancelled || !googleButtonRef.current) return;

        googleButtonRef.current.replaceChildren();
        googleIdentity.initialize({
          client_id: clientId,
          callback: handleGoogleSignup,
          use_fedcm_for_button: true,
        });
        googleIdentity.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signup_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.max(
            200,
            Math.min(googleButtonRef.current.clientWidth || 400, 400),
          ),
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setBackErrors(getBackendError(error));
        }
      });

    return () => {
      cancelled = true;
      googleButtonRef.current?.replaceChildren();
    };
  }, [handleGoogleSignup]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <hr />

      <div className="flex justify-center">
        <div className="flex justify-center w-full sm:w-1/2 lg:w-1/2 max-w-xl m-8 px-6 py-12  border border-blue-100/60 shadow-xl shadow-blue-100/80 bg-gradient-to-br from-blue-50/60 via-white to-blue-50/60">
          <div>
            <div className="mb-6 text-center">
              <h2 className="text-xl font-normal tracking-tight text-slate-800 sm:text-2xl">
                Create your
                {/* <br /> */}
                <span className="glittery-shadow p-2">SplitBill account</span>
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Start splitting expenses with friends.
              </p>
            </div>

            <form
              className="w-full max-w-md space-y-3"
              onSubmit={handleFormSubmit}
            >
              {Object.keys(backErrors).length !== 0 && (
                <Error errors={backErrors.error} type={backErrors.type} />
              )}

              {/* Profile picture */}
              <ProfilePictureInput
                imagePreview={imagePreview}
                handleProfilePictureChange={handleProfilePictureChange}
                big={false}
              />

              <LabelAndInput
                field={"name"}
                labelValue={"Name"}
                type={"text"}
                person={person}
                placeholder={"Your full name"}
                required={true}
                handleEvent={(e) => handlePersonChange(e, "name")}
                compact
              />

              <LabelAndInput
                field={"email"}
                labelValue={"Email"}
                type={"email"}
                person={person}
                placeholder={"Your email"}
                handleEvent={handleEmailChange}
                showError={true}
                required={true}
                errors={frontErrors}
                compact
              />

              <LabelAndInput
                field={"mobileNumber"}
                labelValue={"Mobile number (optional)"}
                type={"text"}
                person={person}
                placeholder={"i.e. 987654XXXX"}
                handleEvent={handleMobileNumberChange}
                showError={true}
                errors={frontErrors}
                compact
              />

              <LabelAndInput
                field={"password"}
                labelValue={"Password"}
                type={"password"}
                person={person}
                placeholder={"At least 8 characters"}
                handleEvent={handlePasswordChange}
                showError={true}
                errors={frontErrors}
                required={true}
                compact
              />

              {/* Submit Button */}
              <button
                disabled={
                  !person.name ||
                  !person.email ||
                  frontErrors.mobileNumber ||
                  !person.password ||
                  frontErrors.email ||
                  frontErrors.password ||
                  loading
                }
                className="btn !mt-6 !py-2.5"
                type="submit"
              >
                {loading ? "Signing up..." : "Create account"}
              </button>

              <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wider text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                or
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div
                ref={googleButtonRef}
                className="flex min-h-11 w-full justify-center"
                aria-label="Sign up with Google"
              />

              {/* Login link */}
              <RedirectLinks
                message={"Already have an account?"}
                path={"/login"}
                value={"Log in"}
              />
            </form>
          </div>
        </div>
      </div>

      {googleLoading && (
        <div className="outer-modal">
          <Loading custom msg="Signing up with google" />
        </div>
      )}
    </div>
  );
}
