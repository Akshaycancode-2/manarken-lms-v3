import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  FilterBar,
  Field,
  HeatCell,
  HeatLegend,
  Kpi,
  KpiGrid,
  MultiSelect,
  PageTitle,
  PeriodPicker,
  Shell,
  Table,
} from "@/components/dashboard/ui";
import { groupBy } from "@/lib/lms";
import { useLms, usePeriod } from "@/lib/lms-context";

export const Route = createFileRoute("/region")({
  head: () => ({
    meta: [
      { title: "Region-wise LMS Consumption | LMS Dashboard" },
      {
        name: "description",
        content:
          "Region-level LMS heat map showing teacher assignment, video usage and assessment usage for schools within the selected region.",
      },
      { property: "og:title", content: "Region-wise LMS consumption" },
      {
        property: "og:description",
        content:
          "School/district heat map of video and assessment usage within each region of the DMS network.",
      },
    ],
  }),
  component: RegionPage,
});

function RegionPage() {
  const { consumed, heatRow, isEligible, regionOf, regions, teachers } = useLms();
  const [period, setPeriod] = usePeriod();
  const [regionSel, setRegionSel] = useState<string[]>(regions[0] ? [regions[0]] : []);

  const data = useMemo(() => {
    const group = teachers.filter(
      (t) => regionSel.length === 0 || regionSel.includes(regionOf(t)),
    );
    const eligible = group.filter(isEligible);
    return {
      teachers: group.length,
      eligible: eligible.length,
      started: eligible.filter((t) => consumed(t, period)).length,
      schools: new Set(group.map((t) => t["School Name"])).size,
      heat: [...groupBy(group, (t) => t["School Name"]).entries()]
        .map(([school, list]) => heatRow(school, list, period))
        .sort((a, b) => b.overallVideoUsage - a.overallVideoUsage),
    };
  }, [regionSel, period]);

  return (
    <Shell>
      <PageTitle title="Region-wise data" />
      <FilterBar>
        <PeriodPicker period={period} onChange={setPeriod} />
        <Field label="Region">
          <MultiSelect
            values={regionSel}
            onChange={setRegionSel}
            options={regions}
            placeholder="All regions"
          />
        </Field>
      </FilterBar>

      <KpiGrid>
        <Kpi label="Number of schools in region" value={data.schools} />
        <Kpi label="Number of model school teachers" value={data.teachers} />
        <Kpi
          label="Number of eligible teacher = teacher with video or assessment enabled courses"
          value={`${data.eligible} / ${data.teachers}`}
          tone="positive"
        />
        <Kpi
          label="Number of eligible teachers who started ≥1 course"
          value={`${data.started} / ${data.eligible}`}
          tone="positive"
        />
      </KpiGrid>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-foreground">Region heat map</h2>
      <HeatLegend />
      <Table
        head={[
          "A · S no",
          "C · School / district",
          "D · Total teachers",
          "E · Teachers with assigned courses",
          "F · Teachers with video-enabled courses",
          "G · Eligible teachers who watched ≥1 video",
          "H = G/F · Video usage among eligible teachers",
          "I = G/D · Overall video usage",
          "J · Teachers with assessment-enabled courses",
          "K · Eligible teachers who attempted ≥1 assessment",
          "L = K/J · Assessment usage among eligible teachers",
          "M = K/D · Overall assessment usage",
          "N · Remarks",
        ]}
      >
        {data.heat.map((r, i) => (
          <tr key={r.key}>
            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
            <td className="px-3 py-2 font-medium text-foreground">{r.key}</td>
            <td className="px-3 py-2 text-center tabular-nums">{r.total}</td>
            <td className="px-3 py-2 text-center tabular-nums">{r.assigned}</td>
            <td className="px-3 py-2 text-center tabular-nums">{r.videoEligible}</td>
            <td className="px-3 py-2 text-center tabular-nums">{r.videoConsumers}</td>
            <HeatCell value={r.videoUsage} />
            <HeatCell value={r.overallVideoUsage} />
            <td className="px-3 py-2 text-center tabular-nums">{r.assessmentEligible}</td>
            <td className="px-3 py-2 text-center tabular-nums">{r.assessmentConsumers}</td>
            <HeatCell value={r.assessmentUsage} />
            <HeatCell value={r.overallAssessmentUsage} />
            <td className="px-3 py-2 text-xs text-muted-foreground">{r.remarks}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">
        Regions come from column B of the teacher data sheet.
      </p>
    </Shell>
  );
}
