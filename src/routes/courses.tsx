import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  FilterBar,
  Field,
  Kpi,
  KpiGrid,
  PageTitle,
  PeriodPicker,
  MultiSelect,
  Shell,
  Table,
} from "@/components/dashboard/ui";
import { useLms, usePeriod } from "@/lib/lms-context";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "Course-level LMS Utilization & Issues | LMS Dashboard" },
      {
        name: "description",
        content:
          "Course-level LMS utilization: login, video and assessment participation per course, filtered by school, region and lead.",
      },
      { property: "og:title", content: "Course-level LMS Utilization & Issues" },
      {
        property: "og:description",
        content:
          "Per-course teacher participation counts, school/region/lead breakdown, non-consumption name lists and content issue flags.",
      },
    ],
  }),
  component: CoursesPage,
});

const ISSUE_OPTIONS = [
  "Course has no assessment",
  "Course has no videos",
  "Course has no videos and no assessment",
];

const listOf = (values: string[]) => {
  const uniq = [...new Set(values.filter(Boolean))].sort();
  if (uniq.length === 0) return "—";
  if (uniq.length <= 2) return uniq.join(", ");
  return `${uniq.length} · ${uniq.slice(0, 2).join(", ")}…`;
};

function CoursesPage() {
  const {
    attemptedCourseAssessment,
    consumed,
    leads,
    regions,
    regionOf,
    schools,
    teacherCourses,
    watchedCourseVideo,
  } = useLms();
  const [period, setPeriod] = usePeriod();
  const [leadSel, setLeadSel] = useState<string[]>([]);
  const [regionSel, setRegionSel] = useState<string[]>([]);
  const [schoolSel, setSchoolSel] = useState<string[]>([]);
  const [issueSel, setIssueSel] = useState<string[]>([]);

  const schoolOptions = useMemo(() => {
    if (regionSel.length === 0) return schools;
    return [
      ...new Set(
        teacherCourses
          .filter((tc) => regionSel.includes(regionOf(tc.teacher)))
          .map((tc) => tc.teacher["School Name"]),
      ),
    ].sort();
  }, [regionSel, schools, teacherCourses, regionOf]);

  const rows = useMemo(() => {
    const scoped = teacherCourses.filter(
      (tc) =>
        (leadSel.length === 0 || leadSel.includes(tc.teacher.Lead)) &&
        (regionSel.length === 0 || regionSel.includes(regionOf(tc.teacher))) &&
        (schoolSel.length === 0 || schoolSel.includes(tc.teacher["School Name"])),
    );
    // One row per course × school.
    const grouped = new Map<string, typeof scoped>();
    for (const tc of scoped) {
      const key = `${tc.course["Course ID"]}||${tc.teacher["School Name"]}`;
      grouped.set(key, [...(grouped.get(key) ?? []), tc]);
    }
    return [...grouped.entries()]
      .map(([rowKey, list]) => {
        const first = list[0]!;
        const course = first.course;
        const id = course["Course ID"];
        const school = first.teacher["School Name"];
        // Teacher rows repeat per section/subject — count each teacher once.
        const assigned = [...new Map(list.map((tc) => [tc.teacher["Staff ID"], tc.teacher])).values()];


        const loggedIn = assigned.filter((t) => consumed(t, period));
        const watched = assigned.filter((t) => watchedCourseVideo(t, id, period));
        const attempted = assigned.filter((t) => attemptedCourseAssessment(t, id, period));
        const issues: string[] = [];
        if (!first.hasVideo && !first.hasAssessment)
          issues.push("Course has no videos and no assessment");
        else {
          if (!first.hasAssessment) issues.push("Course has no assessment");
          if (!first.hasVideo) issues.push("Course has no videos");
        }

        const names = (subset: typeof assigned) => {
          const list = assigned
            .filter((t) => !subset.includes(t))
            .map((t) => t["Staff Name"].trim());
          if (list.length === 0) return "—";
          const shown = list.slice(0, 10).join(", ");
          return list.length > 10 ? `${shown} +${list.length - 10} more` : shown;
        };

        const pct = (n: number) => (assigned.length ? (n / assigned.length) * 100 : 0);
        return {
          rowKey,
          id,
          name: course["Course Name"].replace(/\n/g, " ").trim(),
          subject: course.Subject,
          klass: String(course.Class),
          owner: course["Course Owner"],
          school,
          schools: listOf(assigned.map((t) => t["School Name"])),
          regions: listOf(assigned.map((t) => regionOf(t))),
          teacherLeads: listOf(assigned.map((t) => t.Lead)),
          assigned: assigned.length,
          login: loggedIn.length,
          loginPct: pct(loggedIn.length),
          noLogin: names(loggedIn),
          video: watched.length,
          videoPct: pct(watched.length),
          noVideo: names(watched),
          assessment: attempted.length,
          assessmentPct: pct(attempted.length),
          noAssessment: names(attempted),
          issues,
        };
      })
      .filter((r) => issueSel.length === 0 || issueSel.some((i) => r.issues.includes(i)))
      .sort((a, b) => a.name.localeCompare(b.name) || a.school.localeCompare(b.school));
  }, [
    period,
    leadSel,
    regionSel,
    schoolSel,
    issueSel,
    teacherCourses,
    consumed,
    watchedCourseVideo,
    attemptedCourseAssessment,
    regionOf,
  ]);

  const flagged = rows.filter((r) => r.issues.length > 0);

  return (
    <Shell>
      <PageTitle
        title="Course-level LMS utilization & issues"
        subtitle="Per-course teacher participation by school, region and lead, with content issue flags."
      />
      <FilterBar>
        <PeriodPicker period={period} onChange={setPeriod} />
        <Field label="Region">
          <MultiSelect
            values={regionSel}
            onChange={(v) => {
              setRegionSel(v);
              setSchoolSel([]);
            }}
            options={regions}
            placeholder="All regions"
          />
        </Field>
        <Field label="School">
          <MultiSelect
            values={schoolSel}
            onChange={setSchoolSel}
            options={schoolOptions}
            placeholder="All schools"
          />
        </Field>
        <Field label="Lead">
          <MultiSelect
            values={leadSel}
            onChange={setLeadSel}
            options={leads}
            placeholder="All leads"
          />
        </Field>
        <Field label="Issues">
          <MultiSelect
            values={issueSel}
            onChange={setIssueSel}
            options={ISSUE_OPTIONS}
            placeholder="All rows"
          />
        </Field>
      </FilterBar>


      <KpiGrid>
        <Kpi label="Unique courses in view" value={new Set(rows.map((r) => r.id)).size} />
        <Kpi label="Course × school rows in view" value={rows.length} />
        <Kpi
          label="Courses with flagged issues"
          value={new Set(flagged.map((r) => r.id)).size}
          tone={flagged.length ? "warning" : "positive"}
        />
        <Kpi
          label="No videos"
          value={
            new Set(
              rows.filter((r) => r.issues.some((i) => i.includes("no videos"))).map((r) => r.id),
            ).size
          }
        />
        <Kpi
          label="No assessment"
          value={
            new Set(
              rows
                .filter((r) => r.issues.some((i) => i.includes("no assessment")))
                .map((r) => r.id),
            ).size
          }
        />
      </KpiGrid>

      {flagged.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-warning-soft p-4 text-sm text-warning">
          <strong className="font-semibold">Data flags &amp; issues summary:</strong>{" "}
          {new Set(flagged.map((r) => r.id)).size} of {new Set(rows.map((r) => r.id)).size} unique
          courses in the current selection have missing video or assessment content.
        </div>
      ) : null}

      <div className="mt-6">
        <Table
          head={[
            "Course name",
            "Course ID",
            "Class / Subject",
            "School",
            "Region",
            "Lead",
            "Course owner",
            "Teachers",
            "Logged in (count / %)",
            "Not logged in",
            "Watched ≥1 video (count / %)",
            "Not watched",
            "Attempted ≥1 question (count / %)",
            "Not attempted",
            "Issues",
          ]}
        >
          {rows.map((r) => (
            <tr key={r.rowKey}>
              <td className="max-w-[240px] px-3 py-2 font-medium text-foreground">{r.name}</td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.id}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.klass} · {r.subject}
              </td>
              <td className="max-w-[180px] px-3 py-2 text-xs text-muted-foreground">{r.school}</td>
              <td className="max-w-[140px] px-3 py-2 text-xs text-muted-foreground">{r.regions}</td>
              <td className="max-w-[140px] px-3 py-2 text-xs text-muted-foreground">
                {r.teacherLeads}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.owner}</td>
              <td className="px-3 py-2 text-center tabular-nums">{r.assigned}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.login} · {r.loginPct.toFixed(0)}%
              </td>
              <td className="max-w-[180px] px-3 py-2 text-xs text-muted-foreground">{r.noLogin}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.video} · {r.videoPct.toFixed(0)}%
              </td>
              <td className="max-w-[180px] px-3 py-2 text-xs text-muted-foreground">{r.noVideo}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.assessment} · {r.assessmentPct.toFixed(0)}%
              </td>
              <td className="max-w-[180px] px-3 py-2 text-xs text-muted-foreground">
                {r.noAssessment}
              </td>
              <td className="px-3 py-2 text-xs">
                {r.issues.length ? (
                  <span className="text-warning">{r.issues.join("; ")}</span>
                ) : (
                  <span className="text-positive">None</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </Shell>
  );
}
