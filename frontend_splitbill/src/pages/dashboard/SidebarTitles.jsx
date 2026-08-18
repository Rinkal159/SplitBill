import React, { useState } from "react";
import InviteFriend from "../friend/InviteFriend";
import { useNavigate } from "react-router-dom";

function SidebarTitles({ value, isActive = false, subValues, plus, handlePlusClick, handleSubvalueClick }) {
  const subValueLength = subValues.length;

  const navigate = useNavigate();

  return (
    <div
      className={`
        group text-lg text-center py-4 relative
        ${
          isActive
            ? "font-medium bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-tl-2xl rounded-tr-2xl shadow-md shadow-blue-100"
            : "text-slate-400 shadow-md shadow-blue-50 hover:shadow-blue-100 hover:cursor-pointer"
        }
      `}
    >
      <h1
        className={`
            inline-flex items-center justify-center gap-2 ${subValueLength > 0 && "group-hover:pb-1"}
          ${
            isActive
              ? "bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 bg-clip-text text-transparent"
              : "group-hover:font-medium group-hover:bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 group-hover:bg-clip-text group-hover:text-transparent"
          }
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
          className="overflow-hidden
      max-h-0 opacity-0
      -translate-y-2
      transition-all duration-300 ease-in-out
      group-hover:max-h-96
      group-hover:opacity-100
      group-hover:translate-y-0
    "
        >
          {subValues.map((val, i) => (
            <li
            onClick={(e) => {
              e.stopPropagation();
              handleSubvalueClick(val);
            }}
              key={i}
              className={`
          text-sm font-medium text-slate-400 py-1
          hover:text-slate-500
          cursor-pointer
        `}
            >
              {typeof val === "string" ? val : val.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SidebarTitles;
