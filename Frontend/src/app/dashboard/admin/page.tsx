import { PageHeader } from "@/components/shared/page-header";
import { GarmentTable } from "@/components/admin/garment-table";
import { AddGarmentDialog } from "@/components/admin/add-garment-dialog";
import { MOCK_GARMENTS } from "@/lib/data";

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Manage Garments"
        description="Add, edit, or remove garments from your store's catalog."
        actions={<AddGarmentDialog />}
      />
      <GarmentTable data={MOCK_GARMENTS} />
    </div>
  );
}
