import React from "react";
import LoginAndSignup from "../pages/index/LoginAndSignup";

function Navbar() {
  return (
    <div className="max-w-6xl mx-auto py-6 md:py-6 px-10 lg:px-0 flex justify-between items-center flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-b from-sky-400 to-blue-600 bg-clip-text text-transparent drop-shadow-sm font-bold">
          SplitBill
        </h1>
      </div>
      <div className="flex gap-4 items-center">
        <LoginAndSignup value={"Login"} to={"/login"} />
        <div className="h-5 w-px bg-sky-300/70 hidden sm:block" />
        <LoginAndSignup value={"Signup"} to={"/signup"} />
      </div>
    </div>
  );
}

export default Navbar;
