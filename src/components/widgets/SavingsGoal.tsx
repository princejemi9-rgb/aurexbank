export default function SavingsGoal() {
  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-5 mb-6 shadow-2xl">

      <div className="flex justify-between items-center mb-4">

        <div>
          <p className="text-gray-400 text-sm">
            Savings Goal
          </p>

          <h3 className="text-2xl font-bold mt-1">
            Dubai Vacation
          </h3>
        </div>

        <p className="text-green-400 font-semibold">
          72%
        </p>

      </div>

      <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div className="w-[72%] h-full bg-green-500 rounded-full"></div>
      </div>

      <div className="flex justify-between mt-3 text-sm text-gray-500">
        <p>$7,200 saved</p>
        <p>$10,000 target</p>
      </div>

    </div>
  );
}