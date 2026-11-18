import React from "react";
import { Link } from "react-router-dom";

function Logo() {
  return (
    <div className="flex items-center gap-2 z-50">
      <img src="/1final.png" alt="SplitBill" className="w-9 h-9" />
      <Link
        to="/dashboard"
        className="text-3xl cursor-pointer tracking-tighter font-medium bg-gradient-to-b from-blue-600 to-sky-400 bg-clip-text text-transparent drop-shadow-sm pb-1"
      >
        SplitBill
      </Link>
    </div>
  );
}

export default Logo;
