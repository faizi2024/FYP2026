import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Garment } from "@/lib/types";

interface GarmentTableProps {
    data: Garment[];
}

export function GarmentTable({ data }: GarmentTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((garment) => (
                        <TableRow key={garment.id}>
                            <TableCell className="font-medium">{garment.name}</TableCell>
                            <TableCell>{garment.type}</TableCell>
                            <TableCell className="text-right">${garment.price.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
