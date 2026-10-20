"use client";

import React, { use } from "react";
import { SellerProductEditor } from "@/components/seller-product-editor";

export default function EditSellerProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SellerProductEditor initialProductId={id} />;
}
