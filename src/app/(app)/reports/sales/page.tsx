import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseParams, type RawParams } from "@/lib/report-params";
import { reportAccess } from "@/lib/report-access";
import { runSales } from "@/lib/report-run";
import { SalesView } from "@/components/reports/sales-view";

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const p = parseParams(await searchParams);
  const access = await reportAccess(await headers());
  if (access.status === "signed-out") redirect("/sign-in");
  if (access.status === "forbidden") redirect("/dashboard");

  const { context, data } = await runSales(access.organizationId, p, access.canViewMargins);
  return <SalesView p={p} context={context} d={data} canViewMargins={access.canViewMargins} />;
}
