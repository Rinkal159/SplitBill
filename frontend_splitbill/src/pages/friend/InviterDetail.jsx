import React from "react";

function InviterDetail({ onClose, user, date, message }) {
  const createdAt = new Date(date).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-blue-200/40"
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

        <div className="flex justify-center">
          <img
            src={user.profile_picture_path}
            alt={user.name}
            className="mt-6 h-32 w-32 rounded-full border-4 border-white object-cover shadow-lg"
          />
        </div>

        {/* Content */}
        <div className="px-6 pb-7 pt-4 text-center">
          <h1 className="text-xl font-semibold text-slate-700">
            {user.name}
          </h1>

          <p className="mt-1 text-sm text-slate-400">{message}</p>

          <div className="mx-auto mt-5 w-fit rounded-lg bg-slate-50 px-4 py-2">
            <p className="text-xs text-slate-400">Invitation sent</p>

            <p className="mt-0.5 text-sm font-medium text-slate-600">
              {createdAt}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InviterDetail;
