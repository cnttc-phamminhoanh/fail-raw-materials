(() => {
  "use strict";

const SOLUTIONS = [
  "AOD / 选用",
  "Suppliers paid rework cost on site / 供应商支付返工费",
  "Replaced Material by Vendor / 供应商补料 (Using original PO 用回原PO号)",
  "Return to Vendor / 退回供应商 (Y/N)",
  "Scrap / 报废",
];

  const API_BASE = '/api/fail-materials';

  // Kiểm tra đăng nhập trước khi thực hiện hành động
  function requireAuth() {
  if (!Auth.isAuthenticated()) {
    localStorage.setItem("redirect_after_login", window.location.pathname + window.location.search);

    window.location.replace("/login");
    return false;
  }

  return true;
}

  // ===== PAGINATION STATE =====
  let currentPage = 1;
  let currentLimit = 25;
  let totalRecords = 0;
  let totalPages = 1;
  let pendingLoads = 0;
  let toastTimeout;

  function showSuccess(message) {
    const toast = document.getElementById("successToast");
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.hidden = false;
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 4500);
  }

  async function fetchDataFromAPI(search = '', date = '', page = 1, limit = 25) {
    try {
      let url = `${API_BASE}/paginated?page=${page}&limit=${limit}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (date) url += `&date=${date}`;
      const response = await API.request(url, { method: 'GET' });
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'API returned error');

      // Lưu thông tin phân trang
      if (result.pagination) {
        totalRecords = result.pagination.total || 0;
        totalPages = result.pagination.totalPages || 1;
      }

      return result.data || [];
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  }

  async function loadData(page = 1) {
    const search = els.searchInput.value.trim();
    const date = els.timeFilter.value;
    
    currentPage = page;
    
    const loading = document.getElementById("dataLoading");
    pendingLoads++;
    loading.hidden = false;
    loading.parentElement.setAttribute("aria-busy", "true");
    try {
      const data = await fetchDataFromAPI(search, date, currentPage, currentLimit);
      rows = data;
      renderBody(rows);
      updatePagination();
    } finally {
      pendingLoads--;
      loading.hidden = pendingLoads === 0;
      loading.parentElement.setAttribute("aria-busy", String(pendingLoads > 0));
    }
  }

  function updatePagination() {
    const start = (currentPage - 1) * currentLimit + 1;
    const end = Math.min(currentPage * currentLimit, totalRecords);
    
    document.getElementById('paginationInfo').textContent = `Showing ${totalRecords > 0 ? start : 0} - ${end} of ${totalRecords} records`;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} / ${totalPages || 1}`;

    document.getElementById('prevPageBtn').disabled = currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
  }

  const columns = [
    { key: "poNo", label: "PO No.", width: 98},
    { key: "poId", label: "PO ID", width: 38 },
    { key: "entryDate",label: "Date of<br>Entry",width: 95,date: true,},
    { key: "supplier", label: "Supplier", width: 104, align: "left" },
    { key: "orderQty", label: "Order<br>Qty", width: 54, number: true },
    { key: "tempReceiptNo", label: "Temp Receipt No.", width: 105 },
    { key: "tempReceiptId", label: "Temp<br>Receipt<br>ID", width: 50 },
    { key: "lotNo", label: "Lot No.", width: 100, group: "material" },
    { key: "materialCode", label: "Material<br>Code", width: 92, group: "material" },
    { key: "materialName", label: "Material<br>Name", width: 100, align: "left", group: "material" },
    { key: "tempReceiptQty", label: "Temp<br>Receipt<br>Qty", width: 73, number: true, group: "material" },
    { key: "focQty", label: "FOC<br>Qty", width: 56, number: true, group: "material" },
    { key: "rejectQty", label: "Reject<br>Qty", width: 73, number: true, reject: true, group: "material" },
    { key: "failPercent", label: "% Fail", width: 50, group: "material" },
    { key: "orderPrice", label: "Order<br>Price", width: 130, group: "material" },
    { key: "totalAmount",label: "Total<br>Amount",width: 140,number: true,group: "material",},
    { key: "exchangeRate", label: "Exchange Rate<br>(VND per USD)", width: 120, number: true, group: "material" },
    { key: "amountUsd", label: "Amount<br>(USD)", width: 110, number: true, group: "material" },
    { key: "solution", label: "Solution", width: 129, align: "left", solution: true, group: "solution" },
    { key: "solutionUpdater", label: "Solution<br>Updater", width: 62, solution: true, group: "solution" },
    { key: "updateTime", label: "Update<br>Time", width: 128, solution: true, group: "solution" },
    { key: "edit", label: "Action", width: 98, edit: true, group: "solution" },
    { key: "status", label: "", width: 5, status: true, group: "actual" },
    { key: "returnedInternal", label: "Returned<br>Internal",width: 58, actual: true, group: "actual" },
    { key: "returnedCustoms", label: "Returned<br>Customs",width: 58, actual: true, group: "actual"},
    { key: "destroyedInternal", label: "Destroyed<br>Internal",width: 60, actual: true, group: "actual" },
    { key: "destroyedCustoms", label: "Destroyed<br>Customs",width: 60, actual: true, group: "actual" },
    { key: "remainQty", label: "Remain<br>Qty", width: 66, number: true, actual: true, group: "actual"},
    { key: "remainAction", label: "Action", width: 53, actualAction: true, group: "actual" },
    { key: "replacementQty", label: "Replacement<br>Qty", width: 80, number: true },
    { key: "newLotNo", label: "New Lot No.", width: 80, align: "left" },
  ];

  let rows = [];
  let currentRow = null;
  let resizing = null;

  const els = {
    columnGroup: document.getElementById("columnGroup"),
    tableHead: document.getElementById("tableHead"),
    tableBody: document.getElementById("tableBody"),
    rowCount: document.getElementById("rowCount"),
    pendingCount: document.getElementById("pendingCount"),
    searchInput: document.getElementById("searchInput"),
    timeFilter: document.getElementById("timeFilter"),
    searchBtn: document.getElementById("searchBtn"),
    resetBtn: document.getElementById("resetBtn"),
    modal: document.getElementById("solutionModal"),
    modalInfo: document.getElementById("modalInfo"),
    modalAction: document.getElementById("modalAction"),
    solutionSelect: document.getElementById("solutionSelect"),
    solutionForm: document.getElementById("solutionForm"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    cancelBtn: document.getElementById("cancelBtn"),

    // Thêm các element cho export modal
    exportModal: document.getElementById("exportModal"),
    exportModalInfo: document.getElementById("exportModalInfo"),
    exportTypeSelect: document.getElementById("exportTypeSelect"),
    exportQuantity: document.getElementById("exportQuantity"),
    exportForm: document.getElementById("exportForm"),
    closeExportModalBtn: document.getElementById("closeExportModalBtn"),
    cancelExportBtn: document.getElementById("cancelExportBtn"),
    maxExportQty: document.getElementById("maxExportQty"),
    exportTempReceipt: document.getElementById("exportTempReceipt"),
    exportTempID: document.getElementById("exportTempID"),
    exportLotNo: document.getElementById("exportLotNo"),
    exportRemainQty: document.getElementById("exportRemainQty"),
  };

  function formatEntryDate(value) {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";

  return `${day}/${month}/${year}`;
}

  function formatDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function hasActualHandling(row) {
    const values = [
      row.returnedInternal,
      row.returnedCustoms,
      row.destroyedInternal,
      row.destroyedCustoms,
    ];

    return values.some((v) => {
      if (v === null || v === undefined || v === "") return false;
      const num = Number(v);
      return !isNaN(num) && num > 0;
    });
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "";
    return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  function formatPrice(value) {
    if (value === null || value === undefined || value === "") return "";
    return Number(value).toFixed(4);
  }

  function displayValue(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getTotalTableWidth() {
    return columns.reduce((total, col) => total + col.width, 0);
  }

  function applyTableWidth() {
    const totalWidth = getTotalTableWidth();

    const table = document.getElementById("failTable");

    if (table) {
      table.style.setProperty("--table-width", `${totalWidth}px`);
      table.style.width = `${totalWidth}px`;
      table.style.minWidth = `${totalWidth}px`;
    }
  }

  function renderColGroup() {
    els.columnGroup.innerHTML = columns
      .map((col) => {
        if (col.key === "status") {
          return `
            <col
              data-key="${col.key}"
              style="
                width:10px;
                min-width:10px;
                max-width:10px;
              "
            >
          `;
        }

        return `
          <col
            data-key="${col.key}"
            style="
              width:${col.width}px;
            "
          >
        `;
      })
      .join("");

    applyTableWidth();
  }

  function updateGroupWidths() {
    const groupHeaders = document.querySelectorAll(
      "#failTable .group-row th[colspan]"
    );

    groupHeaders.forEach((th) => {
      const key = th.dataset.colKey;
      const startIndex = columns.findIndex((c) => c.key === key);

      if (startIndex === -1) return;

      let totalWidth = 0;

      for (let i = startIndex; i < columns.length; i++) {
        if (columns[i].group === columns[startIndex].group) {
          totalWidth += columns[i].width;
        } else {
          break;
        }
      }

      th.style.width = `${totalWidth}px`;
    });

    applyTableWidth();
  }

  function renderHead() {
    const groupLabels = {
      material: "Material / Failure",
      solution: "Solution (Saler)",
      actual: "Actual Handling (WH)",
    };
    const groupClass = {
      material: "group-title",
      solution: "group-solution",
      actual: "group-actual",
    };

    let row1 = `<tr class="group-row">`;

    columns.forEach((col, index) => {
      if (col.group) {
        const prevCol = index > 0 ? columns[index - 1] : null;
        if (!prevCol || prevCol.group !== col.group) {
          let colspan = 1;
          let totalWidth = col.width;
          for (let i = index + 1; i < columns.length; i++) {
            if (columns[i].group === col.group) {
              colspan++;
              totalWidth += columns[i].width;
            } else break;
          }

          row1 += `<th
            class="${groupClass[col.group] || "group-title"}"
            data-col-key="${col.key}"
            colspan="${colspan}"
            style="width:${totalWidth}px;"
          >
            ${groupLabels[col.group] || ""}
          </th>`;
        }
      } else {
        row1 += `<th
          class="group-title ungrouped-header"
          data-col-key="${col.key}"
          rowspan="2"
          style="width:${col.width}px;position:relative;"
        >
          ${col.label}
          <span class="resize-handle" aria-hidden="true"></span>
        </th>`;
      }
    });
    row1 += `</tr>`;

    let row2 = `<tr class="leaf-row">`;
    columns.forEach((col) => {
      if (col.group) {
        let colClass = "base-header";

        if (col.reject) colClass = "reject-header";
        else if (col.group === "solution") colClass = "solution-sub";
        else if (col.actual && !col.actualAction) colClass = "actual-sub";
        else if (col.actualAction) colClass = "action-header"; // Style cho cột action
        else if (col.status) colClass = "status-header";
        else if (col.edit) colClass = "edit-header";

        row2 += `<th
          class="${colClass}"
          data-col-key="${col.key}"
          style="width:${col.width}px;position:relative;"
        >
          <span>${col.label}</span>
          <span class="resize-handle" aria-hidden="true"></span>
        </th>`;
      }
    });
    row2 += `</tr>`;

    els.tableHead.innerHTML = row1 + row2;
    addResizeHandles();
  }

  function cellHtml(col, row) {
    const classes = [];

    if (col.align === "left") classes.push("text-left");
    if (col.align === "right") classes.push("text-right");
    if (col.number || col.price) classes.push("number");
    if (col.reject) classes.push("reject-value");

    if (col.key === "remainQty") {
      classes.push("remain-value");
      if (row.remainQty > 0) {
        classes.push("remain-positive");
      } else if (row.remainQty === 0 && row.solution) {
        classes.push("remain-zero");
      }
    }

    const actualValue = col.actual ? row[col.key] : null;
    if (
      col.actual &&
      actualValue !== null &&
      actualValue !== undefined &&
      actualValue !== ""
    )
      classes.push("actual-has-value");

    let value = row[col.key];
    if (col.key === "totalAmount") {
      const amount = formatNumber(value);
      value = amount === "" ? "" : [amount, row.currency].filter(Boolean).join(" ");
    }
    else if (col.key === "exchangeRate") {
      value = formatNumber(value) || "N/A";
    }
    else if (col.key === "amountUsd") {
      const amount = formatNumber(value);
      value = amount === "" ? "" : `${amount} USD`;
    }
    else if (col.date) value = formatEntryDate(value);
    else if (col.price) value = formatPrice(value);
    else if (col.number) value = formatNumber(value);
    value = displayValue(value);

    return `<td class="${classes.join(" ")}" data-col-key="${col.key}" title="${escapeHtml(value)}"><span class="cell-content">${escapeHtml(value)}</span></td>`;
  }
function getGroupRowspan(data, startIndex, includePoId = false) {
  const firstRow = data[startIndex];

  if (!firstRow.poNo) return 1;
  if (includePoId && !firstRow.poId) return 1;

  let count = 1;

  for (let i = startIndex + 1; i < data.length; i++) {
    const nextRow = data[i];

    if (nextRow.poNo !== firstRow.poNo) break;
    if (includePoId && nextRow.poId !== firstRow.poId) break;

    count++;
  }

  return count;
}
  function renderBody(filteredRows = rows) {
    els.tableBody.innerHTML = filteredRows.map((row, filteredIndex) => {
    const previousRow = filteredRows[filteredIndex - 1];

    const isSamePO =
    Boolean(previousRow) &&
    Boolean(row.poNo) &&
    row.poNo === previousRow.poNo;

    const isSamePOGroup =
    isSamePO &&
    Boolean(row.poId) &&
    row.poId === previousRow.poId;

      const solution = row.solution ? {
        solution: row.solution,
        updater: row.solutionUpdater,
        updateTime: row.updateTime
      } : null;

      const actual = hasActualHandling(row);
      let html = `<tr>`;

      columns.forEach(col => {
     if (col.key === "poNo") {
  if (!isSamePO) {
    const rowspan = getGroupRowspan(filteredRows, filteredIndex);
    const value = escapeHtml(row.poNo || "");

    html += `
      <td class="po-merged-cell"
          data-col-key="poNo"
          rowspan="${rowspan}"
          title="${value}">
        <span class="cell-content">${value}</span>
      </td>
    `;
  }
  return;
}

if (col.key === "poId") {
  if (!isSamePOGroup) {
    const rowspan = getGroupRowspan(filteredRows, filteredIndex, true);
    const value = escapeHtml(row.poId || "");

    html += `
      <td class="po-merged-cell"
          data-col-key="poId"
          rowspan="${rowspan}"
          title="${value}">
        <span class="cell-content">${value}</span>
      </td>
    `;
  }
  return;
}

        if (col.key === "status") {
          html += `<td class="status-cell" data-col-key="status" title="${actual ? "Actual handling data exists" : "No actual handling data"}"><span class="status-dot ${actual ? "ok" : "pending"}"></span></td>`;
          return;
        }
        
        // if (col.key === "edit") {
        //   const hasSolution = solution !== null;
        //   const authenticated = Auth.isAuthenticated();
        //   const user = Auth.getUser();
        //   const canEdit = user?.can_edit === true;

        //   // Kiểm tra có actual handling không
        //   const hasActual = hasActualHandling(row);
          
        //   // Disabled nếu:
        //   // 1. Đã login nhưng không có quyền edit
        //   // 2. Đã có actual handling (không cho sửa/cancel solution)
        //   const isDisabled = (authenticated && !canEdit) || hasActual;

        //   // Tooltip cho Edit
        //   let editTitle = 'Edit solution';
        //   if (!authenticated) {
        //     editTitle = 'Please login to edit';
        //   } else if (!canEdit) {
        //     editTitle = 'You do not have permission to edit';
        //   } else if (hasActual) {
        //     editTitle = 'Cannot edit: this record has actual handling data';
        //   }

        //   // Tooltip cho Cancel
        //   let cancelTitle = 'Cancel solution';
        //   if (!authenticated) {
        //     cancelTitle = 'Please login to cancel';
        //   } else if (!canEdit) {
        //     cancelTitle = 'You do not have permission to cancel solution';
        //   } else if (hasActual) {
        //     cancelTitle = 'Cannot cancel: this record has actual handling data';
        //   }

        //   html += `
        //     <td class="edit-cell" data-col-key="edit">
        //       <button
        //         class="edit-btn ${isDisabled ? "permission-disabled" : ""}"
        //         data-index="${filteredIndex}"
        //         ${isDisabled ? 'disabled' : ''}
        //         title="${!authenticated ? 'Please login to edit' : isDisabled ? 'You do not have permission to edit' : 'Edit solution'}"
        //       >
        //         Edit
        //       </button>
        //       ${
        //         hasSolution
        //           ? `
        //             <button
        //               class="cancel-btn ${isDisabled ? "permission-disabled" : ""}"
        //               data-index="${filteredIndex}"
        //               ${isDisabled ? 'disabled' : ''}
        //               title="${!authenticated ? 'Please login to cancel' : isDisabled ? 'You do not have permission to cancel solution' : 'Cancel solution'}"
        //             >
        //               Cancel
        //             </button>
        //           `
        //           : ""
        //       }
        //     </td>
        //   `;
        //   return;
        // }


        if (col.key === "edit") {
          const hasSolution = solution !== null;
          const authenticated = Auth.isAuthenticated();
          const user = Auth.getUser();
          const canEdit = user?.can_edit === true;

          // Kiểm tra có actual handling không
          const hasActual = hasActualHandling(row);
          
          // Disabled nếu:
          // 1. Đã login nhưng không có quyền edit
          // 2. Đã có actual handling (không cho sửa/cancel solution)
          const isDisabled = (authenticated && !canEdit) || hasActual;

          // Tooltip cho Edit
          let editTitle = 'Edit solution';
          if (!authenticated) {
            editTitle = 'Please login to edit';
          } else if (!canEdit) {
            editTitle = 'You do not have permission to edit';
          } else if (hasActual) {
            editTitle = 'Cannot edit: this record has actual handling data';
          }

          // Tooltip cho Cancel
          let cancelTitle = 'Cancel solution';
          if (!authenticated) {
            cancelTitle = 'Please login to cancel';
          } else if (!canEdit) {
            cancelTitle = 'You do not have permission to cancel solution';
          } else if (hasActual) {
            cancelTitle = 'Cannot cancel: this record has actual handling data';
          }

          html += `
            <td class="edit-cell" data-col-key="edit">
              <button
                class="edit-btn ${isDisabled ? "permission-disabled" : ""}"
                data-index="${filteredIndex}"
                ${isDisabled ? 'disabled' : ''}
                title="${escapeHtml(editTitle)}"
              >
                Edit
              </button>
              ${
                hasSolution
                  ? `
                    <button
                      class="cancel-btn ${isDisabled ? "permission-disabled" : ""}"
                      data-index="${filteredIndex}"
                      ${isDisabled ? 'disabled' : ''}
                      title="${escapeHtml(cancelTitle)}"
                    >
                      Cancel
                    </button>
                  `
                  : ""
              }
            </td>
          `;
          return;
        }

        // ===== CỘT REMAIN ACTION MỚI =====
        if (col.key === "remainAction") {
          const hasRemain = row.remainQty && row.remainQty > 0;
          const hasSolution = solution !== null;
          const authenticated = Auth.isAuthenticated();
          const user = Auth.getUser();
          const canEdit = user?.can_edit === true;
          
          const isDisabled = !authenticated || !canEdit || !hasRemain || !hasSolution;

          let tooltip = 'Export stock';
          if (!authenticated) tooltip = 'Please login to export';
          else if (!canEdit) tooltip = 'You do not have permission to export';
          else if (!hasRemain) tooltip = 'No remain quantity to export';
          else if (!hasSolution) tooltip = 'Please define solution first';

          html += `
            <td class="action-cell" data-col-key="remainAction">
              <button
                class="export-btn ${isDisabled ? 'permission-disabled' : ''}"
                data-index="${filteredIndex}"
                ${isDisabled ? 'disabled' : ''}
                title="${escapeHtml(tooltip)}"
              >
                Export
              </button>
            </td>
          `;
          return;
        }

        if (col.key === "solution") {
          const value = solution?.solution || "";
          html += `<td class="solution-text" data-col-key="solution" title="${escapeHtml(value)}"><span class="cell-content">${escapeHtml(value)}</span></td>`;
          return;
        }
        if (col.key === "solutionUpdater") {
          const value = solution?.updater || "";
          html += `<td class="solution-text" data-col-key="solutionUpdater" title="${escapeHtml(value)}"><span class="cell-content">${escapeHtml(value)}</span></td>`;
          return;
        }
        if (col.key === "updateTime") {
          const value = formatDateTime(solution?.updateTime);
          html += `<td class="solution-text" data-col-key="updateTime" title="${escapeHtml(value)}"><span class="cell-content">${escapeHtml(value)}</span></td>`;
          return;
        }

        html += cellHtml(col, row);
      });

      html += `</tr>`;
      return html;
    }).join("");

    els.rowCount.textContent = filteredRows.length;
    els.pendingCount.textContent = filteredRows.filter(row => !row.solution).length;
  }

  function addResizeHandles() {
    document.querySelectorAll("#failTable .resize-handle").forEach((handle) => {
      handle.removeEventListener("mousedown", startResize);
      handle.addEventListener("mousedown", startResize);
    });
  }

  function startResize(event) {
    event.preventDefault();
    event.stopPropagation();
    const th = event.currentTarget.closest("th");
    const key = th?.dataset.colKey;
    const index = columns.findIndex((col) => col.key === key);
    if (index < 0) return;
    resizing = {
      index,
      startX: event.clientX,
      startWidth: columns[index].width,
    };
    document.body.classList.add("resizing");
    document.addEventListener("mousemove", resizeColumn);
    document.addEventListener("mouseup", stopResize);
  }

  function resizeColumn(event) {
    if (!resizing) return;

    const delta = event.clientX - resizing.startX;

    const newWidth = Math.max(30, Math.min(700, resizing.startWidth + delta));

    columns[resizing.index].width = newWidth;

    const colKey = columns[resizing.index].key;

    // Update <col>
    const colEl = document.querySelector(
      `#failTable col[data-key="${colKey}"]`
    );

    if (colEl) {
      colEl.style.width = `${newWidth}px`;
    }

    // Update header + body cells
    document.querySelectorAll(`#failTable [data-col-key="${colKey}"]`).forEach((el) => {
      el.style.width = `${newWidth}px`;
    });

    // Update group header + total table width
    updateGroupWidths();
  }

  function stopResize() {
    resizing = null;
    document.body.classList.remove("resizing");
    document.removeEventListener("mousemove", resizeColumn);
    document.removeEventListener("mouseup", stopResize);
  }

  function openModal(row) {
    currentRow = row;
    const existing = row.solution ? { solution: row.solution } : null;

    els.solutionSelect.innerHTML = SOLUTIONS.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    
const legacySolutions = {
  "Supplier Pays Rework Cost On Site / 供应商支付返工费": SOLUTIONS[1],
  "Replacement Material by Vendor / 供应商补料": SOLUTIONS[2],
  "Using the Original PO Number / 用回原PO号": SOLUTIONS[2],
};

const selectedSolution =
  legacySolutions[existing?.solution] || existing?.solution;

els.solutionSelect.value =
  SOLUTIONS.includes(selectedSolution) ? selectedSolution : existing ? "" : SOLUTIONS[0];
    els.modalAction.textContent = existing ? "UPDATE" : "INSERT";
    els.modalInfo.innerHTML = `<b>Temp Receipt:</b> ${escapeHtml(row.tempReceiptNo)} &nbsp; <b>ID:</b> ${escapeHtml(row.tempReceiptId)}<br><b>Lot:</b> ${escapeHtml(row.lotNo)} &nbsp; <b>Material:</b> ${escapeHtml(row.materialCode)} - ${escapeHtml(row.materialName)}`;
    els.modal.hidden = false;
    setTimeout(() => els.solutionSelect.focus(), 0);
  }

  function closeModal() {
    els.modal.hidden = true;
    currentRow = null;
  }

  async function saveSolution(event) {
    event.preventDefault();
    if (!currentRow) return;

    if (!Auth.isAuthenticated()) {
      localStorage.setItem("redirect_after_login", window.location.pathname + window.location.search);

      window.location.replace("/login");
      return;
    }

    const user = Auth.getUser();

    if (user?.can_edit !== true) {
      alert("You do not have permission to edit solution.");
      return;
    }

    if (hasActualHandling(currentRow)) {
      alert("Cannot save solution: this record already has actual handling data.");
      closeModal();
      return;
    }

    const payload = {
      tempReceiptNo: currentRow.tempReceiptNo,
      tempReceiptId: currentRow.tempReceiptId,
      solution: els.solutionSelect.value,
      updater: user.user_no,
    };

    try {
      const response = await API.request('/api/fail-materials/solution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to save solution');
      }

      currentRow.solution = payload.solution;
      currentRow.solutionUpdater = payload.updater;
      currentRow.updateTime = new Date().toISOString();

      renderBody(rows);
      closeModal();
      showSuccess("Solution saved successfully.");
    } catch (error) {
      console.error('Error saving solution:', error);
      alert('Failed to save solution: ' + error.message);
    }
  }

  async function cancelSolution(row) {
    if (!Auth.isAuthenticated()) {
      localStorage.setItem(
        "redirect_after_login",
        window.location.pathname + window.location.search
      );

      window.location.replace("/login");
      return;
    }

    const user = Auth.getUser();

    if (user?.can_edit !== true) {
      alert("You do not have permission to cancel solution.");
      return;
    }

    if (!row) return;

    if (hasActualHandling(row)) {
      alert("Cannot cancel solution: this record already has actual handling data.");
      return;
    }

    try {
      const response = await API.request('/api/fail-materials/solution', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempReceiptNo: row.tempReceiptNo,
          tempReceiptId: row.tempReceiptId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to cancel solution');
      }

      row.solution = "";
      row.solutionUpdater = "";
      row.updateTime = null;

      renderBody(rows);
    } catch (error) {
      console.error('Error cancelling solution:', error);
      alert('Failed to cancel solution: ' + error.message);
    }
  }

  // ===== EXPORT HANDLING =====
  let currentExportRow = null;

  function openExportModal(row) {
    if (!row) return;
    
    // Kiểm tra điều kiện
    if (!row.solution) {
      alert('Please define solution before exporting.');
      return;
    }
    
    if (!row.remainQty || row.remainQty <= 0) {
      alert('No remain quantity to export.');
      return;
    }

    currentExportRow = row;
    
    // Reset form
    els.exportTypeSelect.value = '';
    els.exportQuantity.value = '';

    // Cập nhật thông tin
    els.exportModalInfo.innerHTML = `
      <b>Material Code:</b> ${escapeHtml(row.materialCode)}<br>
      <b>Material Name:</b> ${escapeHtml(row.materialName)}<br>
      <b>Solution:</b> ${escapeHtml(row.solution)}
    `;
    
    els.exportTempReceipt.textContent = row.tempReceiptNo;
    els.exportTempID.textContent = row.tempReceiptId;
    els.exportLotNo.textContent = row.lotNo;
    els.exportRemainQty.textContent = formatNumber(row.remainQty);
    els.maxExportQty.textContent = formatNumber(row.remainQty);
    
    // Set max attribute cho input
    els.exportQuantity.max = row.remainQty;
    els.exportQuantity.placeholder = `Max: ${formatNumber(row.remainQty)}`;
    
    els.exportModal.hidden = false;
    setTimeout(() => els.exportTypeSelect.focus(), 0);
  }

  function closeExportModal() {
    els.exportModal.hidden = true;
    currentExportRow = null;
  }

  async function handleExportSubmit(event) {
    event.preventDefault();
    
    if (!currentExportRow) return;
    
    const type = els.exportTypeSelect.value;
    const quantity = parseFloat(els.exportQuantity.value);
    
    // Validate
    if (!type) {
      alert('Please select a handling type.');
      return;
    }
    
    if (!quantity || quantity <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }
    
    if (quantity > currentExportRow.remainQty) {
      alert(`Quantity cannot exceed remain quantity (${formatNumber(currentExportRow.remainQty)}).`);
      return;
    }

    // Xác nhận với user
    const typeLabels = {
      returnedCustoms: 'Returned Customs',
      returnedInternal: 'Returned Internal',
      destroyedCustoms: 'Destroyed Customs',
      destroyedInternal: 'Destroyed Internal'
    };

    const confirmed = confirm(
      `Temp Receipt: ${currentExportRow.tempReceiptNo}\n` +
      `Lot: ${currentExportRow.lotNo}\n` +
      `Material: ${currentExportRow.materialCode}\n` +
      `Handling Type: ${typeLabels[type] || type}\n` +
      `Quantity: ${formatNumber(quantity)}\n` +
      `Remain Qty after: ${formatNumber(currentExportRow.remainQty - quantity)}\n\n` +
      `Are you sure to proceed?`
    );

    if (!confirmed) return;

    try {
      const response = await API.request('/api/fail-materials/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempReceiptNo: currentExportRow.tempReceiptNo,
          tempReceiptId: currentExportRow.tempReceiptId,
          handlingType: type,
          quantity: quantity,
          solution: currentExportRow.solution,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to export stock');
      }

      alert(`Stock exported successfully!\nType: ${typeLabels[type] || type}\nQuantity: ${formatNumber(quantity)}`);
      
      closeExportModal();
      
      // Refresh data
      loadData(currentPage);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Failed to export: ' + error.message);
    }
  }

  // Hàm handleExport gốc - sẽ mở modal thay vì export trực tiếp
  async function handleExport(row) {
    if (!row) return;
    
    // Kiểm tra điều kiện
    if (!row.solution) {
      alert('Please define solution before exporting.');
      return;
    }
    
    if (!row.remainQty || row.remainQty <= 0) {
      alert('No remain quantity to export.');
      return;
    }

    // Mở modal thay vì export trực tiếp
    openExportModal(row);
  }

  function initEvents() {
    els.searchBtn.addEventListener('click', () => {
      currentPage = 1; // Reset về trang 1 khi tìm kiếm
      loadData(1);
    });

    els.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        currentPage = 1;
        loadData(1);
      }
    });

    els.resetBtn.addEventListener('click', () => {
      els.searchInput.value = '';
      els.timeFilter.value = '';
      currentPage = 1;
      loadData(1);
    });

    document.getElementById('prevPageBtn').addEventListener('click', () => {
      if (currentPage > 1) {
        loadData(currentPage - 1);
      }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
      if (currentPage < totalPages) {
        loadData(currentPage + 1);
      }
    });

    document.getElementById('limitSelect').addEventListener('change', (event) => {
      currentLimit = parseInt(event.target.value, 10);
      currentPage = 1;
      loadData(1);
    });

    els.tableBody.addEventListener("click", (event) => {
      // Edit button
      const editBtn = event.target.closest(".edit-btn");

      if (editBtn && !editBtn.disabled) {
        // Chưa login → chuyển /login
        if (!requireAuth()) return;

        // Đã login → kiểm tra quyền
        const user = Auth.getUser();

        if (user?.can_edit !== true) {
          alert("You do not have permission to edit solution.");
          return;
        }

        const row = rows[Number(editBtn.dataset.index)];

        if (row && hasActualHandling(row)) {
          alert("Cannot edit solution: this record already has actual handling data.");
          return;
        }

        if (row) {
          openModal(row);
        }
        return;
      }

      // Cancel button
      const cancelBtn = event.target.closest(".cancel-btn");

      if (cancelBtn && !cancelBtn.disabled) {
        if (!requireAuth()) return;

        const user = Auth.getUser();

        if (user?.can_edit !== true) {
          alert("You do not have permission to cancel solution.");
          return;
        }

        const row = rows[Number(cancelBtn.dataset.index)];

        if (row && hasActualHandling(row)) {
          alert("Cannot cancel solution: this record already has actual handling data.");
          return;
        }

        if (row && confirm(`Are you sure you want to cancel the solution for "${row.tempReceiptNo}"?`)) {
          cancelSolution(row);
        }
        return;
      }

      // Export button
      const exportBtn = event.target.closest(".export-btn");

      if (exportBtn && !exportBtn.disabled) {
        if (!requireAuth()) return;

        const user = Auth.getUser();
        if (user?.can_edit !== true) {
          alert("You do not have permission to export.");
          return;
        }

        const row = rows[Number(exportBtn.dataset.index)];
        if (row) {
          handleExport(row);
        }
        return;
      }
    });

    els.solutionForm.addEventListener("submit", saveSolution);
    els.closeModalBtn.addEventListener("click", closeModal);
    els.cancelBtn.addEventListener("click", closeModal);
    els.modal.addEventListener("click", (event) => {
      if (event.target === els.modal) closeModal();
    });

    // Export modal events
    els.exportForm.addEventListener("submit", handleExportSubmit);
    els.closeExportModalBtn.addEventListener("click", closeExportModal);
    els.cancelExportBtn.addEventListener("click", closeExportModal);
    els.exportModal.addEventListener("click", (event) => {
      if (event.target === els.exportModal) closeExportModal();
    });
    
    // Close export modal with Escape key
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!els.modal.hidden) closeModal();
        if (!els.exportModal.hidden) closeExportModal();
      }
    });
  }

  initEvents();

  // ===== USER SECTION =====
  function updateUserUI() {
    const user = Auth.getUser();
    const isAuth = Auth.isAuthenticated();
    
    const avatarEl = document.getElementById('userInitial');
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileEl = document.getElementById('userProfile');

    if (isAuth && user) {
      // Lấy chữ cái đầu của username
      const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
      avatarEl.textContent = initial;
      nameEl.textContent = user.username || 'User';
      roleEl.textContent = user.can_edit ? 'Editor' : 'Viewer';
      
      // Hiển thị profile
      profileEl.style.display = 'flex';
    } else {
      // Guest mode
      avatarEl.textContent = 'G';
      nameEl.textContent = 'Guest';
      roleEl.textContent = 'Viewer';
      profileEl.style.display = 'flex';
    }

    // Logout
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('fail_auth_token');
        localStorage.removeItem('fail_auth_user');
        window.location.replace('/login');
      }
    });
  }

  // Gọi updateUserUI sau khi render
  function render() {
    renderColGroup();
    renderHead();

    const limitSelect = document.getElementById('limitSelect');

    if (limitSelect) {
      currentLimit = parseInt(limitSelect.value, 10);
    }
    
    updateUserUI();
    loadData(1);
  }

  render();
})();
