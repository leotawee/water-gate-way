import RequiredMark from "./RequiredMark";

const input = "input-field w-full";
const label = "flex flex-col gap-1.5 text-sm font-bold text-fg";

/** Shared field set for gate create and edit. The id is fixed once created (edit sends it as a hidden field).
 *  The red asterisk marks required fields; each of those inputs also carries the real `required` attribute. */
export default function GateFields({
  name,
  location,
  lat,
  lng,
  hasDevice,
}: {
  name?: string;
  location?: string;
  lat?: number;
  lng?: number;
  hasDevice?: boolean;
}) {
  return (
    <>
      <label className={label}>
        ชื่อ <RequiredMark />
        <input name="name" required maxLength={100} defaultValue={name} className={input} />
      </label>
      <label className={label}>
        ที่ตั้ง
        <input name="location" maxLength={200} defaultValue={location} className={input} />
      </label>
      <label className={label}>
        ละติจูด <RequiredMark />
        <input name="lat" type="number" step="any" min={-90} max={90} required defaultValue={lat} className={input} />
      </label>
      <label className={label}>
        ลองจิจูด <RequiredMark />
        <input name="lng" type="number" step="any" min={-180} max={180} required defaultValue={lng} className={input} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-fg sm:col-span-2">
        <input name="hasDevice" type="checkbox" defaultChecked={hasDevice} className="size-4 accent-fg" />
        มีอุปกรณ์ (STM32 และกล้อง)
      </label>
    </>
  );
}
