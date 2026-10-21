import { Suspense } from "react";
import { Router } from "@/components/router";
import { Skeleton } from "@/components/ui";
export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Router />
    </Suspense>
  );
}
