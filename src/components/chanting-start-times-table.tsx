/**
 * Chanting #1 / #2 start times by zone (shared across participant + host instructions).
 */
export default function ChantingStartTimesTable() {
  return (
    <>
      <h3 className="text-base font-semibold text-[#3b1a1f]">
        Start times (start chanting exactly at these times)
      </h3>
      <div className="mt-4 overflow-x-auto rounded-xl border border-[#e5c18e] bg-[#fff9ef]">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm text-[#6b4e3d]">
          <thead>
            <tr className="border-b border-[#e5c18e] bg-[#fff1d6]">
              <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                &nbsp;
              </th>
              <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                US EDT
              </th>
              <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                US CDT
              </th>
              <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                US PDT
              </th>
              <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                India
              </th>
              <th className="px-3 py-2 font-semibold text-[#3b1a1f]">
                GMT
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#e5c18e]/70">
              <td className="px-3 py-2 font-medium text-[#3b1a1f]">
                Chanting #1
              </td>
              <td className="px-3 py-2">10:15 am</td>
              <td className="px-3 py-2">9:15 am</td>
              <td className="px-3 py-2">7:15 am</td>
              <td className="px-3 py-2">7:45 pm</td>
              <td className="px-3 py-2">2:15 pm</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium text-[#3b1a1f]">
                Chanting #2
              </td>
              <td className="px-3 py-2">10:35 am</td>
              <td className="px-3 py-2">9:35 am</td>
              <td className="px-3 py-2">7:35 am</td>
              <td className="px-3 py-2">8:05 pm</td>
              <td className="px-3 py-2">2:35 pm</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
