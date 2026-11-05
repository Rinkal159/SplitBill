import React, { useState } from "react";
import InviteFriend from "../friend/InviteFriend";
import { useNavigate } from "react-router-dom";
import Loading from "../loading/Loading";

function SidebarTitles({
  value,
  isActive = false,
  subValues,
  plus,
  handlePlusClick,
  handleSubvalueClick,
  activeSubvalue,
  isGroup = false,
  isLoading,
}) {
  const subValueLength = subValues.length;

  return (
    <div
      className={`
        group text-lg text-center py-4 relative hover:cursor-pointer
        ${
          isActive
            ? "font-medium bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-tl-2xl rounded-tr-2xl shadow-md shadow-blue-100"
            : "text-slate-400 shadow-md shadow-blue-50 hover:shadow-blue-100"
        }
      `}
    >
      <h1
        className={`
            inline-flex items-center justify-center gap-2 ${subValueLength > 0 && "group-hover:pb-1"}
          ${isActive ? "glittery-shadow" : "group-hover:glittery-shadow"}
        `}
      >
        {value}{" "}
        {subValueLength > 0 && !plus && (
          <i
            className={`fa-solid fa-angle-down absolute right-4 text-slate-400 ${isActive ? "bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 bg-clip-text text-transparent" : "group-hover:bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 group-hover:bg-clip-text group-hover:text-transparent"}`}
          ></i>
        )}
        {plus && (
          <i
            onClick={handlePlusClick}
            class={`fa-solid fa-plus text-sm absolute right-4 text-slate-400 hover:bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 hover:bg-clip-text hover:text-transparent cursor-pointer`}
          ></i>
        )}
      </h1>

      {subValueLength > 0 && (
        <ul
          className={`overflow-x-hidden overflow-y-auto
    ${isActive ? "opacity-100" : "max-h-0 opacity-0"}
    trans
    ${!isActive && `group-hover:max-h-36 group-hover:opacity-100`}
  `}
        >
          {isLoading ? (
            value == "Friends" ? (
              <Loading msg={"friends"} sidebar={true} />
            ) : (
              <Loading msg={"groups"} sidebar={true} />
            )
          ) : (
            subValues.map((val) => {
              const key =
                typeof val === "string" ? val : isGroup ? val.group.id : val.id;

              return (
                <li
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubvalueClick(val);
                  }}
                  className={`cursor-pointer py-1 text-sm ${
                    activeSubvalue === key
                      ? "font-semibold text-slate-600"
                      : "font-medium text-slate-400 hover:text-slate-500"
                  }`}
                >
                  {typeof val === "string"
                    ? val
                    : isGroup
                      ? val.group.name
                      : val.name}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default SidebarTitles;
