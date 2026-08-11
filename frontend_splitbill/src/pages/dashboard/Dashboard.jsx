import LoginAndSignup from "./LoginAndSignup";
import CircularProfile from "./CircularProfile";
import Expense from "./Expense";

export default function Dashboard() {
  return (
    <div className="bg-blue-100">
      <div className="bg-[radial-gradient(ellipse_at_top_left,#f2fbff_0%,#f7fdff,#f2fbff_100%)]">
        {/* gradients */}
        <div class="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-100/60 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-40 right-0 h-[500px] w-[500px] rounded-full bg-blue-100/60 blur-3xl"></div>

        {/* Main content */}
        <main className="relative z-30 max-w-7xl mx-auto px-6 md:px-10 lg:px-16 min-h-screen flex flex-col">
          {/* Navbar */}
          <div className="py-6 md:py-8 flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-b from-sky-400 to-blue-600 bg-clip-text text-transparent drop-shadow-sm font-bold">
                SplitBill
              </h1>
            </div>
            <div className="flex gap-4 items-center">
              <LoginAndSignup value={"Login"} />
              <div className="h-5 w-px bg-sky-300/70 hidden sm:block" />
              <LoginAndSignup value={"Signup"} />
            </div>
          </div>

          {/* Hero Section */}
          <div className="flex-1 flex flex-col justify-center py-10 md:py-16 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* LEFT */}
              <div className="relative md:block sm:flex md:flex lg:block flex flex-col">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[1.1] md:leading-[1.15] text-slate-800">
                  Split bills.
                  <br />
                  <span className="bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 bg-clip-text text-transparent drop-shadow-sm">
                    Settle easily.
                  </span>
                </h1>

                <p className="text-md sm:text-xl md:text-xl text-slate-500/90 lg:mt-8 mt-6  max-w-xl leading-relaxed font-medium">
                  Whether it’s dinner with friends or a weekend trip, keep
                  everything organized in one place.
                </p>

                <div className="lg:mt-10 mt-6 flex flex-wrap gap-5 items-center">
                  <a
                    href="#"
                    className="bg-gradient-to-r from-sky-500 to-blue-500 text-white font-semibold px-8 py-4 rounded-2xl text-lg inline-block shadow-[0_20px_35px_-12px_rgba(56,189,248,0.4)] hover:shadow-[0_25px_40px_-12px_rgba(56,189,248,0.6)] hover:-translate-y-1 transition-all duration-300"
                  >
                    Get Started
                  </a>
                </div>
              </div>

              {/* RIGHT */}
              <div className="relative flex items-center justify-center min-h-[400px]">
                {/* Soft background glow */}
                <div className="absolute w-[380px] h-[380px] bg-sky-100/70 rounded-full blur-3xl" />

                {/* Small floating card — Friends */}
                <div className="absolute top-8 right-0 sm:right-4 lg:right-0 z-20 w-52 bg-white/90 backdrop-blur-md rounded-2xl border border-sky-100 shadow-xl p-4 transition-transform duration-300 rotate-3">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-slate-700">
                      Friends
                    </span>
                    <span className="text-xs text-sky-500">4 members</span>
                  </div>

                  <div className="flex -space-x-2 mb-3">
                    <CircularProfile value={"R"} bgColor={"bg-sky-200"} />
                    <CircularProfile value={"A"} bgColor={"bg-blue-200"} />
                    <CircularProfile value={"K"} bgColor={"bg-indigo-200"} />
                    <CircularProfile value={"+"} bgColor={"bg-slate-200"} />
                  </div>

                  <p className="text-xs text-slate-400">Your travel group</p>
                </div>

                {/* MAIN APP WINDOW */}
                <div className="relative z-10 w-full max-w-[450px] bg-white rounded-3xl border border-sky-100 shadow-[0_30px_80px_-25px_rgba(37,99,235,0.25)] overflow-hidden">
                  {/* App Header */}
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Welcome back
                      </p>
                      <h3 className="text-lg font-semibold text-slate-800">
                        Dashboard
                      </h3>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="p-6">
                    <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
                      <p className="text-sm text-blue-100 text-center pl-6">
                        Total balance
                      </p>

                      <div className="flex items-end justify-around mt-2">
                        <span className="text-xs bg-white/15 px-3 py-1.5 rounded-full">
                          - borrowed ₹850
                        </span>
                        <h2 className="text-3xl font-semibold">₹2,450</h2>
                        <span className="text-xs bg-white/15 px-3 py-1.5 rounded-full">
                          + lent ₹950
                        </span>
                      </div>
                    </div>

                    {/* Recent Expenses */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-slate-700">
                          Recent expenses
                        </h4>

                        <span className="text-xs text-sky-500 font-medium">
                          View all
                        </span>
                      </div>

                      {/* Expense 1 */}
                      <Expense
                        symbol={"🍕"}
                        expense_title={"Dinner"}
                        expense_desc={"4 participants"}
                        rupee={"$1200"}
                        summary={"You get ₹300"}
                        summary_color={"text-emerald-500"}
                      />

                      {/* Expense 2 */}
                      <Expense
                        symbol={"🏨"}
                        expense_title={"Hotel"}
                        expense_desc={"Weekend trip"}
                        rupee={"$4800"}
                        summary={"You owe ₹600"}
                        summary_color={"text-red-400"}
                      />

                      {/* Expense 3 */}
                      <Expense
                        symbol={"🚕"}
                        expense_title={"Cab"}
                        expense_desc={"Airport → Home"}
                        rupee={"$650"}
                        summary={"Settled"}
                        summary_color={"text-emerald-500"}
                      />
                    </div>
                  </div>
                </div>

                {/* Floating balance card */}
                <div className="absolute bottom-8 left-0 sm:left-4 lg:-left-8 z-20 w-56 bg-white/95 backdrop-blur-md rounded-2xl border border-sky-100 shadow-xl p-4 transition-transform duration-300 -rotate-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">You are owed</p>

                      <p className="text-2xl font-semibold text-emerald-500 mt-1">
                        ₹850
                      </p>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                      ↑
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full w-[70%] bg-emerald-400 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-30 border-t border-sky-100/60 py-5 text-center text-slate-400 text-xs bg-white/10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6">
            © 2026 SplitBill — split smarter, live better.
          </div>
        </footer>
      </div>
    </div>
  );
}
