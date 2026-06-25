export default function InvestmentGoals() {
  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-5 shadow-2xl mb-6">

      <div className="flex justify-between items-center mb-6">

        <div>
          <p className="text-gray-400 text-sm">
            Investments
          </p>

          <h3 className="text-2xl font-bold mt-1">
            Growth Portfolio
          </h3>
        </div>

        <p className="text-green-400 font-semibold">
          +14.8%
        </p>

      </div>

      <div className="space-y-5">

        <div>

          <div className="flex justify-between text-sm mb-2">
            <p className="text-gray-400">
              Real Estate
            </p>

            <p>
              64%
            </p>
          </div>

          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div className="w-[64%] h-full bg-green-500 rounded-full"></div>
          </div>

        </div>

        <div>

          <div className="flex justify-between text-sm mb-2">
            <p className="text-gray-400">
              Crypto Assets
            </p>

            <p>
              38%
            </p>
          </div>

          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div className="w-[38%] h-full bg-blue-500 rounded-full"></div>
          </div>

        </div>

        <div>

          <div className="flex justify-between text-sm mb-2">
            <p className="text-gray-400">
              Stocks
            </p>

            <p>
              82%
            </p>
          </div>

          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div className="w-[82%] h-full bg-yellow-500 rounded-full"></div>
          </div>

        </div>

      </div>

    </div>
  );
}