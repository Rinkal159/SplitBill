import React from "react";

function BorrowingsAndLendings({dashboardData}) {
  return (
    <div>
      {/* balances */}
      <div className="bg-gradient-to-b from-sky-300 to-blue-700 p-5 text-white shadow-lg rounded-tl-2xl rounded-tr-2xl">
        <div className="flex items-end justify-around mt-2">
          <div className="flex flex-col items-center">
            <p className="text-sm text-blue-100 text-center">You borrowed</p>
            <span className="text-xl">- ₹{dashboardData.total_borrowings}</span>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-sm text-blue-100 text-center">Total balance</p>
            <h2 className="text-3xl font-semibold">
              {dashboardData.total_balance > 0 ? "+" : "-"}&nbsp;₹
              {Math.abs(dashboardData.total_balance)}
            </h2>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-sm text-blue-100 text-center">You lent</p>
            <span className="text-xl">+ ₹{dashboardData.total_lendings}</span>
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
                    className="flex justify-center pb-4 pt-2 items-center px-8 hover:bg-slate-100 hover:cursor-pointer"
                    key={borrow.borrowed_from.id}
                  >
                    <img
                      className="small-img"
                      src={borrow.borrowed_from.profile_picture_path}
                      alt={borrow.borrowed_from.name}
                    />

                    <div className="flex flex-col ml-2">
                      <p className="font-normal hover:cursor-pointer">
                        {borrow.borrowed_from.name}
                      </p>
                      <p className="text-xs text-red-500">
                        You borrowed{" "}
                        <span className="font-medium">₹{borrow.amount}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="h-screen w-px bg-slate-200 hidden sm:block my-4" />

        {/* Lendings */}
        <div className="flex-1">
          <div className="flex flex-col items-center px-8">
            <h1 className="text-2xl font-medium bg-gradient-to-r from-green-500 via-green-400 to-green-600 bg-clip-text text-transparent py-4 text-center">
              Lendings
            </h1>

            {dashboardData?.total_lendings > 0 && (
              <ul>
                {dashboardData.lendings.map((lend) => (
                  <li className="flex py-2 items-center" key={lend.lent_to.id}>
                    <img
                      className="small-img"
                      src={lend.lent_to.profile_picture_path}
                      alt={lend.lent_to.name}
                    />

                    <div className="flex flex-col ml-2">
                      <p className="font-medium text-xs">{lend.lent_to.name}</p>
                      <p className="text-xs text-green-500">
                        You lent{" "}
                        <span className="font-medium">₹{lend.amount}</span>
                      </p>
                    </div>
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
