import { Outlet } from "react-router-dom";
import Header from "./Header";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function UnauthenticatedBody() {
  return (
    <div>
      <Outlet />
      <Footer />
    </div>
  );
}
