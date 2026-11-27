import React from "react";
import { Link } from "react-router-dom";

function Logo() {
  return (
    <div className="flex items-center gap-2 z-50">
      <img src="/SplitBill_first_logo.png" alt="SplitBill" className="w-8 h-8" />
      <Link
        to="/dashboard"
        className="splitbill-wordmark text-3xl cursor-pointer tracking-tighter font-medium bg-gradient-to-r from-blue-500 to-sky-400 bg-clip-text text-transparent drop-shadow-sm pb-1"
      >
        SplitBill
      </Link>
    </div>
  );
}

export default Logo;
