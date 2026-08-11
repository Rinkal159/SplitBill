import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";

import Dashboard from "./pages/dashboard/Dashboard";
import Body from "./layout/Body";

function App() {
  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Body />}></Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
