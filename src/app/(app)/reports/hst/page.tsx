import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseParams, type RawParams } from "@/lib/report-params";
import { reportAccess } from "@/lib/report-access";
import { runHst } from "@/lib/report-run";
import { HstView } from "@/components/reports/hst-view";

export default async function HstReportPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const p = parseParams(await searchParams);
  const access = await reportAccess(await headers());
  if (access.status === "signed-out") redirect("/sign-in");
  if (access.status === "forbidden") redirect("/dashboard");

  const { context, data } = await runHst(access.organizationId, p, access.canViewMargins);
  return <HstView p={p} context={context} d={data} canViewMargins={access.canViewMargins} />;
}
