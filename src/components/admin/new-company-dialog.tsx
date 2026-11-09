"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createCompanyAction } from "@/actions/companies";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CompanyForm, type StaffOption } from "./company-form";

export function NewCompanyDialog({ staff }: { staff: StaffOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>Add a client company. You can link contacts on the next screen.</DialogDescription>
        </DialogHeader>
        <CompanyForm action={createCompanyAction} staff={staff} submitLabel="Create company" />
      </DialogContent>
    </Dialog>
  );
}
