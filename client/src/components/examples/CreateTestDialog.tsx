import { useState } from "react";
import { CreateTestDialog } from "../CreateTestDialog";
import { Button } from "@/components/ui/button";

export default function CreateTestDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Create Test Dialog</Button>
      <CreateTestDialog
        open={open}
        onOpenChange={setOpen}
        onCreateTest={(data) => console.log("Test created:", data)}
      />
    </>
  );
}
