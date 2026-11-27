import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthProvider";
import Navbar from "../../layout/Navbar";
import ProfilePictureInput from "./ProfilePictureInput";
import LabelAndInput from "./LabelAndInput";
import Error from "../error/Error";
import api from "../../api/axios";
import getBackendError from "../../utils/getBackendError";

function CreateProfile() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  // user
  const [person, setPerson] = useState({
    profilePicture: user.profile_picture_path,
    name: user.name,
    mobileNumber: user.mobile_number ?? "",
  });

  //   preview image
  const [imagePreview, setImagePreview] = useState(user.profile_picture_path);

  //   loading
  const [loading, setLoading] = useState(false);

  // error
  const [frontErrors, setFrontErrors] = useState({
    name: "",
    mobileNumber: "",
  });
  const [backErrors, setBackErrors] = useState({});

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

  const handleNameChange = (e) => {
    setBackErrors({});
    handlePersonChange(e, "name");

    const value = e.target.value;

    if (!value) {
      handleErrorsChange("name", "User must have a name");
    } else if (value.length < 4) {
      handleErrorsChange(
        "name",
        "User must have a name greater than 4 characters",
      );
    } else {
      handleErrorsChange("name", "");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setBackErrors({});

    const formData = new FormData();
    if (person.name.trim() !== user.name) {
      formData.append("name", person.name.trim());
    }
    if (
      (person.mobileNumber ?? "") !== (user.mobile_number ?? "") &&
      person.mobileNumber
    ) {
      formData.append("mobile_number", person.mobileNumber);
    }
    if (person.profilePicture instanceof File) {
      formData.append("profilePicture", person.profilePicture);
    }

    try {
      const { data } = await api.patch("/users/profile/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(data);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setLoading(false);
    }
  };

  const hasProfileChanges =
    user.profile_picture_path === person.profilePicture &&
    user.name === person.name.trim() &&
    (user.mobile_number ?? "") === (person.mobileNumber ?? "");

  const shouldDisable =
    hasProfileChanges ||
    Boolean(frontErrors.mobileNumber) ||
    Boolean(frontErrors.name) ||
    loading ||
    !person.name.trim();

  return (
    <div className="">
      <Navbar />

      <div className="flex justify-center">
        <div className="flex w-full max-w-lg flex-col items-start px-6">
          {/* heading and skip for now */}
          <div className="flex w-full items-center justify-between gap-4 pt-10 pb-8">
            <h1 className="text-2xl text-slate-800">
              Hi,{" "}
              <span className="glittery-shadow font-bold">{user.name}!</span>
              <p className="mt-1 text-sm text-slate-600 italic">
                Complete your profile
              </p>
            </h1>

            <Link
              to="/dashboard"
              className="text-slate-500 rounded-xl border border-slate-300 hover:border-slate-400 hover:-translate-y-0.5 trans px-4 py-2 text-sm group hover:bg-slate-50"
            >
              Skip for now &nbsp;
              <span
                aria-hidden="true"
                className="text-slate-400 group-hover:text-slate-500"
              >
                →
              </span>
            </Link>
          </div>

          <form className="w-full" onSubmit={handleSubmit}>
            {Object.keys(backErrors).length > 0 && (
              <Error errors={backErrors.error} type={backErrors.type} />
            )}

            <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:gap-12">
              {/* profile picture */}
              <ProfilePictureInput
                imagePreview={imagePreview}
                handleProfilePictureChange={handleProfilePictureChange}
                big={true}
              />

              <div className="space-y-3">
                <LabelAndInput
                  field={"name"}
                  labelValue={"Name"}
                  type={"text"}
                  person={person}
                  placeholder={"Your full name"}
                  required={true}
                  handleEvent={handleNameChange}
                  showError={true}
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
              </div>
            </div>
            <div className="mt-6 flex w-full justify-center">
              <button
                disabled={shouldDisable}
                className="btn !mt-0 !py-2.5 sm:min-w-40"
                type="submit"
              >
                {loading ? "Saving profile..." : "Create account"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateProfile;
