export default function CircularProfile({ value, bgColor }) {
  return (
    <div className={`w-8 h-8 rounded-full ${bgColor} border-2 border-white flex items-center justify-center text-xs font-semibold`}>
      {value}
    </div>
  );
}
