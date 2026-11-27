import { useContext, useEffect, useRef, useState } from "react";
import { Camera, Check, Clock3, KeyRound, UserRound } from "lucide-react";
import Navbar from "../../layout/Navbar";
import { AuthContext } from "../../context/AuthProvider";
import api from "../../api/axios";
import getBackendError from "../../utils/getBackendError";
import Loading from "../loading/Loading";
import { ThemeContext } from "../../App";

const actionLabels = {
  NAME_UPDATED: "Updated your name",
  PROFILE_PICTURE_UPDATED: "Changed your profile photo",
  PASSWORD_UPDATED: "Changed your password",
};
const errorMessage = (error) =>
  getBackendError(error)
    .error.map((item) => (typeof item === "string" ? item : item.msg))
    .filter(Boolean)
    .join(" ");

function ProfilePages({ profile }) {
  const { darkMode, setDarkMode } = useContext(ThemeContext);
  const { user, setUser } = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [name, setName] = useState(user?.name ?? "");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [password, setPassword] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const fileInput = useRef(null);

  useEffect(() => {
    api
      .get("/users/profile/history")
      .then(({ data }) => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photo);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photo]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");
    const form = new FormData();
    if (name.trim() !== user.name) form.append("name", name.trim());
    if (photo) form.append("profilePicture", photo);
    if (!form.has("name") && !photo) {
      setProfileMessage("Your profile is already up to date.");
      setSavingProfile(false);
      return;
    }
    try {
      const { data } = await api.patch("/users/profile/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(data);
      setName(data.name);
      setPhoto(null);
      setProfileMessage("Your profile was updated.");
      const historyResponse = await api.get("/users/profile/history");
      setHistory(historyResponse.data);
    } catch (error) {
      setProfileError(errorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      await api.patch("/users/profile/password/change", password);
      setPassword({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setPasswordMessage("Password changed successfully.");
      const { data } = await api.get("/users/profile/history");
      setHistory(data);
    } catch (error) {
      setPasswordError(errorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-[75vh] max-w-5xl px-5 py-10 sm:px-8">
        <div className="mb-8">
          <h1 className="mt-1 text-3xl glittery-shadow font-bold text-left tracking-tight">
            {profile ? "Your profile" : "Settings"}
          </h1>
          <p className="mt-2 text-slate-500">
            {profile
              ? "Your SplitBill account details and recent changes."
              : "Manage your personal details and account security."}
          </p>
        </div>

        {!profile && (
          <section className="theme-setting mb-6 flex items-center justify-between gap-4 rounded-2xl border border-blue-100/60 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-800">Dark theme</h2>
              <p className="mt-1 text-sm text-slate-500">
                Use a dark blue interface with bright sky-blue accents.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              aria-label="Enable dark theme"
              onClick={() => setDarkMode(!darkMode)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${darkMode ? "bg-sky-400" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${darkMode ? "translate-x-0" : "-translate-x-5"}`}
              />
            </button>
          </section>
        )}

        {/* profile */}
        {profile && (
          <section className="mb-6 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-sky-50 via-white to-sky-50 shadow-md shadow-sky-100">
            <div className="flex flex-wrap items-center gap-5">
              <img
                src={user?.profile_picture_path}
                alt="Your profile"
                className="h-24 w-24 rounded-full border-4 border-white shadow-md shadow-blue-200 object-cover"
              />
              <div className="">
                <h2 className="text-2xl font-semibold glittery-shadow">
                  {user?.name}
                </h2>
                <p className=" text-slate-600">{user?.email}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Member since{" "}
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString(undefined, {
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* update */}
        {!profile && (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            {/* update name and profile picture */}
            <section className="rounded-3xl p-6 sm:p-8 border border-blue-100/60 shadow-md shadow-sky-100/80 bg-gradient-to-br from-sky-50/60 via-white to-sky-50/60 relative">
              <div className="mb-6 flex items-center gap-3 ">
                <span className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
                  <UserRound size={20} />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-800">
                    Personal information
                  </h2>
                  <p className="text-sm text-slate-500">
                    Update how your account appears.
                  </p>
                </div>
              </div>
              <form onSubmit={saveProfile} className="space-y-5">
                <div>
                  <label className="form-lbl" htmlFor="profile-name">
                    Display name
                  </label>
                  <input
                    id="profile-name"
                    className="form-input mt-1"
                    value={name}
                    minLength={4}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <span className="form-lbl">Profile photo</span>
                  <div className="mt-2 flex items-center gap-4">
                    <img
                      src={photoPreview || user?.profile_picture_path}
                      alt="Preview"
                      className="h-14 w-14 rounded-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Camera size={16} /> Choose photo
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  {photo && (
                    <p className="mt-2 text-xs text-slate-500">
                      Selected: {photo.name}
                    </p>
                  )}
                </div>
                {profileError && (
                  <p role="alert" className="text-sm text-rose-600">
                    {profileError}
                  </p>
                )}
                {profileMessage && (
                  <p role="status" className="text-sm text-emerald-700">
                    {profileMessage}
                  </p>
                )}
                <button
                  className="btn invitation-btn px-4 !w-auto absolute bottom-8"
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving…" : "Save profile"}
                </button>
              </form>
            </section>

            {/* update password */}
            <section className="rounded-3xl p-6 sm:p-8 border border-blue-100/60 shadow-md shadow-sky-100/80 bg-gradient-to-br from-sky-50/60 via-white to-sky-50/60 relative">
              <div className="mb-6 flex items-center gap-3">
                <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                  <KeyRound size={20} />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-800">
                    Change password
                  </h2>
                  <p className="text-sm text-slate-500">
                    Use at least 8 characters.
                  </p>
                </div>
              </div>
              <form onSubmit={savePassword} className="space-y-4">
                {[
                  ["current_password", "Current password"],
                  ["new_password", "New password"],
                  ["confirm_password", "Confirm new password"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="form-lbl" htmlFor={field}>
                      {label}
                    </label>
                    <input
                      id={field}
                      type="password"
                      autoComplete={
                        field === "current_password"
                          ? "current-password"
                          : "new-password"
                      }
                      className="form-input mt-1"
                      minLength={field === "new_password" ? 8 : undefined}
                      required
                      value={password[field]}
                      onChange={(e) =>
                        setPassword({ ...password, [field]: e.target.value })
                      }
                    />
                  </div>
                ))}
                {passwordError && (
                  <p role="alert" className="text-sm text-rose-600">
                    {passwordError}
                  </p>
                )}
                {passwordMessage && (
                  <p role="status" className="text-sm text-emerald-700">
                    {passwordMessage}
                  </p>
                )}
                <button
                  className="btn invitation-btn"
                  disabled={savingPassword}
                >
                  {savingPassword ? "Updating…" : "Update password"}
                </button>
              </form>
            </section>

            {/* profile activities */}
            <section className="rounded-3xl p-6 sm:p-8 lg:col-span-2 border border-blue-100/60 shadow-md shadow-sky-100/80 bg-gradient-to-br from-sky-50/60 via-white to-sky-50/60">
              <div className="mb-5 flex items-center gap-3">
                <span className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                  <Clock3 size={20} />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-800">
                    Recent account activity
                  </h2>
                  <p className="text-sm text-slate-500">
                    Profile changes from the last 30 updates.
                  </p>
                </div>
              </div>
              {historyLoading ? (
                <Loading msg="Loading account activity" />
              ) : history.length ? (
                <ul className="divide-y divide-slate-100">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <span className="flex items-center gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-emerald-600" />
                        {actionLabels[item.action] ?? item.action}
                      </span>
                      <time className="shrink-0 text-xs text-slate-400">
                        {new Date(item.performed_at).toLocaleString()}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-sm text-slate-500">
                  No account changes recorded yet.
                </p>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}

export function ProfilePage() {
  return <ProfilePages profile={true} />;
}
export function SettingsPage() {
  return <ProfilePages profile={false} />;
}
