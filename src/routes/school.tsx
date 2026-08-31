import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  FilterBar,
  Field,
  Kpi,
  KpiGrid,
  MultiSelect,
  PageTitle,
  PeriodPicker,
  Shell,
  Table,
  Tag,
} from "@/components/dashboard/ui";
import { useLms, usePeriod } from "@/lib/lms-context";

export const Route = createFileRoute("/school")({
  head: () => ({
    meta: [
      { title: "School-wise Teacher Consumption | LMS Dashboard" },
      {
        name: "description",
        content:
          "School-level LMS summary with a teacher-level table showing consumption eligibility and whether each teacher started a course.",
      },
      { property: "og:title", content: "School-wise teacher consumption" },
      {
        property: "og:description",
        content:
          "Course coverage, eligibility counts and a per-teacher consumption table for the selected DMS school.",
      },
    ],
  }),
  component: SchoolPage,
});

function SchoolPage() {
  const {
    consumed,
    didAssessment,
    isEligible,
    leads,
    mappedCoursesFor,
    schools,
    teachers,
    watchedVideo,
  } = useLms();
  const [period, setPeriod] = usePeriod();
  const [leadSel, setLeadSel] = useState<string[]>([]);
  const [schoolSel, setSchoolSel] = useState<string[]>(schools[0] ? [schools[0]] : []);

  const schoolOptions = useMemo(
    () =>
      leadSel.length === 0
        ? schools
        : [
            ...new Set(
              teachers
                .filter((t) => leadSel.includes(t.Lead))
                .map((t) => t["School Name"]),
            ),
          ].sort(),
    [leadSel, schools, teachers],
  );

  const data = useMemo(() => {
    const group = teachers.filter(
      (t) =>
        (leadSel.length === 0 || leadSel.includes(t.Lead)) &&
        (schoolSel.length === 0 || schoolSel.includes(t["School Name"])),
    );
    const eligible = group.filter(isEligible);
    return {
      teachers: group,
      eligible: eligible.length,
      notEligible: group.length - eligible.length,
      consumedCount: eligible.filter((t) => consumed(t, period)).length,
    };
  }, [schoolSel, leadSel, period]);

  return (
    <Shell>
      <PageTitle title="School-wise data" />
      <FilterBar>
        <PeriodPicker period={period} onChange={setPeriod} />
        <Field label="Lead">
          <MultiSelect
            values={leadSel}
            onChange={(v) => {
              setLeadSel(v);
              setSchoolSel([]);
            }}
            options={leads}
            placeholder="All leads"
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
      </FilterBar>

      <KpiGrid>
        <Kpi label="Number of teachers under this school" value={data.teachers.length} />
        <Kpi
          label="Number of eligible teacher = teacher with video or assessment enabled courses"
          value={`${data.eligible} / ${data.teachers.length}`}
          tone="positive"
        />
        <Kpi
          label="Number of teacher whose data tracking is not possible"
          value={`${data.notEligible} / ${data.teachers.length}`}
          tone="warning"
        />
        <Kpi
          label="Number of eligible teachers who started ≥1 course"
          value={`${data.consumedCount} / ${data.eligible}`}
          tone="positive"
        />
      </KpiGrid>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-foreground">Teacher-level table</h2>
      <Table
        head={[
          "A · S no",
          "C · Staff ID",
          "D · Staff name",
          "E · Class / section",
          "F · Subjects",
          "G · Number of mapped courses",
          "H · Teacher with video or assessment enabled courses?",
          "I · Eligible teacher who started ≥1 course?",
        ]}
      >
        {data.teachers.map((t, i) => {
          const mapped = mappedCoursesFor(t["Staff ID"]);
          const eligible = isEligible(t);
          const did = consumed(t, period);
          return (
            <tr key={t["Staff ID"]}>
              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 text-center tabular-nums">{t["Staff ID"]}</td>
              <td className="px-3 py-2 font-medium text-foreground">{t["Staff Name"]}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {t.Class} / {t.Section}
              </td>
              <td className="px-3 py-2">{t.Subjects}</td>
              <td className="px-3 py-2 text-center tabular-nums">{mapped.length}</td>
              <td className="px-3 py-2">
                <Tag yes={eligible} />
              </td>
              <td className="px-3 py-2">
                <Tag yes={did} />
                {did ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {[watchedVideo(t, period) && "video", didAssessment(t, period) && "assessment"]
                      .filter(Boolean)
                      .join(" + ")}
                  </span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </Table>
    </Shell>
  );
}
