import React from "react";
import LoginAndSignup from "../pages/index/LoginAndSignup";
import { useContext } from "react";
import { AuthContext } from "../context/AuthProvider";

function Navbar() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>loading...</div>;
  }

  return user ? (
    <div className="w-full ">
      <div className="relative max-w-6xl mx-auto py-4 px-10 lg:px-0 flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-b from-sky-400 to-blue-600 bg-clip-text text-transparent drop-shadow-sm">
          SplitBill
        </h1>

        <div className="grid auto-cols-max grid-flow-col items-center gap-4">
          <button className="btn !mt-0 !bg-gradient-to-r from-sky-600/80 via-sky-500/80 to-blue-500 px-4">Add Expense</button>
          <button className="btn !mt-0 !bg-gradient-to-r from-sky-600/80 via-sky-500/80 to-blue-500 px-4">Settle up</button>
          <img
            className="w-14 h-14 rounded-full overflow-hidden border border-slate-200/80 bg-slate-50"
            src={user.profile_picture_path}
            alt="Profie picture"
          />
        </div>
      </div>
      {/* <hr /> */}
    </div>
  ) : (
    <div className="max-w-6xl mx-auto py-4 px-10 lg:px-0 flex justify-between items-center flex-wrap gap-3">
      <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-b from-sky-400 to-blue-600 bg-clip-text text-transparent drop-shadow-sm">
        SplitBill
      </h1>
      <div className="flex gap-4 items-center">
        <LoginAndSignup value={"Login"} to={"/login"} />
        <div className="h-5 w-px bg-sky-300/70 hidden sm:block" />
        <LoginAndSignup value={"Signup"} to={"/signup"} />
      </div>
    </div>
  );
}

export default Navbar;
