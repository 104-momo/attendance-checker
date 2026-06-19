"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Terminal, FileSpreadsheet, X, Loader2, AlertCircle, Users, UserX, TrendingDown, UserMinus } from "lucide-react";

interface AbsenceRecord {
  date: string;
  status: string;
}

interface AbsenceSummaryItem {
  name: string;
  totalAbsences: number;
  records: AbsenceRecord[];
}

interface LeaveDetail {
  status: string;
  count: number;
}

interface LowAttendanceItem {
  name: string;
  rate: number;
  rateStr: string;
  presentDays: number;
  totalDays: number;
  absentCount: number;
  leaveCount: number;
  leaveDetails: LeaveDetail[];
}

interface AbsentOnlyItem {
  name: string;
  absentCount: number;
  records: { date: string; status: string }[];
}

interface ParsedData {
  text: string;
  absenceText: string;
  absenceSummary: AbsenceSummaryItem[];
  lowAttendanceText: string;
  lowAttendanceList: LowAttendanceItem[];
  absentOnlyText: string;
  absentOnlyList: AbsentOnlyItem[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [activeTab, setActiveTab] = useState<"daily" | "absence" | "lowRate" | "absentOnly">("daily");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const validExts = [".xlsx", ".xls", ".csv"];
    const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();

    if (!validTypes.includes(f.type) && !validExts.includes(ext)) {
      setError("请上传 Excel 文件（.xlsx / .xls / .csv）");
      return;
    }

    setFile(f);
    setError("");
    setOutput("");
    setParsedData(null);
    setActiveTab("daily");
    uploadAndParse(f);
  }, []);

  const uploadAndParse = async (f: File) => {
    setLoading(true);
    setError("");

    setOutput("> 正在解析 " + f.name + " ...\n");

    try {
      const formData = new FormData();
      formData.append("file", f);

      const res = await fetch("/api/attendance", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "解析失败");
        setOutput("");
        setLoading(false);
        return;
      }

      setParsedData({
        text: data.text,
        absenceText: data.absenceText,
        absenceSummary: data.absenceSummary || [],
        lowAttendanceText: data.lowAttendanceText || "",
        lowAttendanceList: data.lowAttendanceList || [],
        absentOnlyText: data.absentOnlyText || "",
        absentOnlyList: data.absentOnlyList || [],
      });

      // Typing effect for daily output
      const fullText = data.text;
      let displayed = "> " + f.name + " 解析完成\n\n";
      setOutput(displayed);

      const lines = fullText.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await new Promise((r) => setTimeout(r, 80));

        const coloredLine = line
          .replace(/^(\d{1,2}月\d{1,2}日)，/, "〖DATE〗$1〖/DATE〗，")
          .replace(/签到(\d+人)/g, "【签到 $1】")
          .replace(/病假(\d+人)/g, "【病假 $1】")
          .replace(/事假(\d+人)/g, "【事假 $1】")
          .replace(/年假(\d+人)/g, "【年假 $1】")
          .replace(/调休(\d+人)/g, "【调休 $1】")
          .replace(/缺勤(\d+人)/g, "【缺勤 $1】")
          .replace(/迟到(\d+人)/g, "【迟到 $1】")
          .replace(/早退(\d+人)/g, "【早退 $1】")
          .replace(/出差(\d+人)/g, "【出差 $1】")
          .replace(/婚假(\d+人)/g, "【婚假 $1】")
          .replace(/丧假(\d+人)/g, "【丧假 $1】")
          .replace(/产假(\d+人)/g, "【产假 $1】");

        displayed += coloredLine + "\n";
        setOutput(displayed);
      }

      displayed += "\n> 完成。共解析 " + lines.length + " 天数据。";
      setOutput(displayed);
    } catch {
      setError("网络错误，请重试");
      setOutput("");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const clearFile = () => {
    setFile(null);
    setOutput("");
    setError("");
    setParsedData(null);
    setActiveTab("daily");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "缺勤":
      case "旷工":
        return "text-terminal-red font-bold";
      case "病假":
        return "text-yellow-400";
      case "事假":
        return "text-orange-400";
      case "签到":
      case "出勤":
        return "text-terminal-green font-bold";
      case "迟到":
      case "早退":
        return "text-terminal-red/80";
      default:
        return "text-cyan-400";
    }
  };

  const renderDailyLine = (line: string, idx: number) => {
    if (!line.trim()) return <div key={idx} className="h-4" />;

    if (line.startsWith(">")) {
      return (
        <div key={idx} className="text-terminal-green/60 font-mono text-sm">
          {line}
        </div>
      );
    }

    const parts: React.ReactNode[] = [];
    let partKey = 0;

    const tokenRegex = /〖DATE〗(.*?)〖\/DATE〗|【(签到|病假|事假|年假|调休|缺勤|迟到|早退|出差|婚假|丧假|产假)\s(\d+人)】/g;
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={partKey++} className="text-terminal-green">
            {line.slice(lastIndex, match.index)}
          </span>
        );
      }

      if (match[1] !== undefined) {
        parts.push(
          <span key={partKey++} className="text-sky-400 font-bold">
            {match[1]}
          </span>
        );
      } else {
        const status = match[2];
        const count = match[3];
        const colorClass = getStatusColor(status);

        parts.push(
          <span key={partKey++} className={colorClass}>
            {status}
            <span className="text-white/70">{count}</span>
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(
        <span key={partKey++} className="text-terminal-green">
          {line.slice(lastIndex)}
        </span>
      );
    }

    if (parts.length === 0) {
      parts.push(
        <span key={partKey} className="text-terminal-green">
          {line}
        </span>
      );
    }

    return (
      <div key={idx} className="font-mono text-sm leading-relaxed">
        {parts}
      </div>
    );
  };

  const renderAbsenceLine = (line: string, idx: number) => {
    if (!line.trim()) return <div key={idx} className="h-4" />;

    if (line.startsWith(">")) {
      return (
        <div key={idx} className="text-terminal-green/60 font-mono text-sm">
          {line}
        </div>
      );
    }

    const parts: React.ReactNode[] = [];
    let partKey = 0;

    const nameMatch = line.match(/^([^：]+)：/);
    if (nameMatch) {
      parts.push(
        <span key={partKey++} className="text-white font-bold">
          {nameMatch[1]}
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-green">
          ：
        </span>
      );
    }

    const countMatch = line.match(/：(\d+次)/);
    if (countMatch) {
      parts.push(
        <span key={partKey++} className="text-terminal-red font-bold">
          {countMatch[1]}
        </span>
      );
    }

    const sepMatch = line.match(/次\s*—\s*/);
    if (sepMatch) {
      parts.push(
        <span key={partKey++} className="text-terminal-green/50">
          {" — "}
        </span>
      );
    }

    let pos = line.indexOf("—");
    if (pos >= 0) {
      const remainder = line.substring(pos + 1);
      const subParts: React.ReactNode[] = [];
      let subKey = 0;
      let subLast = 0;

      const dsRegex = /(\d{1,2}月\d{1,2}日)\(([^)]+)\)/g;
      let dsM;

      while ((dsM = dsRegex.exec(remainder)) !== null) {
        if (dsM.index > subLast) {
          subParts.push(
            <span key={subKey++} className="text-terminal-green/40">
              {remainder.slice(subLast, dsM.index)}
            </span>
          );
        }

        subParts.push(
          <span key={subKey++} className="text-sky-400">
            {dsM[1]}
          </span>
        );

        const status = dsM[2];
        const colorClass = getStatusColor(status);
        subParts.push(
          <span key={subKey++}>
            <span className="text-terminal-green/40">（</span>
            <span className={colorClass}>{status}</span>
            <span className="text-terminal-green/40">）</span>
          </span>
        );

        subLast = dsM.index + dsM[0].length;
      }

      if (subLast < remainder.length) {
        subParts.push(
          <span key={subKey++} className="text-terminal-green">
            {remainder.slice(subLast)}
          </span>
        );
      }

      parts.push(<span key={partKey++}>{subParts}</span>);
    }

    if (parts.length === 0) {
      parts.push(
        <span key={partKey} className="text-terminal-green">
          {line}
        </span>
      );
    }

    return (
      <div key={idx} className="font-mono text-sm leading-relaxed">
        {parts}
      </div>
    );
  };

  // Render low attendance line: "胡家赫，到课率0.0%，旷课12次，请假2次"
  const renderLowRateLine = (line: string, idx: number) => {
    if (!line.trim()) return <div key={idx} className="h-4" />;

    if (line.startsWith(">")) {
      return (
        <div key={idx} className="text-terminal-green/60 font-mono text-sm">
          {line}
        </div>
      );
    }

    const parts: React.ReactNode[] = [];
    let partKey = 0;

    // Parse: name，到课率XX.X%，旷课N次，请假N次
    // Name (before first ，)
    const nameMatch = line.match(/^([^，]+)，/);
    if (nameMatch) {
      parts.push(
        <span key={partKey++} className="text-white font-bold">
          {nameMatch[1]}
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-green/50">
          ，
        </span>
      );
    }

    // 到课率XX.X%
    const rateMatch = line.match(/到课率([\d.]+%)/);
    if (rateMatch) {
      parts.push(
        <span key={partKey++} className="text-terminal-green/70">
          到课率
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-red font-bold">
          {rateMatch[1]}
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-green/50">
          ，
        </span>
      );
    }

    // 旷课N次
    const absentMatch = line.match(/旷课(\d+)次/);
    if (absentMatch) {
      parts.push(
        <span key={partKey++} className="text-terminal-green/70">
          旷课
        </span>
      );
      const absentCount = parseInt(absentMatch[1]);
      const absentClass = absentCount > 0 ? "text-terminal-red font-bold" : "text-terminal-green/60";
      parts.push(
        <span key={partKey++} className={absentClass}>
          {absentMatch[1]}
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-green/70">
          次
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-green/50">
          ，
        </span>
      );
    }

    // 请假N次
    const leaveMatch = line.match(/请假(\d+)次/);
    if (leaveMatch) {
      parts.push(
        <span key={partKey++} className="text-terminal-green/70">
          请假
        </span>
      );
      const leaveCount = parseInt(leaveMatch[1]);
      const leaveClass = leaveCount > 0 ? "text-yellow-400 font-bold" : "text-terminal-green/60";
      parts.push(
        <span key={partKey++} className={leaveClass}>
          {leaveMatch[1]}
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-green/70">
          次
        </span>
      );
    }

    if (parts.length === 0) {
      parts.push(
        <span key={partKey} className="text-terminal-green">
          {line}
        </span>
      );
    }

    return (
      <div key={idx} className="font-mono text-sm leading-relaxed">
        {parts}
      </div>
    );
  };

  const getAbsenceOutputText = (): string => {
    if (!parsedData) return "";
    return "> 缺勤人员汇总\n\n" + parsedData.absenceText;
  };

  const getLowRateOutputText = (): string => {
    if (!parsedData) return "";
    return "> 到课率 < 60% 人员名单（含旷课/请假次数，按到课率升序）\n\n" + parsedData.lowAttendanceText;
  };

  const getAbsentOnlyOutputText = (): string => {
    if (!parsedData) return "";
    return "> 仅缺勤人员名单（不含请假，按缺勤次数降序）\n\n" + parsedData.absentOnlyText;
  };

  // Render absent-only line: "胡家赫，缺勤8次（6月1日、6月2日、...）"
  const renderAbsentOnlyLine = (line: string, idx: number) => {
    if (!line.trim()) return <div key={idx} className="h-4" />;

    if (line.startsWith(">")) {
      return (
        <div key={idx} className="text-terminal-green/60 font-mono text-sm">
          {line}
        </div>
      );
    }

    const parts: React.ReactNode[] = [];
    let partKey = 0;

    // Parse: name，缺勤N次（date1、date2、...）
    // Name (before first ，)
    const nameMatch = line.match(/^([^，]+)，/);
    if (nameMatch) {
      parts.push(
        <span key={partKey++} className="text-white font-bold">
          {nameMatch[1]}
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-green/50">
          ，
        </span>
      );
    }

    // 缺勤N次
    const countMatch = line.match(/缺勤(\d+)次/);
    if (countMatch) {
      parts.push(
        <span key={partKey++} className="text-terminal-green/70">
          缺勤
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-red font-bold">
          {countMatch[1]}
        </span>
      );
      parts.push(
        <span key={partKey++} className="text-terminal-green/70">
          次
        </span>
      );
    }

    // （dates）
    const datesMatch = line.match(/（([^)]+)）$/);
    if (datesMatch) {
      parts.push(
        <span key={partKey++} className="text-terminal-green/50">
          （
        </span>
      );
      const datesStr = datesMatch[1];
      const dates = datesStr.split("、");
      dates.forEach((d, i) => {
        parts.push(
          <span key={partKey++} className="text-sky-400">
            {d}
          </span>
        );
        if (i < dates.length - 1) {
          parts.push(
            <span key={partKey++} className="text-terminal-green/40">
              、
            </span>
          );
        }
      });
      parts.push(
        <span key={partKey++} className="text-terminal-green/50">
          ）
        </span>
      );
    }

    if (parts.length === 0) {
      parts.push(
        <span key={partKey} className="text-terminal-green">
          {line}
        </span>
      );
    }

    return (
      <div key={idx} className="font-mono text-sm leading-relaxed">
        {parts}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0a0a0a] via-[#111111] to-[#0d0d0d]">
      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,197,94,0.03) 2px, rgba(34,197,94,0.03) 4px)",
          }}
        />
      </div>

      {/* Header */}
      <header className="border-b border-terminal-green/20 px-6 py-3 flex items-center gap-3 bg-black/40">
        <Terminal className="w-5 h-5 text-terminal-green" />
        <span className="font-mono text-terminal-green text-sm tracking-wider">
          ATTENDANCE_CHECKER v4.0
        </span>
        <span className="font-mono text-terminal-green/40 text-xs ml-auto">
          system: online
        </span>
        <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* Title */}
          <div className="text-center space-y-3">
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight"
              style={{
                fontFamily: "'SimHei', 'Heiti SC', 'Microsoft YaHei', sans-serif",
                color: "#22C55E",
                textShadow: "0 0 20px rgba(34,197,94,0.3), 0 0 40px rgba(34,197,94,0.1)",
              }}
            >
              考勤，一步到位
            </h1>
            <p className="font-mono text-terminal-green/50 text-sm">
              {"// 上传考勤表，即刻获取缺勤报告"}
            </p>
          </div>

          {/* Upload Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative cursor-pointer border-2 border-dashed rounded-lg p-8
              transition-all duration-300 group
              ${
                isDragOver
                  ? "border-terminal-green bg-terminal-green/10 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                  : "border-terminal-green/30 hover:border-terminal-green/60 hover:bg-terminal-green/5"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleInputChange}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-4">
              {file ? (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-terminal-green" />
                  <div className="text-center">
                    <p className="text-terminal-green font-mono text-sm">{file.name}</p>
                    <p className="text-terminal-green/40 font-mono text-xs mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    className="text-terminal-red/70 hover:text-terminal-red transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-terminal-green/50 group-hover:text-terminal-green transition-colors" />
                  <div className="text-center">
                    <p
                      className="text-lg"
                      style={{
                        fontFamily: "'SimHei', 'Heiti SC', 'Microsoft YaHei', sans-serif",
                        color: "#22C55E",
                      }}
                    >
                      拖拽或点击上传考勤表
                    </p>
                    <p className="font-mono text-terminal-green/40 text-xs mt-2">
                      支持 .xlsx / .xls / .csv
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-terminal-green/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-terminal-green/50" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-terminal-green/50" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-terminal-green/50" />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-terminal-red/10 border border-terminal-red/30 rounded-lg px-4 py-3">
              <AlertCircle className="w-5 h-5 text-terminal-red flex-shrink-0" />
              <p
                className="text-terminal-red text-sm"
                style={{ fontFamily: "'SimHei', 'Heiti SC', 'Microsoft YaHei', sans-serif" }}
              >
                {error}
              </p>
            </div>
          )}

          {/* Output Terminal */}
          {(output || loading) && (
            <div className="rounded-lg border border-terminal-green/20 bg-black/60 overflow-hidden">
              {/* Terminal title bar with tabs */}
              <div className="flex items-center bg-terminal-green/5 border-b border-terminal-green/10">
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="w-3 h-3 rounded-full bg-terminal-red/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-terminal-green/60" />
                </div>

                {parsedData && !loading && (
                  <div className="flex ml-4">
                    <button
                      onClick={() => setActiveTab("daily")}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono transition-all border-b-2 ${
                        activeTab === "daily"
                          ? "text-terminal-green border-terminal-green bg-terminal-green/10"
                          : "text-terminal-green/40 border-transparent hover:text-terminal-green/60"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      每日汇总
                    </button>
                    <button
                      onClick={() => setActiveTab("absence")}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono transition-all border-b-2 ${
                        activeTab === "absence"
                          ? "text-terminal-red border-terminal-red bg-terminal-red/10"
                          : "text-terminal-green/40 border-transparent hover:text-terminal-red/60"
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      缺勤人员
                    </button>
                    <button
                      onClick={() => setActiveTab("lowRate")}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono transition-all border-b-2 ${
                        activeTab === "lowRate"
                          ? "text-orange-400 border-orange-400 bg-orange-400/10"
                          : "text-terminal-green/40 border-transparent hover:text-orange-400/60"
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      低到课率
                    </button>
                    <button
                      onClick={() => setActiveTab("absentOnly")}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono transition-all border-b-2 ${
                        activeTab === "absentOnly"
                          ? "text-terminal-red border-terminal-red bg-terminal-red/10"
                          : "text-terminal-green/40 border-transparent hover:text-terminal-red/60"
                      }`}
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      仅缺勤
                    </button>
                  </div>
                )}

                <span className="ml-auto mr-4 font-mono text-terminal-green/40 text-xs">
                  {activeTab === "daily" ? "daily.log" : activeTab === "absence" ? "absence.log" : activeTab === "lowRate" ? "lowrate.log" : "absentonly.log"}
                </span>
              </div>

              {/* Terminal content */}
              <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar">
                {activeTab === "daily" ? (
                  <>
                    {output.split("\n").map((line, idx) => renderDailyLine(line, idx))}
                  </>
                ) : activeTab === "absence" ? (
                  <>
                    {getAbsenceOutputText().split("\n").map((line, idx) => renderAbsenceLine(line, idx))}
                    {parsedData && parsedData.absenceSummary.length === 0 && (
                      <div className="text-terminal-green text-sm font-mono">
                        全勤！无缺勤人员。
                      </div>
                    )}
                  </>
                ) : activeTab === "lowRate" ? (
                  <>
                    {getLowRateOutputText().split("\n").map((line, idx) => renderLowRateLine(line, idx))}
                    {parsedData && parsedData.lowAttendanceList.length === 0 && (
                      <div className="text-terminal-green text-sm font-mono">
                        所有人到课率均 ≥ 60%，无需关注。
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {getAbsentOnlyOutputText().split("\n").map((line, idx) => renderAbsentOnlyLine(line, idx))}
                    {parsedData && parsedData.absentOnlyList.length === 0 && (
                      <div className="text-terminal-green text-sm font-mono">
                        无人缺勤。
                      </div>
                    )}
                  </>
                )}
                {loading && (
                  <span className="inline-flex items-center gap-2 text-terminal-green/60 font-mono text-sm">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    解析中...
                  </span>
                )}
                {!loading && output && (
                  <span className="inline-block w-2 h-4 bg-terminal-green animate-pulse ml-1" />
                )}
              </div>
            </div>
          )}

          {/* Quick Guide */}
          {!output && !loading && (
            <div className="space-y-3">
              <p
                className="text-terminal-green/60 text-sm text-center"
                style={{ fontFamily: "'SimHei', 'Heiti SC', 'Microsoft YaHei', sans-serif" }}
              >
                Excel 格式要求
              </p>
              <div className="rounded-lg border border-terminal-green/10 bg-black/30 p-4 overflow-x-auto">
                <pre className="font-mono text-xs text-terminal-green/50 leading-relaxed whitespace-pre">
{`┌──────────┬──────────┬──────────┬──────────┐
│ 姓名     │ 5月23日  │ 5月24日  │ 5月25日  │
├──────────┼──────────┼──────────┼──────────┤
│ 张三     │ 签到     │ 病假     │ 签到     │
│ 李四     │ 事假     │ 签到     │ 缺勤     │
│ 王五     │ 签到     │ 签到     │ 签到     │
└──────────┴──────────┴──────────┴──────────┘`}
                </pre>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs font-mono">
                <span className="px-2 py-1 rounded bg-terminal-green/10 text-terminal-green/60 border border-terminal-green/20">
                  签到
                </span>
                <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400/60 border border-yellow-500/20">
                  病假
                </span>
                <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400/60 border border-orange-500/20">
                  事假
                </span>
                <span className="px-2 py-1 rounded bg-terminal-red/10 text-terminal-red/60 border border-terminal-red/20">
                  缺勤
                </span>
                <span className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400/60 border border-cyan-500/20">
                  调休/年假/出差
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-terminal-green/10 px-6 py-3 bg-black/40">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <span className="font-mono text-terminal-green/30 text-xs">
            ATTENDANCE_CHECKER &copy; 2025
          </span>
          <span className="font-mono text-terminal-green/30 text-xs">
            powered by Z.ai
          </span>
        </div>
      </footer>
    </div>
  );
}
