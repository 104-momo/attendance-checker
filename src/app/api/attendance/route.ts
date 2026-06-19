import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// Attendance status keywords mapping
const STATUS_KEYWORDS: Record<string, string[]> = {
  签到: ["签到", "出勤", "正常", "已签到", "已出勤", "√", "✓", "✅", "到", "实到"],
  病假: ["病假", "病", "生病"],
  事假: ["事假", "事", "个人事"],
  年假: ["年假", "年休", "休假"],
  调休: ["调休", "调"],
  婚假: ["婚假", "婚"],
  丧假: ["丧假", "丧"],
  产假: ["产假", "产"],
  出差: ["出差", "外勤"],
  迟到: ["迟到", "晚到"],
  早退: ["早退"],
  缺勤: ["缺勤", "旷工", "旷课", "未到", "缺卡", "未签到", "未打卡", "漏签", "未参与", "未出勤", "无故", "离岗"],
};

function classifyStatus(value: string): string {
  if (!value) return "缺勤";
  const v = String(value).trim();
  if (!v || v === "" || v === "-") return "缺勤";

  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (v.includes(keyword)) return status;
    }
  }

  // If value is a number (like hours worked), treat as present
  if (!isNaN(Number(v)) && Number(v) > 0) return "签到";

  // Negative indicators: anything with 未/无/休 likely means absent
  if (/未|无|休/.test(v)) return "缺勤";

  return "签到"; // Default: if there's content, assume checked in
}

function formatDate(dateValue: unknown): string {
  if (!dateValue) return "";

  if (typeof dateValue === "number") {
    const date = XLSX.SSF.parse_date_code(dateValue);
    if (date) {
      return `${date.m}月${date.d}日`;
    }
  }

  const str = String(dateValue).trim();

  const dateMatch = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (dateMatch) {
    return `${parseInt(dateMatch[2])}月${parseInt(dateMatch[3])}日`;
  }

  const cnMatch = str.match(/(\d{1,2})月(\d{1,2})/);
  if (cnMatch) {
    return `${parseInt(cnMatch[1])}月${parseInt(cnMatch[2])}日`;
  }

  return str;
}

function isDateColumn(header: string): boolean {
  const h = String(header).trim();
  return /(\d{1,2}[\/\-\.]\d{1,2})|(\d{1,2}月)|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/.test(h);
}

function isNameColumn(header: string): boolean {
  const h = String(header).trim();
  return /姓名|名字|员工|人员|人员姓名|名称|name/i.test(h);
}

interface AttendanceResult {
  date: string;
  summary: string;
  details: {
    status: string;
    count: number;
    names: string[];
  }[];
}

interface AbsenceRecord {
  date: string;
  status: string;
}

interface AbsenceSummaryItem {
  name: string;
  totalAbsences: number;
  records: AbsenceRecord[];
}

interface AttendanceRateItem {
  name: string;
  rate: number; // 0-1
  rateStr: string; // e.g. "33.7%"
  presentDays: number;
  totalDays: number;
  absentCount: number; // 旷课次数 (缺勤)
  leaveCount: number; // 请假次数 (病假+事假+年假+调休+婚假+丧假+产假)
  leaveDetails: { status: string; count: number }[];
}

// 仅缺勤人员（不含请假）
interface AbsentOnlyItem {
  name: string;
  absentCount: number; // 缺勤次数
  records: { date: string; status: string }[]; // 缺勤日期明细
}

// 请假类状态（用于统计请假次数）
const LEAVE_STATUSES = ["病假", "事假", "年假", "调休", "婚假", "丧假", "产假"];

function parseAttendanceSheet(sheet: XLSX.WorkSheet): {
  results: AttendanceResult[];
  absenceSummary: AbsenceSummaryItem[];
  lowAttendanceList: AttendanceRateItem[];
  absentOnlyList: AbsentOnlyItem[];
} {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 2) return { results: [], absenceSummary: [], lowAttendanceList: [], absentOnlyList: [] };

  const headers = rows[0].map((h) => String(h || "").trim());
  const nameColIdx = headers.findIndex(isNameColumn);
  const nameCol = nameColIdx >= 0 ? nameColIdx : 0;

  // Find date columns
  const dateColumns: { idx: number; header: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (isDateColumn(headers[i])) {
      dateColumns.push({ idx: i, header: headers[i] });
    }
  }

  if (dateColumns.length === 0) {
    for (let i = 0; i < headers.length; i++) {
      if (i !== nameCol) {
        dateColumns.push({ idx: i, header: headers[i] });
      }
    }
  }

  const totalDays = dateColumns.length;
  const results: AttendanceResult[] = [];
  const absenceMap: Record<string, AbsenceRecord[]> = {};
  // Track per-person status counts for attendance rate calculation
  const personStats: Record<string, { statusCounts: Record<string, number> }> = {};
  // Track per-person absent-only (缺勤) records with dates
  const absentOnlyMap: Record<string, { date: string; status: string }[]> = {};

  for (const dateCol of dateColumns) {
    const dateStr = formatDate(dateCol.header);
    const statusMap: Record<string, string[]> = {};

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      const name = String(row[nameCol] || "").trim();
      if (!name) continue;

      const statusValue = String(row[dateCol.idx] ?? "").trim();
      const status = classifyStatus(statusValue);

      if (!statusMap[status]) statusMap[status] = [];
      statusMap[status].push(name);

      // Track non-签到 records for absence summary
      if (status !== "签到") {
        if (!absenceMap[name]) absenceMap[name] = [];
        absenceMap[name].push({ date: dateStr, status });
      }

      // Track absent-only (缺勤) records for the 4th panel (exclude 请假)
      if (status === "缺勤") {
        if (!absentOnlyMap[name]) absentOnlyMap[name] = [];
        absentOnlyMap[name].push({ date: dateStr, status });
      }

      // Track status counts per person for rate calculation
      if (!personStats[name]) personStats[name] = { statusCounts: {} };
      personStats[name].statusCounts[status] = (personStats[name].statusCounts[status] || 0) + 1;
    }

    // Build summary parts in specific order
    const orderedStatuses = ["签到", "病假", "事假", "年假", "调休", "婚假", "丧假", "产假", "出差", "迟到", "早退", "缺勤"];
    const details: { status: string; count: number; names: string[] }[] = [];

    for (const status of orderedStatuses) {
      if (statusMap[status] && statusMap[status].length > 0) {
        details.push({
          status,
          count: statusMap[status].length,
          names: statusMap[status],
        });
      }
    }

    for (const [status, names] of Object.entries(statusMap)) {
      if (!orderedStatuses.includes(status)) {
        details.push({ status, count: names.length, names });
      }
    }

    const summaryParts = details.map((d) => {
      if (d.status === "签到") {
        return `签到${d.count}人`;
      }
      return `${d.status}${d.count}人，${d.names.join("、")}`;
    });
    const summary = `${dateStr}，${summaryParts.join("；")}`;

    results.push({ date: dateStr, summary, details });
  }

  // Build absence summary sorted by totalAbsences descending
  const absenceSummary: AbsenceSummaryItem[] = Object.entries(absenceMap)
    .map(([name, records]) => ({
      name,
      totalAbsences: records.length,
      records,
    }))
    .sort((a, b) => b.totalAbsences - a.totalAbsences);

  // Calculate attendance rate per person, filter < 60%
  const lowAttendanceList: AttendanceRateItem[] = Object.entries(personStats)
    .map(([name, stats]) => {
      const presentDays = stats.statusCounts["签到"] || 0;
      const rate = totalDays > 0 ? presentDays / totalDays : 0;

      // Count leave occurrences
      let leaveCount = 0;
      const leaveDetails: { status: string; count: number }[] = [];
      for (const leaveStatus of LEAVE_STATUSES) {
        const cnt = stats.statusCounts[leaveStatus] || 0;
        if (cnt > 0) {
          leaveCount += cnt;
          leaveDetails.push({ status: leaveStatus, count: cnt });
        }
      }

      // Count absent (旷课 = 缺勤) occurrences
      const absentCount = stats.statusCounts["缺勤"] || 0;

      return {
        name,
        rate,
        rateStr: (rate * 100).toFixed(1) + "%",
        presentDays,
        totalDays,
        absentCount,
        leaveCount,
        leaveDetails,
      };
    })
    .filter((item) => item.rate < 0.6)
    .sort((a, b) => a.rate - b.rate); // Lowest rate first

  // Build absent-only list (people with 缺勤 count > 0), sorted by count descending
  const absentOnlyList: AbsentOnlyItem[] = Object.entries(absentOnlyMap)
    .map(([name, records]) => ({
      name,
      absentCount: records.length,
      records,
    }))
    .sort((a, b) => b.absentCount - a.absentCount);

  return { results, absenceSummary, lowAttendanceList, absentOnlyList };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const allResults: AttendanceResult[] = [];
    const allAbsenceSummary: AbsenceSummaryItem[] = [];
    const allLowAttendance: AttendanceRateItem[] = [];
    const allAbsentOnly: AbsentOnlyItem[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const { results, absenceSummary, lowAttendanceList, absentOnlyList } = parseAttendanceSheet(sheet);
      allResults.push(...results);
      allAbsenceSummary.push(...absenceSummary);
      allLowAttendance.push(...lowAttendanceList);
      allAbsentOnly.push(...absentOnlyList);
    }

    if (allResults.length === 0) {
      return NextResponse.json({
        error: "未能解析出考勤数据，请确保Excel包含姓名列和日期列",
      }, { status: 400 });
    }

    // Format daily output text
    const outputText = allResults.map((r) => r.summary).join("\n");

    // Format absence summary text
    const absenceText = allAbsenceSummary
      .map((item) => {
        const reasons = item.records.map((r) => `${r.date}(${r.status})`).join("、");
        return `${item.name}：${item.totalAbsences}次 — ${reasons}`;
      })
      .join("\n");

    // Format low attendance text: "胡家赫，到课率0.0%，旷课12次，请假2次"
    const lowAttendanceText = allLowAttendance
      .map(
        (item) =>
          `${item.name}，到课率${item.rateStr}，旷课${item.absentCount}次，请假${item.leaveCount}次`
      )
      .join("\n");

    // Format absent-only text: "胡家赫，缺勤8次（6月1日、6月2日、...）"
    const absentOnlyText = allAbsentOnly
      .map((item) => {
        const dates = item.records.map((r) => r.date).join("、");
        return `${item.name}，缺勤${item.absentCount}次（${dates}）`;
      })
      .join("\n");

    return NextResponse.json({
      success: true,
      text: outputText,
      results: allResults,
      absenceSummary: allAbsenceSummary,
      absenceText,
      lowAttendanceList: allLowAttendance,
      lowAttendanceText,
      absentOnlyList: allAbsentOnly,
      absentOnlyText,
    });
  } catch (error) {
    console.error("Attendance parse error:", error);
    return NextResponse.json(
      { error: "文件解析失败，请确保上传的是有效的Excel文件" },
      { status: 500 }
    );
  }
}
