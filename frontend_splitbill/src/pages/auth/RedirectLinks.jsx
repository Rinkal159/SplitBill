import React from "react";
import { useNavigate } from "react-router-dom";

function RedirectLinks({message, path, value}) {
    const navigate = useNavigate();
    
  return (
    <p className="text-center text-sm text-slate-400">
      {message}{" "}
      <button
        type="button"
        onClick={() => navigate(path)}
        className="text-blue-600 font-medium hover:text-blue-700 transition-colors underline"
      >
        {value}
      </button>
    </p>
  );
}

export default RedirectLinks;
