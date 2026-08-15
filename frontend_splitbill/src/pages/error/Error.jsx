export default function Error({ errors }) {

  return (
    <div>
      <ul>
        {errors.map((err, i) => (
          <li
            className="text-red-500 font-medium text-center bg-rose-100 py-2 px-4"
            key={i}
          >
            {typeof err === "string"
              ? err
              : `${err[i]?.field}: ${err[i]?.error_message}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
