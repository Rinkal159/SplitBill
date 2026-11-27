import React from "react";

function ProfilePictureInput({
  imagePreview,
  handleProfilePictureChange,
  big,
}) {
  return (
    <div>
      {/* Profile picture */}
      <div className={`flex items-center gap-3 pb-1 ${big && `flex-col` }`}>
        <div className="relative">
          <div
            className={`flex items-center justify-center overflow-hidden rounded-full border border-slate-200/80 bg-slate-50 ${big ? `h-28 w-28` : `h-12 w-12 `}`}
          >
            <img
              src={imagePreview}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
          <label
            htmlFor="profilePicture"
            className={`absolute -bottom-0.5 -right-0.5 bg-white border border-slate-200 rounded-full cursor-pointer hover:bg-slate-50 transition-colors shadow-sm ${big ? `p-2` : `p-1`}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`text-slate-400 ${big ? `h-6 w-6` : `h-3.5 w-3.5`}`}
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
        <div className={`flex items-center gap-1 ${big && `flex-col`}`}>
          <p className="text-sm font-medium leading-none text-slate-700">
            Profile picture
          </p>
          <p className="text-xs text-slate-400">(optional)</p>
        </div>
      </div>
    </div>
  );
}

export default ProfilePictureInput;
