import { createContext, useEffect, useState } from "react";
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
import AddExpense from "./pages/expense/AddExpense";
import AllExpenses from "./pages/expense/AllExpenses";
import { ProfilePage, SettingsPage } from "./pages/profile/ProfilePages";
import CreateProfile from "./pages/auth/CreateProfile";

export const ThemeContext = createContext({
  darkMode: false,
  setDarkMode: () => {},
});

function App() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("splitbill-theme") === "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("splitbill-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      <div className={darkMode ? "dark-theme" : ""}>
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
              <Route path="/create" element={<CreateProfile />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/expenses/add" element={<AddExpense />} />
              <Route
                path="/expenses/:expenseId/edit"
                element={<AddExpense />}
              />
              <Route path="/expenses" element={<AllExpenses />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
