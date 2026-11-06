import formatAmount from "../../utils/formatAmount";

function BorrowingsAndLendings({ dashboardData, onUserClick }) {
  return (
    <div>
      {/* balances */}
      <div className="bg-gradient-to-b from-sky-300 to-blue-700 p-5 text-white shadow-lg rounded-tl-2xl rounded-tr-2xl">
        <div className="flex items-end justify-around mt-2">
          <div className="flex flex-col items-center">
            <p className="text-sm text-blue-100 text-center">You borrowed</p>
            <span className="text-xl">
              - ₹{formatAmount(dashboardData.total_borrowings)}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-sm text-blue-100 text-center">Total balance</p>
            <h2 className="text-3xl font-semibold">
              {dashboardData.total_balance > 0 ? "+" : "-"}&nbsp;₹
              {formatAmount(Math.abs(dashboardData.total_balance))}
            </h2>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-sm text-blue-100 text-center">You lent</p>
            <span className="text-xl">
              + ₹{formatAmount(dashboardData.total_lendings)}
            </span>
          </div>
        </div>
      </div>

      {/* borrowings and lendings */}
      <div className="flex">
        {/* Borrowings */}
        <div className="flex-1">
          <div className="flex flex-col items-center w-full">
            <h1 className="text-2xl font-medium bg-gradient-to-r from-red-500 via-red-400 to-red-600 bg-clip-text text-transparent py-4 text-center px-8">
              Borrowings
            </h1>
            {dashboardData?.total_borrowings > 0 && (
              <ul className="w-full">
                {dashboardData.borrowings.map((borrow) => (
                  <li
                  onClick={() => onUserClick(borrow.borrowed_from)}
                    className="group mb-2 flex items-center justify-between gap-2 px-6 py-3 trans hover:-translate-y-0.5 hover:border-red-100 hover:cursor-pointer hover:shadow-md"
                    key={borrow.borrowed_from.id}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <img
                        className="h-11 w-11 shrink-0 rounded-full object-cover border-2 border-white shadow-md"
                        src={borrow.borrowed_from.profile_picture_path}
                        alt={borrow.borrowed_from.name}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 group-hover:glittery-shadow">
                          {borrow.borrowed_from.name}
                        </p>
                        <p className="text-xs text-slate-500">You borrowed</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600">
                      ₹{formatAmount(borrow.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="h-screen w-px bg-slate-200 hidden sm:block my-4" />

        {/* Lendings */}
        <div className="flex-1">
          <div className="flex flex-col items-center w-full">
            <h1 className="text-2xl font-medium bg-gradient-to-r from-green-500 via-green-400 to-green-600 bg-clip-text text-transparent py-4 text-center">
              Lendings
            </h1>

            {dashboardData?.total_lendings > 0 && (
              <ul className="w-full">
                {dashboardData.lendings.map((lend) => (
                  <li
                  onClick={() => onUserClick(lend.lent_to)}
                    className="group mb-2 flex items-center justify-between gap-2 px-6 py-3 trans hover:-translate-y-0.5 hover:border-red-100 hover:cursor-pointer hover:shadow-md "
                    key={lend.lent_to.id}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        className="h-11 w-11 shrink-0 rounded-full object-cover border-2 border-white shadow-md"
                        src={lend.lent_to.profile_picture_path}
                        alt={lend.lent_to.name}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 group-hover:glittery-shadow">
                          {lend.lent_to.name}
                        </p>
                        <p className="text-xs text-slate-500">You lent</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-600">
                      ₹{formatAmount(lend.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BorrowingsAndLendings;
