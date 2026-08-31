import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  FilterBar,
  Field,
  Kpi,
  KpiGrid,
  MultiSelect,
  PageTitle,
  Panel,
  PeriodPicker,
  SearchableBarList,
  Select,
  Shell,
} from "@/components/dashboard/ui";
import { courseClasses, groupBy } from "@/lib/lms";
import { useLms, usePeriod } from "@/lib/lms-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overall LMS Consumption Summary | LMS Dashboard" },
      {
        name: "description",
        content:
          "Overall LMS consumption summary: academic courses, teacher tracking eligibility and school and lead-wise consumption rankings.",
      },
      { property: "og:title", content: "Overall LMS consumption summary" },
      {
        property: "og:description",
        content:
          "Course catalogue, teacher eligibility and consumption rankings across DMS schools and vertical leads.",
      },
    ],
  }),
  component: OverallPage,
});

function OverallPage() {
  const {
    allClasses,
    allSubjects,
    consumed,
    courses,
    isEligible,
    leads,
    regionOf,
    regions,
    teacherMatches,
    teachers,
  } = useLms();
  const [period, setPeriod] = usePeriod();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [leadSel, setLeadSel] = useState<string[]>([]);
  const [regionSel, setRegionSel] = useState<string[]>([]);
  const [schoolSort, setSchoolSort] = useState("Top to bottom");

  const data = useMemo(() => {
    const matches = (x: (typeof teachers)[number]) =>
      (subjects.length === 0 || subjects.some((s) => teacherMatches(x, s, ""))) &&
      (classes.length === 0 || classes.some((c) => teacherMatches(x, "", c))) &&
      (leadSel.length === 0 || leadSel.includes(x.Lead)) &&
      (regionSel.length === 0 || regionSel.includes(regionOf(x)));
    const t = teachers.filter(matches);
    // Course counts come straight from the Course Data sheet (owner = lead), so
    // they never shift with teacher-side filters such as region.
    const scoped = courses.filter(
      (c) =>
        (leadSel.length === 0 || leadSel.includes(String(c["Course Owner"]).trim())) &&
        (classes.length === 0 || classes.some((k) => courseClasses(c).includes(k))) &&
        (subjects.length === 0 ||
          subjects.some((s) => {
            const cs = String(c.Subject).trim().toLowerCase();
            const ss = s.trim().toLowerCase();
            return cs === ss || cs.startsWith(`${ss} `);
          })),
    );
    const uniqueCourses = [...new Map(scoped.map((c) => [c["Course ID"], c])).values()];
    const eligible = t.filter(isEligible);
    const started = eligible.filter((x) => consumed(x, period));

    // Denominator = teachers eligible for tracking within the group, not all teachers.
    const rank = (keyFn: (x: (typeof t)[number]) => string) =>
      [...groupBy(t, keyFn).entries()]
        .map(([label, list]) => {
          const el = list.filter(isEligible);
          const used = el.filter((x) => consumed(x, period)).length;
          return {
            label,
            value: used,
            percent: el.length ? (used / el.length) * 100 : 0,
            caption: `${used} / ${el.length} eligible teachers`,
          };
        })
        .sort((a, b) => b.percent - a.percent || b.value - a.value);

    return {
      courseCount: uniqueCourses.length,
      withVideo: uniqueCourses.filter((c) => c["Course Video Status (Yes/No)"] === "Yes").length,
      withAssessment: uniqueCourses.filter(
        (c) => c["Course Assessment Status (Yes/No)"] === "Yes",
      ).length,
      dmsTeachers: t.length,
      eligible: eligible.length,
      notEligible: t.length - eligible.length,
      started: started.length,
      bySchool: rank((x) => x["School Name"]),
      byLead: rank((x) => x.Lead),
    };
  }, [period, subjects, classes, leadSel, regionSel]);

  return (
    <Shell>
      <PageTitle title="Overall Manarkeni LMS consumption summary" />
      <FilterBar>
        <PeriodPicker period={period} onChange={setPeriod} />
        <Field label="Subject">
          <MultiSelect
            values={subjects}
            onChange={setSubjects}
            options={allSubjects}
            placeholder="All subjects"
          />
        </Field>
        <Field label="Class">
          <MultiSelect
            values={classes}
            onChange={setClasses}
            options={allClasses.map(String)}
            placeholder="All classes"
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
        <Kpi label="Number of academic courses" value={data.courseCount} />
        <Kpi
          label="Number of courses ≥1 video"
          value={`${data.withVideo} / ${data.courseCount}`}
        />
        <Kpi
          label="Number of courses with assessment"
          value={`${data.withAssessment} / ${data.courseCount}`}
        />
      </KpiGrid>
      <div className="mt-4">
        <KpiGrid>
          <Kpi label="Number of model school teachers" value={data.dmsTeachers} />
          <Kpi
            label="Number of eligible teacher = teacher with video or assessment enabled courses"
            value={`${data.eligible} / ${data.dmsTeachers}`}
            tone="positive"
          />
          <Kpi
            label="Number of teacher whose data tracking is not possible"
            value={`${data.notEligible} / ${data.dmsTeachers}`}
            tone="warning"
          />
          <Kpi
            label="Number of eligible teachers who started ≥1 course"
            value={`${data.started} / ${data.eligible}`}
            hint={`${data.eligible ? Math.round((data.started / data.eligible) * 100) : 0}% of eligible teachers`}
            tone="positive"
          />
        </KpiGrid>
        <p className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Eligible Teachers</span> are teachers
          mapped to courses with at least one video or one assessment such that their consumption
          can be tracked.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title="School-wise consumption ranking"
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort</span>
              <Select
                value={schoolSort}
                onChange={setSchoolSort}
                options={["Top to bottom", "Bottom to top", "Alphabetical"]}
              />
            </div>
          }
        >
          <SearchableBarList
            items={sortedSchools}
            placeholder="Search school / district…"
          />
        </Panel>
        <Panel title={`Lead-wise consumption ranking (${leads.length} leads)`}>
          <SearchableBarList items={data.byLead} placeholder="Search lead…" />
        </Panel>
      </div>
    </Shell>
  );
}
