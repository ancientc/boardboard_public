"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ShareDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Share
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Share board">
        <div className="flex flex-col gap-3">
          <Input readOnly value={typeof window !== "undefined" ? window.location.href : ""} />
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Dialog>
    </>
  );
}
