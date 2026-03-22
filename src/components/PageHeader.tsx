"use client";

import * as React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
