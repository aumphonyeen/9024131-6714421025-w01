const DATA_URL = "./data/student-record.json";
const statusLabels = {
  passed: "ผ่าน",
  pending: "รอตรวจสอบ",
  incomplete: "ยังไม่ผ่าน"
};

let studentRecord;
let activeCategory = "ทั้งหมด";

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

function showToast(message, isError = false) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setText(id, value) {
  byId(id).textContent = value;
}

function renderStudent(record) {
  const { student, program, summary } = record;
  setText("top-term", program.academicYear);
  setText("student-name", student.name);
  setText("student-id", student.studentId);
  setText("program-name", program.name);
  setText("faculty-name", program.faculty);
  setText("advisor-name", student.advisor);
  setText("student-term", `${program.term} / ${program.academicYear}`);
  setText("student-status", `ชั้นปีที่ ${student.year} · ${student.enrollmentStatus}`);

  setText("credits-earned", summary.creditsEarned);
  setText("credits-required", summary.creditsRequired);
  setText("credits-remaining", Math.max(0, summary.creditsRequired - summary.creditsEarned));
  const creditPercent = summary.creditsRequired > 0
    ? Math.max(0, Math.min(100, Math.round((summary.creditsEarned / summary.creditsRequired) * 100)))
    : 0;
  byId("credits-progress").style.width = `${creditPercent}%`;
  byId("credits-progress").setAttribute("aria-valuenow", creditPercent);
  setText("credits-percent", `${creditPercent}%`);

  setText("gpax", Number(summary.gpax).toFixed(2));
  setText("gpa-message", `เกณฑ์ขั้นต่ำ ${Number(summary.minimumGpax).toFixed(2)}`);
  const gpaxPosition = Math.max(0, Math.min(100, summary.gpax / 4 * 100));
  byId("gpa-indicator").style.setProperty("--gpa-position", `${gpaxPosition}%`);

  const passedRequirements = record.requirements.filter((item) => item.status === "passed").length;
  setText("requirements-passed", passedRequirements);
  setText("requirements-total", record.requirements.length);
  const passedAll = passedRequirements === record.requirements.length;
  setText("requirements-message", passedAll ? "ผ่านทุกเงื่อนไข" : "ยังมีเงื่อนไขที่ต้องดำเนินการ");
  byId("requirements-icon").textContent = passedAll ? "✓" : "!";
  byId("requirements-icon").classList.toggle("fail", !passedAll);
  const requirementFoot = document.querySelector(".requirements-card .summary-foot");
  requirementFoot.classList.toggle("is-fail", !passedAll);
  const meetsGpaxRequirement = summary.gpax >= summary.minimumGpax;
  byId("gpa-check").textContent = meetsGpaxRequirement ? "✓" : "!";
  byId("gpa-check").classList.toggle("fail", !meetsGpaxRequirement);

  byId("requirement-dots").innerHTML = record.requirements.map((item) =>
    `<i class="${item.status === "passed" ? "passed" : ""}"></i>`
  ).join("");
  setText("requirements-caption", `ตรวจสอบเมื่อ ${record.lastChecked}`);
  byId("requirement-list").innerHTML = record.requirements.map((item) => {
    const passed = item.status === "passed";
    const statusClass = passed ? "passed" : item.status === "pending" ? "pending" : "incomplete";
    return `<article class="requirement-item ${statusClass}">
      <span class="requirement-status" aria-label="${statusLabels[item.status] || "ไม่ระบุ"}">${passed ? "✓" : "!"}</span>
      <span class="requirement-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)}</small></span>
    </article>`;
  }).join("");

  renderFilters(record.courses);
  renderCourses();
}

function renderFilters(courses) {
  const categories = ["ทั้งหมด", ...new Set(courses.map((course) => course.category))];
  byId("category-filters").innerHTML = categories.map((category) => {
    const count = category === "ทั้งหมด"
      ? courses.length
      : courses.filter((course) => course.category === category).length;
    const active = category === activeCategory;
    return `<button class="filter-chip ${active ? "active" : ""}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${active}">${escapeHtml(category)}<span>${count}</span></button>`;
  }).join("");
}

function renderCourses() {
  const query = byId("course-search").value.trim().toLocaleLowerCase("th");
  const filtered = studentRecord.courses.filter((course) => {
    const matchesCategory = activeCategory === "ทั้งหมด" || course.category === activeCategory;
    const searchable = `${course.code} ${course.name} ${course.category}`.toLocaleLowerCase("th");
    return matchesCategory && searchable.includes(query);
  });

  byId("course-rows").innerHTML = filtered.map((course) => {
    const isPending = course.status !== "passed";
    return `<tr class="${isPending ? "course-pending" : ""}">
      <td>${escapeHtml(course.code)}</td>
      <td>${escapeHtml(course.name)}</td>
      <td>${escapeHtml(course.category)}</td>
      <td>${escapeHtml(course.credits)}</td>
      <td><span class="grade ${isPending ? "pending" : ""}">${escapeHtml(course.grade || "—")}</span></td>
      <td><span class="course-state ${course.status}">${statusLabels[course.status] || "ไม่ระบุ"}</span></td>
    </tr>`;
  }).join("");
  byId("empty-state").hidden = filtered.length !== 0;
  setText("course-count", `แสดง ${filtered.length} รายการ`);
}

function downloadJson() {
  const file = new Blob([`${JSON.stringify(studentRecord, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-degree-audit.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("ดาวน์โหลดข้อมูล JSON แล้ว");
}

async function initialize() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`โหลดข้อมูลตัวอย่างไม่สำเร็จ (HTTP ${response.status})`);
    }
    studentRecord = await response.json();
    renderStudent(studentRecord);
  } catch (error) {
    console.error("โหลดข้อมูลตัวอย่างไม่สำเร็จ:", error);
    showToast("โหลดข้อมูลไม่สำเร็จ กรุณาเปิดผ่านเว็บเซิร์ฟเวอร์", true);
    byId("student-name").textContent = "ไม่สามารถโหลดข้อมูลได้";
  }
}

byId("category-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button || !studentRecord) return;
  activeCategory = button.dataset.category;
  renderFilters(studentRecord.courses);
  renderCourses();
});

byId("course-search").addEventListener("input", () => {
  if (studentRecord) renderCourses();
});

byId("download-json").addEventListener("click", () => {
  if (studentRecord) downloadJson();
});

byId("print-report").addEventListener("click", () => window.print());

initialize();
