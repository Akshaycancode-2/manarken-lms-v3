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
import { groupBy } from "@/lib/lms";
import { useFilter, useLms, usePeriod } from "@/lib/lms-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overall LMS Consumption Summary | LMS Dashboard" },
      {
        name: "description",
        content:
          "Overall LMS consumption summary: model school teachers who started a course and school and lead-wise consumption rankings.",
      },
      { property: "og:title", content: "Overall LMS consumption summary" },
      {
        property: "og:description",
        content:
          "Teacher consumption counts and rankings across DMS schools and vertical leads.",
      },
    ],
  }),
  component: OverallPage,
});

function OverallPage() {
  const { allClasses, allSubjects, consumedAll, leads, regionOf, regions, teacherMatches, teachers } =
    useLms();
  const [period, setPeriod] = usePeriod();
  const [subjects, setSubjects] = useFilter("subjects");
  const [classes, setClasses] = useFilter("classes");
  const [leadSel, setLeadSel] = useFilter("leads");
  const [regionSel, setRegionSel] = useFilter("regions");
  const [schoolSort, setSchoolSort] = useState("Top to bottom");

  const data = useMemo(() => {
    const matches = (x: (typeof teachers)[number]) =>
      (subjects.length === 0 || subjects.some((s) => teacherMatches(x, s, ""))) &&
      (classes.length === 0 || classes.some((c) => teacherMatches(x, "", c))) &&
      (leadSel.length === 0 || leadSel.includes(x.Lead)) &&
      (regionSel.length === 0 || regionSel.includes(regionOf(x)));
    const t = teachers.filter(matches);
    const started = t.filter((x) => consumedAll(x, period));

    // Every teacher counts — course mapping is no longer used on this page.
    const rank = (keyFn: (x: (typeof t)[number]) => string) =>
      [...groupBy(t, keyFn).entries()]
        .map(([label, list]) => {
          const used = list.filter((x) => consumedAll(x, period)).length;
          return {
            label,
            value: used,
            percent: list.length ? (used / list.length) * 100 : 0,
            caption: `${used} / ${list.length} teachers`,
          };
        })
        .sort((a, b) => b.percent - a.percent || b.value - a.value);

    return {
      dmsTeachers: t.length,
      started: started.length,
      notStarted: t.length - started.length,
      bySchool: rank((x) => x["School Name"]),
      byLead: rank((x) => x.Lead),
    };
  }, [period, subjects, classes, leadSel, regionSel]);

  const sortedSchools = useMemo(() => {
    const items = [...data.bySchool];
    if (schoolSort === "Bottom to top") {
      items.sort((a, b) => a.percent - b.percent || a.value - b.value);
    } else if (schoolSort === "Alphabetical") {
      items.sort((a, b) => a.label.localeCompare(b.label));
    }
    return items;
  }, [data.bySchool, schoolSort]);

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
        <Kpi label="Number of model school teachers" value={data.dmsTeachers} />
        <Kpi
          label="Number of teachers who started ≥1 course"
          value={`${data.started} / ${data.dmsTeachers}`}
          hint={`${data.dmsTeachers ? Math.round((data.started / data.dmsTeachers) * 100) : 0}% of teachers`}
          tone="positive"
        />
        <Kpi
          label="Number of teachers who didn't start ≥1 course"
          value={`${data.notStarted} / ${data.dmsTeachers}`}
          tone="warning"
        />
      </KpiGrid>

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
          <SearchableBarList items={sortedSchools} placeholder="Search school / district…" />
        </Panel>
        <Panel title={`Lead-wise consumption ranking (${leads.length} leads)`}>
          <SearchableBarList items={data.byLead} placeholder="Search lead…" />
        </Panel>
      </div>
    </Shell>
  );
}
