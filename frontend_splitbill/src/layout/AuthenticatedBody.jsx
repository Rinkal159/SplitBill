import { AuthContext } from "../context/AuthProvider";
import { Outlet, Navigate } from "react-router-dom";
import { useContext } from "react";
import Footer from "./Footer";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";

export default function AuthenticatedBody() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />

        <div className="flex min-h-[70vh] flex-col items-center mt-8 px-6 text-center">
          <h1 className="text-xl font-medium tracking-tight text-slate-800">
            Oops! You're not signed in
          </h1>

          <p className="mt-2 max-w-sm text-sm text-slate-400">
            Please log in to access this page and continue using SplitBill.
          </p>

          <Link
            to="/login"
            className="btn py-2 px-6 m-4 !w-auto"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Outlet />
      <Footer />
    </div>
  );
}
