import { Suspense } from "react";
import DataClient from "./data-client";

export default function DataPage() {
  return (
    <Suspense fallback={null}>
      <DataClient />
    </Suspense>
  );
}
