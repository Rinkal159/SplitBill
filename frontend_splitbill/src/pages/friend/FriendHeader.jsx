{
  /* name, how much borrowed/lent and settle up */
}
function FriendHeader({ friendExpenses, onClickEvent }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 px-6 box hover:cursor-default">
      <div className="flex min-w-0 flex-col gap-2">
        <div
          onClick={() => onClickEvent(friendExpenses.friend)}
          className="group flex h-12 w-fit max-w-full cursor-pointer items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/60 pr-4 trans hover:border-sky-300 hover:bg-sky-50"
        >
          <img
            className="small-img !rounded-r-none trans group-hover:scale-105"
            src={friendExpenses.friend.profile_picture_path}
            alt={friendExpenses.friend.name}
          />
          <h1 className="heading truncate pb-0 pt-0 text-sm font-semibold text-slate-800 group-hover:underline group-hover:glittery-shadow">
            {friendExpenses.friend.name}
          </h1>
        </div>

        {friendExpenses.had_expenses ? (
          friendExpenses.total_balance == 0 ? (
            <p className="text-sm text-slate-500">
              You are <span className="accept-text font-semibold">settled</span>
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              You{" "}
              <span className="font-medium">
                {friendExpenses.total_balance < 0 ? "borrowed" : "lent"}
              </span>{" "}
              <span
                className={`font-semibold ${
                  friendExpenses.total_balance < 0
                    ? "reject-text"
                    : "accept-text"
                }`}
              >
                ₹{Math.abs(friendExpenses.total_balance)}
              </span>
            </p>
          )
        ) : (
          <p className="text-sm italic text-slate-400">
            No shared expenses with {friendExpenses.friend.name}
          </p>
        )}
      </div>

      {friendExpenses.had_expenses && friendExpenses.total_balance < 0 && (
        <button className="invitation-btn edit-text edit-btn-shadow shrink-0 rounded-xl px-4 py-2 text-sm font-semibold trans hover:-translate-y-0.5">
          Settle up
        </button>
      )}
    </div>
  );
}

export default FriendHeader;
