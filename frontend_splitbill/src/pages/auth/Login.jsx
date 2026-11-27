import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Error from "../error/Error";
import Navbar from "../../layout/Navbar";
import api from "../../api/axios";
import LabelAndInput from "./LabelAndInput";
import RedirectLinks from "./RedirectLinks";
import { AuthContext } from "../../context/AuthProvider";
import getBackendError from "../../utils/getBackendError";
import loadGoogleIdentityServices from "../../utils/loadGoogleIdentityServices";
import Loading from "../loading/Loading";

function Login() {
  const { setUser } = useContext(AuthContext);
  const [person, setPerson] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [backErrors, setBackErrors] = useState({});
  const googleButtonRef = useRef(null);
  const navigate = useNavigate();

  const handleChange = (e, field) => {
    setBackErrors({});
    setPerson((previous) => ({ ...previous, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setBackErrors({});

    try {
      await api.post("/auth/login", person);
      const { data: user } = await api.get("/auth/me");
      setUser(user);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useCallback(async (response) => {
    if (!response?.credential) {
      setBackErrors({
        type: "501",
        error: "Google did not return a sign in credential. Please try again.",
      });
      return;
    }

    setBackErrors({});
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setBackErrors({
        type: "501",
        error: "Google sign in is not configured for this environment.",
      });
      return undefined;
    }

    loadGoogleIdentityServices()
      .then((googleIdentity) => {
        if (cancelled || !googleButtonRef.current) return;

        googleButtonRef.current.replaceChildren();
        googleIdentity.initialize({
          client_id: clientId,
          callback: handleGoogleLogin,
          use_fedcm_for_button: true,
        });
        googleIdentity.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.max(
            200,
            Math.min(googleButtonRef.current.clientWidth || 400, 400),
          ),
        });
      })
      .catch((error) => {
        if (!cancelled) setBackErrors(getBackendError(error));
      });

    return () => {
      cancelled = true;
      googleButtonRef.current?.replaceChildren();
    };
  }, [handleGoogleLogin]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <hr />

      <div className="flex justify-center">
        <div className="m-8 flex w-full max-w-xl justify-center border border-blue-100/60 bg-gradient-to-br from-blue-50/60 via-white to-blue-50/60 px-6 py-12 shadow-xl shadow-blue-100/80 sm:w-1/2 lg:w-1/2">
          <div>
            <div className="mb-8 text-center">
              <h2 className="text-xl font-normal tracking-tight text-slate-800 sm:text-2xl">
                Log into your{" "}
                <span className="glittery-shadow p-2">SplitBill account</span>
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Pick up where you left off.
              </p>
            </div>

            <form className="w-full max-w-md space-y-3" onSubmit={handleSubmit}>
              {Object.keys(backErrors).length !== 0 && (
                <Error errors={backErrors.error} type={backErrors.type} />
              )}

              <LabelAndInput
                field="email"
                labelValue="Email"
                type="email"
                person={person}
                placeholder="Your email"
                handleEvent={(e) => handleChange(e, "email")}
                showError={false}
                required
                compact
              />

              <LabelAndInput
                field="password"
                labelValue="Password"
                type="password"
                person={person}
                placeholder="Your password"
                handleEvent={(e) => handleChange(e, "password")}
                showError={false}
                required
                compact
              />

              <Link
                className="my-2 block text-md text-sky-600"
                to="/forgot-password"
              >
                Forgot password?
              </Link>

              <button
                disabled={
                  !person.email || !person.password || loading || googleLoading
                }
                className="btn"
                type="submit"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>

              <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wider text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                or
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div
                ref={googleButtonRef}
                className="flex min-h-11 w-full justify-center"
                aria-label="Sign in with Google"
              />

              <RedirectLinks
                message="Don't have an account?"
                path="/signup"
                value="Sign up"
              />
            </form>
          </div>
        </div>
      </div>

      {googleLoading && (
        <div className="outer-modal">
          <Loading custom msg="Signing in with Google" />
        </div>
      )}
    </div>
  );
}

export default Login;
