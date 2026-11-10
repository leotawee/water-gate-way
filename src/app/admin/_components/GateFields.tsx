"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RequiredMark from "./RequiredMark";

/** Shared field set for gate create and edit. The id is fixed once created (edit sends it as a hidden field).
 *  The red asterisk marks required fields; each of those inputs also carries the real `required` attribute.
 *  WHY useId: this renders once in the create dialog and once per row in the edit list — literal ids
 *  would collide across the page. */
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
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={id("name")}>
          ชื่อ <RequiredMark />
        </Label>
        <Input id={id("name")} name="name" required maxLength={100} defaultValue={name} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("location")}>ที่ตั้ง</Label>
        <Input id={id("location")} name="location" maxLength={200} defaultValue={location} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("lat")}>
          ละติจูด <RequiredMark />
        </Label>
        <Input id={id("lat")} name="lat" type="number" step="any" min={-90} max={90} required defaultValue={lat} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("lng")}>
          ลองจิจูด <RequiredMark />
        </Label>
        <Input id={id("lng")} name="lng" type="number" step="any" min={-180} max={180} required defaultValue={lng} />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-fg sm:col-span-full">
        <input name="hasDevice" type="checkbox" defaultChecked={hasDevice} className="size-4 accent-fg" />
        มีอุปกรณ์ (STM32 และกล้อง)
      </label>
    </>
  );
}
