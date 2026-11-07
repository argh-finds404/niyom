"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LedgerColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Optional comparator key for column sorting. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
}

interface LedgerDataTableProps<T> {
  caption: string;
  columns: LedgerColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  defaultSortColumnId?: string;
  defaultSortDirection?: "asc" | "desc";
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

/**
 * A sortable table for dense comparison, alongside the editorial card views.
 * Used across the Directory (`ExploreScreen`) and Preparation Plan (`MyPlanScreen`)
 * for high-density tabular inspection alongside editorial cards.
 */
export function LedgerDataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  defaultSortColumnId,
  defaultSortDirection = "asc",
  onRowClick,
  emptyMessage = "No matching entries in the ledger.",
  className,
}: LedgerDataTableProps<T>) {
  const [sortColId, setSortColId] = useState<string | undefined>(defaultSortColumnId);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDirection);

  const sortedRows = useMemo(() => {
    if (!sortColId) return rows;
    const col = columns.find((c) => c.id === sortColId);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, columns, sortColId, sortDir]);

  const handleSort = (colId: string) => {
    if (sortColId === colId) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColId(colId);
      setSortDir("asc");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--r-panel)] bg-ink/[0.035] py-14 text-center">
        <p className="text-[19px] italic text-ink-2">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[var(--r-panel)] bg-paper shadow-[inset_0_0_0_1px_var(--hair)]",
        className
      )}
    >
      <table className="w-full min-w-[680px] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink/15">
            {columns.map((col) => {
              const isSorted = sortColId === col.id;
              const sortable = Boolean(col.sortValue);
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={
                    !sortable
                      ? undefined
                      : isSorted
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                  }
                  className={cn(
                    "px-4 py-3 text-[14.5px] font-normal italic text-ink-3",
                    col.align === "right" && "text-right",
                    col.className
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 transition-colors hover:text-ink",
                        isSorted && "text-ink",
                        col.align === "right" && "ml-auto flex-row-reverse"
                      )}
                    >
                      <span>{col.header}</span>
                      {isSorted ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-ink" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-ink" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-45" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {sortedRows.map((row) => {
            const key = getRowKey(row);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                className={cn(
                  "align-top transition-colors",
                  onRowClick
                    ? "cursor-pointer hover:bg-sunken/65 focus-visible:bg-sunken focus-visible:outline-none"
                    : "hover:bg-sunken/35"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "px-4 py-3.5 text-[15px] text-ink",
                      col.align === "right" && "text-right num",
                      col.className
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

