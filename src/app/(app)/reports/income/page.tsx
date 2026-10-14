import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseParams, type RawParams } from "@/lib/report-params";
import { reportAccess } from "@/lib/report-access";
import { runIncome } from "@/lib/report-run";
import { IncomeView } from "@/components/reports/income-view";

export default async function IncomeReportPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const p = parseParams(await searchParams);
  const access = await reportAccess(await headers());
  if (access.status === "signed-out") redirect("/sign-in");
  if (access.status === "forbidden") redirect("/dashboard");

  const { context, data } = await runIncome(access.organizationId, p, access.canViewMargins);
  return <IncomeView p={p} context={context} d={data} />;
}
