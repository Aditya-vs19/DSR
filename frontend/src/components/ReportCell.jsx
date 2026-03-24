import React from "react";

const statusStyles = {
  Received: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Not Received": "bg-rose-100 text-rose-800 border-rose-200",
  Leave: "bg-amber-100 text-amber-800 border-amber-200"
};

const statusOptions = ["Received", "Not Received", "Leave"];

function ReportCell({ value, onChange, disabled = false }) {
  const style = statusStyles[value] || statusStyles["Not Received"];

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={`w-full min-w-[120px] rounded-md border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-300 ${style} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
    >
      {statusOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export default ReportCell;
