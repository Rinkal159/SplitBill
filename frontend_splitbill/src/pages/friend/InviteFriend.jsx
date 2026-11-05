import React, { useState } from "react";
import Error from "../error/Error";
import LabelAndInput from "../auth/LabelAndInput";
import api from "../../api/axios";
import getBackendError from "../../utils/getBackendError";

function InviteFriend({ onInvitationSent, onClose }) {
  const [label, setLabel] = useState("");
  const [input, setInput] = useState("");

  // loading
  const [loading, setLoading] = useState(false);

  // error
  const [frontErrors, setFrontErrors] = useState("");
  const [backErrors, setBackErrors] = useState({});

  const handleChange = (e) => {
    setBackErrors({});

    const value = e.target.value;
    setInput(value);

    const labelVal = value.includes("@") ? "email" : "mobile_number";
    setLabel(labelVal);

    const mobileRegex = /^\d+$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!value) {
      setFrontErrors("");
      return;
    }

    if (/^\d/.test(value)) {
      if (!mobileRegex.test(value)) {
        setFrontErrors("Only digits are allowed in mobile number");
      } else if (value.length !== 10) {
        setFrontErrors("Mobile number must be 10 digits");
      } else {
        setFrontErrors("");
      }

      return;
    }

    if (!emailRegex.test(value)) {
      setFrontErrors("Please enter a valid email");
    } else {
      setFrontErrors("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (frontErrors || !input) return;

    try {
      setLoading(true);
      setBackErrors({});

      await api.post("/friends/invite", {
        [label]: input,
      });

      await onInvitationSent();

      // Close modal after successful invitation
      onClose();
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl border border-blue-100/60 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-xl text-slate-400 trans hover:text-slate-700"
        >
          ✕
        </button>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h2 className="text-xl glittery-shadow">Invite friend</h2>

          <p className="mt-2 text-sm text-slate-400">
            Send an invitation using their email or mobile number.
          </p>
        </div>

        <form
          className="mx-auto w-full max-w-xs space-y-8"
          onSubmit={handleSubmit}
        >
          {Object.keys(backErrors).length !== 0 && (
            <Error errors={backErrors.error} type={backErrors.type} />
          )}

          <LabelAndInput
            field={"text"}
            labelValue={"Email or Mobile number"}
            type={"text"}
            person={input}
            placeholder={"Friend's email or mobile number"}
            handleEvent={handleChange}
            showError={true}
            errors={frontErrors}
            required={true}
          />

          <button
            disabled={loading || !input || !!frontErrors}
            className="btn w-full disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
          >
            {loading ? "Inviting..." : "Invite"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default InviteFriend;
