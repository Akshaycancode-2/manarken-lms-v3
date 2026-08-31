import {
  EXCLUDED_SUBJECTS,
  type AssessmentRow,
  type Course,
  type RawData,
  type Teacher,
  type VideoRow,
} from "@/lib/lms";

export type Warning = {
  level: "error" | "warning" | "info";
  title: string;
  detail: string;
  samples?: string[];
};

export type ParseResult = {
  data: RawData;
  warnings: Warning[];
  counts: { teachers: number; courses: number; video: number; assessment: number };
  sheetMap: Record<string, string>;
};

type Row = Record<string, unknown>;

const has = (row: Row, ...keys: string[]) => keys.every((k) => k in row);

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
/** Some export files write the year as "0226" instead of "2026" — repair it. */
const fixYear = (iso19: string) => {
  const y = Number(iso19.slice(0, 4));
  return y > 0 && y < 1000 ? String(y + 1800).padStart(4, "0") + iso19.slice(4) : iso19;
};
const iso = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date)
    return fixYear(new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 19));
  const s = String(v).trim();
  const m = /^(\d{1,4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(s);
  if (m)
    return fixYear(
      `${m[1]!.padStart(4, "0")}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}`,
    );
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()))
    return fixYear(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19));
  return null;
};

const sample = (items: string[], n = 5) => items.slice(0, n);

/** Parses the weekly workbook in the browser. Sheets are detected by their
 * column headers, not their tab names — the source workbook has the video and
 * assessment tabs swapped. */
export async function parseWorkbook(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });

  const sheets = wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<Row>(wb.Sheets[name]!, { defval: null }),
  })).filter((s) => s.rows.length > 0);

  const warnings: Warning[] = [];
  const sheetMap: Record<string, string> = {};

  const pick = (label: string, test: (row: Row) => boolean) => {
    const found = sheets.filter((s) => test(s.rows[0]!));
    if (found.length > 1) {
      warnings.push({
        level: "warning",
        title: `Multiple sheets look like ${label} data`,
        detail: `Using "${found[0]!.name}". Ignored: ${found.slice(1).map((f) => f.name).join(", ")}.`,
      });
    }
    if (found[0]) sheetMap[label] = found[0].name;
    return found[0]?.rows ?? [];
  };

  const teacherRaw = pick("Teacher", (r) => has(r, "Staff ID", "School Name", "Subjects"));
  const courseRaw = pick("Course", (r) => has(r, "Course ID", "Course Video Status (Yes/No)"));
  const videoRaw = pick("Video consumption", (r) => has(r, "max_watched_minutes"));
  const assessmentRaw = pick("Assessment consumption", (r) => has(r, "attended_questions"));

  for (const [label, rows] of [
    ["Teacher", teacherRaw],
    ["Course", courseRaw],
    ["Video consumption", videoRaw],
    ["Assessment consumption", assessmentRaw],
  ] as const) {
    if (rows.length === 0) {
      warnings.push({
        level: "error",
        title: `${label} sheet not found`,
        detail: `No sheet in this workbook has the expected ${label.toLowerCase()} columns. Tabs seen: ${wb.SheetNames.join(", ")}.`,
      });
    }
  }

  const teachers: Teacher[] = teacherRaw.map((r) => ({
    "UDISE Code": num(r["UDISE Code"]) ?? 0,
    Region: str(r["Region"]),
    "School Name": str(r["School Name"]),
    "Staff User ID": num(r["Staff User ID"]) ?? 0,
    "Staff ID": num(r["Staff ID"]) ?? 0,
    "Staff Name": str(r["Staff Name"]),
    Class: num(r["Class"]) ?? 0,
    Section: str(r["Section"]),
    Subjects: str(r["Subjects"]),
    "Class Handling Type": str(r["Class Handling Type"]),
    Designation: str(r["Designation"]),
    Qualification: str(r["Qualification"]),
    "Mapping Status": str(r["Mapping Status"]),
    "Staff Validation (HR)": str(r["Staff Validation (HR)"]),
    Lead: str(r["Lead"]),
  }));

  const courses: Course[] = courseRaw.map((r) => ({
    Class: str(r["Class"]),
    Subject: str(r["Subject"]),
    "Course ID": num(r["Course ID"]) ?? 0,
    "Course Name": str(r["Course Name"]),
    "Course Owner": str(r["Course Owner"]),
    "Course Video Status (Yes/No)": str(r["Course Video Status (Yes/No)"]),
    "Course Assessment Status (Yes/No)": str(r["Course Assessment Status (Yes/No)"]),
  }));

  const video: VideoRow[] = videoRaw.map((r) => ({
    staff_id: num(r["staff_id"]) ?? 0,
    udise_code: num(r["udise_code"]) ?? 0,
    course_id: num(r["course_id"]) ?? 0,
    video_title: str(r["video_title"]) || null,
    max_watched_minutes: num(r["max_watched_minutes"]),
    completion_percentage: num(r["completion_percentage"]),
    times_opened: num(r["times_opened"]),
    first_watched: iso(r["first_watched"]),
    last_watched: iso(r["last_watched"]),
  }));

  const assessment: AssessmentRow[] = assessmentRaw.map((r) => ({
    staff_id: num(r["staff_id"]) ?? 0,
    name: str(r["name"]),
    course_id: num(r["course_id"]) ?? 0,
    course_title: str(r["course_title"]),
    subject: str(r["subject"]),
    total_questions: num(r["total_questions"]) ?? 0,
    attended_questions: num(r["attended_questions"]) ?? 0,
    total_marks: num(r["total_marks"]) ?? 0,
    date: iso(r["date"]),
  }));

  const data: RawData = { teachers, courses, video, assessment };

  // ---- mapping / integrity checks -------------------------------------
  const dms = teachers.filter((t) => /DMS$/i.test(t["School Name"]));
  if (teachers.length && dms.length === 0) {
    warnings.push({
      level: "error",
      title: "No DMS schools in Teacher sheet",
      detail: "The dashboard only reports on schools whose name ends with 'DMS'. None were found.",
    });
  } else if (dms.length < teachers.length) {
    warnings.push({
      level: "info",
      title: "Non-DMS teacher rows skipped",
      detail: `${(teachers.length - dms.length).toLocaleString()} of ${teachers.length.toLocaleString()} teacher rows are not DMS schools and are excluded from all pages.`,
    });
  }

  const missing = (label: string, rows: Teacher[], field: keyof Teacher) => {
    const bad = rows.filter((t) => !String(t[field]).trim());
    if (bad.length)
      warnings.push({
        level: "warning",
        title: `${bad.length} teacher rows have no ${label}`,
        detail: `These rows still count as teachers but fall into an "Unassigned" bucket in ${label} views.`,
        samples: sample(bad.map((t) => `${t["Staff Name"]} (${t["Staff ID"]})`)),
      });
  };
  missing("Region", dms, "Region");
  missing("Lead", dms, "Lead");

  const nameById = new Map<number, string>();
  const conflicts: string[] = [];
  for (const t of dms) {
    const prev = nameById.get(t["Staff ID"]);
    if (prev && prev !== t["Staff Name"]) conflicts.push(`${t["Staff ID"]}: "${prev}" vs "${t["Staff Name"]}"`);
    else nameById.set(t["Staff ID"], t["Staff Name"]);
  }
  if (conflicts.length)
    warnings.push({
      level: "warning",
      title: `${conflicts.length} Staff IDs map to more than one name`,
      detail: "Headcounts deduplicate by Staff ID, so only the first name is shown for these.",
      samples: sample([...new Set(conflicts)]),
    });

  const courseIds = new Set(courses.map((c) => c["Course ID"]));
  const dupCourses = courses.length - courseIds.size;
  if (dupCourses > 0)
    warnings.push({
      level: "warning",
      title: `${dupCourses} duplicate Course IDs`,
      detail: "Duplicates are collapsed to the first occurrence when mapping teachers to courses.",
    });

  const courseSubjects = new Set(courses.map((c) => c.Subject.toLowerCase()));
  const unmatchedSubjects = [
    ...new Set(
      dms
        .map((t) => t.Subjects)
        .filter(
          (s) =>
            s &&
            !EXCLUDED_SUBJECTS.includes(s) &&
            !courseSubjects.has(s.toLowerCase()) &&
            !courseSubjects.has(`${s.toLowerCase()} jee`),
        ),
    ),
  ];
  if (unmatchedSubjects.length)
    warnings.push({
      level: "warning",
      title: `${unmatchedSubjects.length} teacher subjects have no matching course subject`,
      detail: "Teachers with only these subjects will show zero mapped courses.",
      samples: sample(unmatchedSubjects, 12),
    });

  const staffIds = new Set<number>();
  for (const t of dms) {
    staffIds.add(t["Staff ID"]);
    staffIds.add(t["Staff User ID"]);
  }
  const orphan = (label: string, ids: number[]) => {
    const bad = [...new Set(ids.filter((id) => !staffIds.has(id)))];
    if (bad.length)
      warnings.push({
        level: "warning",
        title: `${bad.length} ${label} staff IDs are not in the Teacher sheet`,
        detail: `Those ${label} records are ignored because they cannot be attributed to a DMS teacher.`,
        samples: sample(bad.map(String)),
      });
  };
  orphan("video consumption", video.map((v) => v.staff_id));
  orphan("assessment consumption", assessment.map((a) => a.staff_id));

  const unknownCourses = [
    ...new Set(
      [...video.map((v) => v.course_id), ...assessment.map((a) => a.course_id)].filter(
        (id) => !courseIds.has(id),
      ),
    ),
  ];
  if (unknownCourses.length)
    warnings.push({
      level: "warning",
      title: `${unknownCourses.length} consumption course IDs are not in the Course sheet`,
      detail: "Consumption on these courses cannot be credited to a mapped course.",
      samples: sample(unknownCourses.map(String)),
    });

  const noDates =
    video.filter((v) => !v.last_watched && !v.first_watched).length +
    assessment.filter((a) => !a.date).length;
  if (noDates)
    warnings.push({
      level: "warning",
      title: `${noDates} consumption rows have no usable date`,
      detail: "Rows without a date never fall inside a reporting period and are treated as no usage.",
    });

  const dates = [...video.map((v) => v.last_watched), ...assessment.map((a) => a.date)]
    .filter(Boolean)
    .map((d) => (d as string).slice(0, 10))
    .sort();
  if (dates.length)
    warnings.push({
      level: "info",
      title: "Consumption date range",
      detail: `${dates[0]} → ${dates[dates.length - 1]}. The period picker defaults to this range.`,
    });

  return {
    data,
    warnings,
    counts: {
      teachers: teachers.length,
      courses: courses.length,
      video: video.length,
      assessment: assessment.length,
    },
    sheetMap,
  };
}
