"use client";

import * as React from "react";
import { Decimal } from "@prisma/client/runtime/client";
import { ProductStatus, ProductHistory } from "@/generated/prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ProductHistoryTableProps {
  history: ProductHistory[];
}

export function ProductHistoryTable({ history }: ProductHistoryTableProps) {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{entry.version}</TableCell>
              <TableCell>{entry.title}</TableCell>
              <TableCell>{entry.description}</TableCell>
              <TableCell>
                ${(entry.price as Decimal).toNumber().toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    entry.status === ProductStatus.PUBLISHED
                      ? "default"
                      : entry.status === ProductStatus.DRAFT
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {entry.status}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(entry.createdAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
