"use client";

import React, { use } from "react";
import { SellerProductEditor } from "@/components/seller-product-editor";

export default function EditSellerProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = use(params);
  const { created } = use(searchParams);
  return (
    <SellerProductEditor
      initialProductId={id}
      createdNotice={created === "draft" || created === "submitted" ? created : undefined}
    />
  );
}
