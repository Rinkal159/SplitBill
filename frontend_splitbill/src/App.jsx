import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";

import UnauthenticatedBody from "./layout/UnauthenticatedBody";
import Index from "./pages/index/Index";
import Signup from "./pages/auth/Signup";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";

import AuthenticatedBody from "./layout/AuthenticatedBody";
import Dashboard from "./pages/dashboard/Dashboard";
import ResetPassword from "./pages/auth/ResetPassword";
import ProtectedResetPassword from "./pages/auth/ProtectedResetPassword";

function App() {
  return (
    <div>
      <BrowserRouter>
        <Routes>
          {/* non-authenticated */}
          <Route element={<UnauthenticatedBody />}>
            <Route path="/" element={<Index />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route element={<ProtectedResetPassword />}>
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>
          </Route>

          {/* authenticated */}
          <Route element={<AuthenticatedBody />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
