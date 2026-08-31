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

export const Route = createFileRoute("/lead")({
  head: () => ({
    meta: [
      { title: "Lead-wise LMS Consumption | LMS Dashboard" },
      {
        name: "description",
        content:
          "Lead-level LMS view: courses, subjects, teacher eligibility and a school/district heat map for the selected vertical lead.",
      },
      { property: "og:title", content: "Lead-wise LMS consumption" },
      {
        property: "og:description",
        content:
          "Select a vertical lead to see course coverage, eligible teachers and a school-level video and assessment heat map.",
      },
    ],
  }),
  component: LeadPage,
});

function LeadPage() {
  const {
    consumed,
    heatRow,
    isEligible,
    leads,
    teacherMatches,
    teacherRows,
    teachers,
    watchedVideo,
  } = useLms();
  const [period, setPeriod] = usePeriod();
  const [leadSel, setLeadSel] = useState<string[]>(leads[0] ? [leads[0]] : []);
  const [subjects, setSubjects] = useState<string[]>([]);

  const leadTeachersAll = useMemo(
    () => teachers.filter((t) => leadSel.length === 0 || leadSel.includes(t.Lead)),
    [leadSel, teachers],
  );
  const leadSubjects = useMemo(
    () =>
      [
        ...new Set(
          teacherRows
            .filter((t) => leadSel.length === 0 || leadSel.includes(t.Lead))
            .map((t) => t.Subjects),
        ),
      ]
        .filter(Boolean)
        .sort(),
    [leadSel, teacherRows],
  );

  /** Buffer teachers hold no subject, so they never receive mapped courses. */
  const bufferStaff = useMemo(() => {
    const ids = new Set<number>();
    for (const t of teacherRows) {
      if (String(t["Class Handling Type"] ?? "").trim().toLowerCase() === "buffer")
        ids.add(t["Staff ID"]);
    }
    return ids;
  }, [teacherRows]);

  const data = useMemo(() => {
    const group = leadTeachersAll.filter(
      (t) => subjects.length === 0 || subjects.some((s) => teacherMatches(t, s, "")),
    );
    const eligible = group.filter(isEligible);
    // Buffer teachers hold no subject and so no courses; anyone tagged Buffer
    // who still has mapped courses is counted as eligible, not buffer.
    const eligibleIds = new Set(eligible.map((t) => t["Staff ID"]));
    const buffer = group.filter(
      (t) => bufferStaff.has(t["Staff ID"]) && !eligibleIds.has(t["Staff ID"]),
    ).length;
    return {
      teachers: group.length,
      eligible: eligible.length,
      // Eligible + not-trackable + buffer must add up to the total teacher count.
      notEligible: group.length - eligible.length - buffer,
      buffer,
      watchedVideo: group.filter((t) => watchedVideo(t, period)).length,
      started: eligible.filter((t) => consumed(t, period)).length,
      heat: [...groupBy(group, (t) => t["School Name"]).entries()]
        .map(([school, list]) => heatRow(school, list, period))
        .sort((a, b) => b.overallVideoUsage - a.overallVideoUsage),
    };
  }, [leadSel, subjects, period, leadTeachersAll, bufferStaff]);

  return (
    <Shell>
      <PageTitle title="Lead-wise data" />
      <FilterBar>
        <PeriodPicker period={period} onChange={setPeriod} />
        <Field label="Lead">
          <MultiSelect
            values={leadSel}
            onChange={(v) => {
              setLeadSel(v);
              setSubjects([]);
            }}
            options={leads}
            placeholder="All leads"
          />
        </Field>
        <Field label="Subject">
          <MultiSelect
            values={subjects}
            onChange={setSubjects}
            options={leadSubjects}
            placeholder="All subjects"
          />
        </Field>
      </FilterBar>

      <KpiGrid>
        <Kpi label="Number of teachers under this lead" value={data.teachers} />
        <Kpi
          label="Number of eligible teacher = teacher with video or assessment enabled courses"
          value={`${data.eligible} / ${data.teachers}`}
          tone="positive"
        />
        <Kpi
          label="Number of teacher whose data tracking is not possible"
          value={`${data.notEligible} / ${data.teachers}`}
          tone="warning"
        />
        <Kpi
          label="Number of buffer teachers (no subject, no courses)"
          value={data.buffer}
        />
      </KpiGrid>
      <div className="mt-4">
        <KpiGrid>
          <Kpi
            label="Number of eligible teachers who started ≥1 course"
            value={`${data.started} / ${data.eligible}`}
            hint={`${data.watchedVideo} watched ≥1 video`}
            tone="positive"
          />
        </KpiGrid>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-foreground">
        School / district heat map
      </h2>
      <HeatLegend />
      <Table
        head={[
          "A · S no",
          "B · School / district",
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
    </Shell>
  );
}
