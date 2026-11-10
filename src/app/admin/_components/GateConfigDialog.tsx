"use client";

import { useState } from "react";
import { MapPin, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ActionForm from "./ActionForm";
import GateFields from "./GateFields";
import { setGateActive, updateGate } from "../actions";

type ConfigGate = {
  id: string;
  name?: string;
  location?: string;
  lat: number;
  lng: number;
  hasDevice: boolean;
  active: boolean;
};

/**
 * One dialog that configures one gate: its record (name/location/coords/device) and whether it
 * shows on the map — the row itself stays a single quiet icon. Every successful submit closes
 * the dialog; the list behind it refreshes via the actions' revalidatePath.
 */
export default function GateConfigDialog({ gate }: { gate: ConfigGate }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const display = gate.name || gate.id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label={`จัดการประตูน้ำ ${display}`} title="จัดการประตูน้ำ">
          <Settings2 strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(28rem,calc(100vw-2rem))] sm:max-w-[28rem]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tint-blue text-accent">
              <MapPin className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate">{display}</DialogTitle>
              <p className="mt-0.5 truncate text-sm text-muted">
                {gate.id} · {gate.location || "ไม่ระบุที่ตั้ง"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-5">
          <section className="grid gap-3">
            <h3 className="text-base font-bold text-fg">ข้อมูลประตูน้ำ</h3>
            <ActionForm action={updateGate} className="grid gap-4" onSuccess={close}>
              <input type="hidden" name="id" value={gate.id} />
              <GateFields
                name={gate.name}
                location={gate.location}
                lat={gate.lat}
                lng={gate.lng}
                hasDevice={gate.hasDevice}
              />
              <Button type="submit" className="justify-self-start">
                บันทึกการแก้ไข
              </Button>
            </ActionForm>
          </section>

          <section className="grid gap-3">
            <h3 className="text-base font-bold text-fg">การแสดงผล</h3>
            <ActionForm
              action={setGateActive}
              className="grid gap-3 rounded-md bg-bg px-4 py-3"
              confirm={
                gate.active
                  ? `ซ่อน “${display}” จากแผนที่และแดชบอร์ด?`
                  : `แสดง “${display}” บนแผนที่อีกครั้ง?`
              }
              confirmTone={gate.active ? "danger" : "info"}
              onSuccess={close}
            >
              <input type="hidden" name="id" value={gate.id} />
              <input type="hidden" name="active" value={gate.active ? "false" : "true"} />
              <Button type="submit" variant={gate.active ? "destructive" : "outline"} className="w-full">
                {gate.active ? "ซ่อนประตูน้ำนี้" : "แสดงประตูน้ำนี้"}
              </Button>
              {/* WHY: the wording must not suggest it closes the physical gate. */}
              <p className="text-xs text-muted">ซ่อนจากแผนที่และแดชบอร์ด ไม่มีผลกับประตูน้ำจริง</p>
            </ActionForm>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
