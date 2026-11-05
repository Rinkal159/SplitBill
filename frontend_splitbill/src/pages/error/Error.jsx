import { useEffect, useState } from "react";

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object")
    return "Something went wrong. Please try again.";

  return (
    error.error_message ||
    error.msg ||
    error.detail ||
    error.message ||
    (error.field ? `Invalid ${error.field}.` : null) ||
    "Something went wrong. Please try again."
  );
}

export default function Error({ errors = [], type }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [errors, type]);

  const errorList = (Array.isArray(errors) ? errors : [errors])
    .flatMap((error) => (Array.isArray(error) ? error : [error]))
    .filter((error) => error !== null && error !== undefined && error !== "");

  if (!visible || errorList.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-error-type={type}
      className="text-red-500 font-medium text-center bg-rose-100 py-2 px-4 flex justify-center items-center relative"
    >
      <ul className="space-y-1">
        {errorList.map((error, index) => (
          <li key={`${index}-${getErrorMessage(error)}`}>
            {getErrorMessage(error)}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss error message"
        className="absolute right-4 cursor-pointer border-0 bg-transparent p-0 text-rose-600 transition hover:text-rose-700"
      >
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </div>
  );
}
