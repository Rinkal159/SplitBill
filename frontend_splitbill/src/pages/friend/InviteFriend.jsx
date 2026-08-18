import React, { useState } from "react";
import Error from "../error/Error";
import LabelAndInput from "../auth/LabelAndInput";
import api from "../../api/axios";

function InviteFriend({ onInvitationSent, onClose }) {
  const [label, setLabel] = useState("");
  const [input, setInput] = useState("");
  const [errors, setErrors] = useState("");
  const [pageErrors, setPageErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);

    const labelVal = value.includes("@") ? "email" : "mobile_number";
    setLabel(labelVal);

    const mobileRegex = /^\d+$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!value) {
      setErrors("");
      return;
    }

    if (/^\d/.test(value)) {
      if (!mobileRegex.test(value)) {
        setErrors("Only digits are allowed in mobile number");
      } else if (value.length !== 10) {
        setErrors("Mobile number must be 10 digits");
      } else {
        setErrors("");
      }

      return;
    }

    if (!emailRegex.test(value)) {
      setErrors("Please enter a valid email");
    } else {
      setErrors("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (errors || !input) return;

    try {
      setLoading(true);
      setPageErrors([]);

      const response = await api.post("/friends/invite", {
        [label]: input,
      });

      await onInvitationSent();

      // Close modal after successful invitation
      onClose();

    } catch (error) {
      setPageErrors([error.response?.data?.error || "Something went wrong."]);
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
          className="absolute right-4 top-4 text-xl text-slate-400 transition hover:text-slate-700"
        >
          ✕
        </button>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h2 className="text-xl heading-shadow">
            Invite friend
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Send an invitation using their email or mobile number.
          </p>
        </div>

        <form
          className="mx-auto w-full max-w-xs space-y-8"
          onSubmit={handleSubmit}
        >
          {pageErrors.length !== 0 && <Error errors={pageErrors} />}

          <LabelAndInput
            field="text"
            labelValue="Email or Mobile number"
            type="text"
            person={input}
            placeholder="Friend's email or mobile number"
            handleEvent={handleChange}
            showError={true}
            errors={errors}
          />

          <button
            disabled={loading || !input || !!errors}
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
