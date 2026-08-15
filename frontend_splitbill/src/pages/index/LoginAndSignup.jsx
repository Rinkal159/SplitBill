import {Link} from "react-router-dom";

export default function LoginAndSignup({value, to}) {
  return <Link
    to={to}
    className="text-md text-slate-500 hover:text-sky-600 transition font-medium hidden sm:block"
  >
    {value}
  </Link>;
}
