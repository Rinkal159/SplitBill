import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import FriendHeader from "./FriendHeader";
import Loading from "../loading/Loading";
import getBackendError from "../../utils/getBackendError";

function Friends({ onClickEvent, onPlusClickEvent }) {
  const [friendExpenses, setFriendExpenses] = useState([]);

  // loading
  const [loading, setLoading] = useState(true);

  // error
  const [backErrors, setBackErrors] = useState({});

  const getTotalBalancesWithFriends = async () => {
    const res = await api.get("/expenses/friends/balances/all");
    setFriendExpenses(res.data);
  };

  useEffect(() => {
    try {
      getTotalBalancesWithFriends();
      setLoading(false);
    } catch (error) {
      setLoading(true);
      setBackErrors(getBackendError(error));
    }
  }, []);

  if (loading) {
    return <Loading msg={"Friends"} />;
  }

  return (
    <div>
      {Object.keys(backErrors).length !== 0 && (
        <Error errors={backErrors.error} type={backErrors.type} />
      )}
      <div className="flex justify-between px-6 items-center">
        <h1 className="heading glittery-shadow py-6">Friends</h1>
        <button
          onClick={(e) => onPlusClickEvent(e, "Friends")}
          className="invitation-btn edit-text edit-btn-shadow py-2 px-4"
        >
          Add friend <span className="font-bold">+</span>{" "}
        </button>
      </div>
      <ul>
        {friendExpenses.map((friend) => (
          <div key={friend.friend.id}>
            <FriendHeader friendExpenses={friend} onClickEvent={onClickEvent} />
          </div>
        ))}
      </ul>
    </div>
  );
}

export default Friends;
