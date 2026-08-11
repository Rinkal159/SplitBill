import { Outlet } from "react-router-dom";
import Header from "./Header";
import NavBar from "./NavBar";
import Footer from "./Footer";

export default function Body() {
  return (
    <div>
      {/* <Header />
        <NavBar /> */}
      <Outlet /> {/* childeren component */}
      {/* <Footer /> */}
    </div>
  );
}
