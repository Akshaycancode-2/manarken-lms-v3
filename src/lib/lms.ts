import fallbackRaw from "@/data/lms.json";

export type Teacher = {
  "UDISE Code": number;
  Region: string;
  "School Name": string;
  "Staff User ID": number;
  "Staff ID": number;
  "Staff Name": string;
  Class: number;
  Section: string;
  Subjects: string;
  "Class Handling Type": string;
  Designation: string;
  Qualification: string;
  "Mapping Status": string;
  "Staff Validation (HR)": string;
  Lead: string;
};

export type Course = {
  Class: string | number;
  Subject: string;
  "Course ID": number;
  "Course Name": string;
  "Course Owner": string;
  "Course Video Status (Yes/No)": string;
  "Course Assessment Status (Yes/No)": string;
};

export type VideoRow = {
  staff_id: number;
  udise_code: number;
  course_id: number;
  video_title: string | null;
  max_watched_minutes: number | null;
  completion_percentage: number | null;
  times_opened: number | null;
  first_watched: string | null;
  last_watched: string | null;
};

export type AssessmentRow = {
  staff_id: number;
  name: string;
  course_id: number;
  course_title: string;
  subject: string;
  total_questions: number;
  attended_questions: number;
  total_marks: number;
  date: string | null;
};

export type DataMeta = {
  teacherDate: string | null;
  consumptionDate: string | null;
};

export type RawData = {
  teachers: Teacher[];
  courses: Course[];
  /** Course IDs excluded from Overall / School / Region consumption counting. */
  ignoredCourses?: number[];
  video: VideoRow[];
  assessment: AssessmentRow[];
  meta?: DataMeta;
};


export type Period = { from: string; to: string };

export const EXCLUDED_SUBJECTS = ["Physical Education", "Library"];

export type TeacherCourse = {
  teacher: Teacher;
  course: Course;
  hasVideo: boolean;
  hasAssessment: boolean;
};

export type HeatRow = {
  key: string;
  total: number; // D
  assigned: number; // E
  videoEligible: number; // F
  videoConsumers: number; // G
  videoUsage: number; // H = G/F
  overallVideoUsage: number; // I = G/D
  assessmentEligible: number; // J
  assessmentConsumers: number; // K
  assessmentUsage: number; // L = K/J
  overallAssessmentUsage: number; // M = K/D
  remarks: string;
};

/** Heat row for pages that no longer use course mapping (all teachers count). */
export type HeatRowAll = {
  key: string;
  total: number;
  videoConsumers: number;
  overallVideoUsage: number;
  assessmentConsumers: number;
  overallAssessmentUsage: number;
  remarks: string;
};


/**
 * A course row can serve several standards ("11,12"). Some exports drop the
 * zero from "10", so a bare "1" in such a list means class 10.
 */
export const courseClasses = (c: Course) =>
  String(c.Class)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s === "1" ? "10" : s));

/**
 * Special rules: Class 11/12 Physics & Chemistry split into the JEE (Maths
 * group) and NEET (Biology group) tracks, decided by the teacher's section:
 *   Class 11 — A1, A2, B1 → JEE; B2 → NEET
 *   Class 12 — A* → JEE;        B* → NEET
 * Any other section maps to both tracks. All other subjects ignore section.
 */
function subjectMatches(
  teacherSubject: string,
  teacherClass: number,
  courseSubject: string,
  teacherSection: string,
) {
  const ts = teacherSubject.trim().toLowerCase();
  const cs = courseSubject.trim().toLowerCase();
  if (ts === cs) return true;
  if ((teacherClass === 11 || teacherClass === 12) && (ts === "physics" || ts === "chemistry")) {
    const sec = teacherSection.trim().toUpperCase();
    const jee = teacherClass === 11 ? ["A1", "A2", "B1"] : ["A1", "A2", "A3", "A4"];
    const neet = teacherClass === 11 ? ["B2"] : ["B1", "B2", "B3", "B4"];
    if (jee.includes(sec) || (teacherClass === 12 && sec.startsWith("A")))
      return cs === `${ts} jee`;
    if (neet.includes(sec) || (teacherClass === 12 && sec.startsWith("B")))
      return cs === `${ts} neet`;
    return cs === `${ts} jee` || cs === `${ts} neet`;
  }
  return false;
}

const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100);

export function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

export const fmtPct = (n: number) => `${n.toFixed(0)}%`;

export function createDataset(raw: RawData) {
  const teacherRows = (raw.teachers ?? []).filter((t) =>
    /DMS$/i.test(String(t["School Name"] ?? "").trim()),
  );
  const courses = raw.courses ?? [];
  const videoRows = raw.video ?? [];
  const assessmentRows = raw.assessment ?? [];
  const ignoredCourseIds = new Set<number>(raw.ignoredCourses ?? []);
  const meta: DataMeta = {
    teacherDate: raw.meta?.teacherDate ?? null,
    consumptionDate: raw.meta?.consumptionDate ?? null,
  };


  /** Region now comes from the source data (Teacher Data column B). */
  const regionOf = (t: Teacher) => (t.Region ?? "").trim() || "Unassigned";
  const regions = [...new Set(teacherRows.map(regionOf))].sort();

  const teacherCourses: TeacherCourse[] = teacherRows.flatMap((teacher) => {
    if (EXCLUDED_SUBJECTS.includes(teacher.Subjects)) return [];
    const seen = new Set<number>();
    return courses
      .filter(
        (course) =>
          courseClasses(course).includes(String(teacher.Class)) &&
          subjectMatches(teacher.Subjects, teacher.Class, course.Subject, teacher.Section),
      )
      .filter((course) => {
        if (seen.has(course["Course ID"])) return false;
        seen.add(course["Course ID"]);
        return true;
      })
      .map((course) => ({
        teacher,
        course,
        hasVideo: course["Course Video Status (Yes/No)"] === "Yes",
        hasAssessment: course["Course Assessment Status (Yes/No)"] === "Yes",
      }));
  });

  const byStaff = new Map<number, TeacherCourse[]>();
  for (const tc of teacherCourses) {
    const key = tc.teacher["Staff ID"];
    const seen = byStaff.get(key);
    if (!seen) byStaff.set(key, [tc]);
    else if (!seen.some((x) => x.course["Course ID"] === tc.course["Course ID"])) seen.push(tc);
  }
  const mappedCoursesFor = (staffId: number) => byStaff.get(staffId) ?? [];

  /**
   * The source sheet repeats a teacher for every class/section/subject row.
   * Counting those rows inflates every teacher metric, so all headcounts use
   * this unique-by-Staff-ID list while mapping still uses every raw row.
   */
  const teachers = [...new Map(teacherRows.map((t) => [t["Staff ID"], t])).values()];


  const isEligible = (t: Teacher) =>
    mappedCoursesFor(t["Staff ID"]).some((tc) => tc.hasVideo || tc.hasAssessment);

  const inPeriod = (iso: string | null, p: Period) => {
    if (!iso) return false;
    const d = iso.slice(0, 10);
    return d >= p.from && d <= p.to;
  };

  /** Assessment sheet keys teachers by the LMS user id, video sheet by staff id. */
  const idsOf = (t: Teacher) => [t["Staff ID"], t["Staff User ID"]];

  // Indexes: consumption sheets are large, so never scan them per teacher.
  const videoByStaff = new Map<number, VideoRow[]>();
  for (const v of videoRows) {
    const list = videoByStaff.get(v.staff_id);
    if (list) list.push(v);
    else videoByStaff.set(v.staff_id, [v]);
  }
  const assessmentByStaff = new Map<number, AssessmentRow[]>();
  for (const a of assessmentRows) {
    const list = assessmentByStaff.get(a.staff_id);
    if (list) list.push(a);
    else assessmentByStaff.set(a.staff_id, [a]);
  }
  const videoRowsFor = (t: Teacher) => idsOf(t).flatMap((id) => videoByStaff.get(id) ?? []);
  const assessmentRowsFor = (t: Teacher) =>
    idsOf(t).flatMap((id) => assessmentByStaff.get(id) ?? []);

  function watchedVideo(t: Teacher, p: Period) {
    const mapped = new Set(mappedCoursesFor(t["Staff ID"]).map((tc) => tc.course["Course ID"]));
    return videoRowsFor(t).some(
      (v) =>
        mapped.has(v.course_id) &&
        (inPeriod(v.last_watched, p) || inPeriod(v.first_watched, p)),
    );
  }

  function didAssessment(t: Teacher, p: Period) {
    // Only assessments on courses actually mapped to the teacher count —
    // the sheet can contain course ids that are absent from Course Data.
    const mapped = new Set(mappedCoursesFor(t["Staff ID"]).map((tc) => tc.course["Course ID"]));
    return assessmentRowsFor(t).some(
      (a) => mapped.has(a.course_id) && a.attended_questions > 0 && inPeriod(a.date, p),
    );
  }

  const consumed = (t: Teacher, p: Period) => watchedVideo(t, p) || didAssessment(t, p);

  // ---- Non-mapped (Overall / School / Region) consumption ---------------
  // These pages ignore course mapping entirely: every teacher counts, and any
  // consumption on a course that is NOT in the Ignored-Courses sheet counts.
  function watchedVideoAll(t: Teacher, p: Period) {
    return videoRowsFor(t).some(
      (v) =>
        !ignoredCourseIds.has(v.course_id) &&
        (inPeriod(v.last_watched, p) || inPeriod(v.first_watched, p)),
    );
  }

  function didAssessmentAll(t: Teacher, p: Period) {
    return assessmentRowsFor(t).some(
      (a) =>
        !ignoredCourseIds.has(a.course_id) &&
        a.attended_questions > 0 &&
        inPeriod(a.date, p),
    );
  }

  const consumedAll = (t: Teacher, p: Period) =>
    watchedVideoAll(t, p) || didAssessmentAll(t, p);

  function heatRowAll(key: string, group: Teacher[], p: Period): HeatRowAll {
    const g = group.filter((t) => watchedVideoAll(t, p)).length;
    const k = group.filter((t) => didAssessmentAll(t, p)).length;
    const remarks: string[] = [];
    if (g === 0) remarks.push("Zero video usage");
    if (k === 0) remarks.push("Zero assessment usage");
    return {
      key,
      total: group.length,
      videoConsumers: g,
      overallVideoUsage: pct(g, group.length),
      assessmentConsumers: k,
      overallAssessmentUsage: pct(k, group.length),
      remarks: remarks.join("; ") || "—",
    };
  }




  function heatRow(key: string, group: Teacher[], p: Period): HeatRow {
    const assigned = group.filter((t) => mappedCoursesFor(t["Staff ID"]).length > 0);
    const videoEligible = group.filter((t) =>
      mappedCoursesFor(t["Staff ID"]).some((tc) => tc.hasVideo),
    );
    const assessmentEligible = group.filter((t) =>
      mappedCoursesFor(t["Staff ID"]).some((tc) => tc.hasAssessment),
    );
    const g = videoEligible.filter((t) => watchedVideo(t, p)).length;
    const k = assessmentEligible.filter((t) => didAssessment(t, p)).length;
    const remarks: string[] = [];
    if (videoEligible.length === 0) remarks.push("No video-enabled mapping");
    if (assessmentEligible.length === 0) remarks.push("No assessment-enabled mapping");
    if (g === 0 && videoEligible.length > 0) remarks.push("Zero video usage");
    return {
      key,
      total: group.length,
      assigned: assigned.length,
      videoEligible: videoEligible.length,
      videoConsumers: g,
      videoUsage: pct(g, videoEligible.length),
      overallVideoUsage: pct(g, group.length),
      assessmentEligible: assessmentEligible.length,
      assessmentConsumers: k,
      assessmentUsage: pct(k, assessmentEligible.length),
      overallAssessmentUsage: pct(k, group.length),
      remarks: remarks.join("; ") || "—",
    };
  }

  function watchedCourseVideo(t: Teacher, courseId: number, p: Period) {
    return videoRowsFor(t).some(
      (v) =>
        v.course_id === courseId &&
        (inPeriod(v.last_watched, p) || inPeriod(v.first_watched, p)),
    );
  }

  function attemptedCourseAssessment(t: Teacher, courseId: number, p: Period) {
    return assessmentRowsFor(t).some(
      (a) => a.course_id === courseId && a.attended_questions > 0 && inPeriod(a.date, p),
    );
  }


  // A teacher can appear with several subjects/classes across rows — keep the
  // full set per staff id so filters never drop a teacher's secondary subject.
  const subjectsByStaff = new Map<number, Set<string>>();
  const classesByStaff = new Map<number, Set<string>>();
  for (const t of teacherRows) {
    const id = t["Staff ID"];
    (subjectsByStaff.get(id) ?? subjectsByStaff.set(id, new Set()).get(id)!).add(t.Subjects);
    (classesByStaff.get(id) ?? classesByStaff.set(id, new Set()).get(id)!).add(String(t.Class));
  }
  const teacherMatches = (t: Teacher, subject: string, klass: string) =>
    (!subject || (subjectsByStaff.get(t["Staff ID"])?.has(subject) ?? false)) &&
    (!klass || (classesByStaff.get(t["Staff ID"])?.has(klass) ?? false));

  const leads = [...new Set(teacherRows.map((t) => t.Lead))].filter(Boolean).sort();
  const schools = [...new Set(teacherRows.map((t) => t["School Name"]))].sort();
  const allSubjects = [...new Set(teacherRows.map((t) => t.Subjects))]
    .filter((s) => s && !EXCLUDED_SUBJECTS.includes(s))
    .sort();
  const allClasses = [...new Set(teacherRows.map((t) => t.Class))]
    .filter((c) => c > 0)
    .sort((a, b) => a - b);


  const dates = [...videoRows.map((v) => v.last_watched), ...assessmentRows.map((a) => a.date)]
    .filter(Boolean)
    .map((d) => (d as string).slice(0, 10))
    .sort();
  const defaultPeriod: Period = {
    from: dates[0] ?? "2026-01-01",
    to: dates[dates.length - 1] ?? "2026-12-31",
  };

  return {
    teachers,
    teacherRows,
    teacherMatches,

    courses,
    videoRows,
    assessmentRows,
    regionOf,
    regions,
    teacherCourses,
    mappedCoursesFor,
    isEligible,
    watchedVideo,
    didAssessment,
    consumed,
    loggedIn: consumed,
    heatRow,
    ignoredCourseIds,
    meta,
    watchedVideoAll,
    didAssessmentAll,
    consumedAll,
    heatRowAll,

    watchedCourseVideo,
    attemptedCourseAssessment,
    leads,
    schools,
    allSubjects,
    allClasses,
    defaultPeriod,
  };
}

export type Dataset = ReturnType<typeof createDataset>;

export const fallbackData = fallbackRaw as unknown as RawData;
