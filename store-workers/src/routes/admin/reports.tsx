import { Hono } from "hono";
import {
  allCurrentStock,
  allHistory,
  currentStockPage,
  historyPage,
  pageParam,
  readCurrentFilters,
  readHistoryFilters,
  reportFilterOptions,
  reportSummary,
} from "../../lib/admin/stock-report";
import { stockLevel } from "../../lib/admin/inventory";
import { csvText, toCsv } from "../../lib/csv";
import { malaysiaNow } from "../../lib/format";
import type { AppEnv } from "../../types";
import { PrintStockReport, type PrintReportType } from "../../views/admin/PrintStockReport";
import { StockReportPage } from "../../views/admin/StockReportPage";
import { currentAdmin, renderAdmin } from "./shared";

/** /admin/reports/stock: the report page, its CSV export and its print view. */
const reportRoutes = new Hono<AppEnv>();

const LEVEL_LABEL = { out: "Out of Stock", low: "Low Stock", in: "In Stock" } as const;

reportRoutes.get("/stock", async (c) => {
  const query = new URL(c.req.url).searchParams;
  const isBoss = currentAdmin(c).role === "boss";
  const current = readCurrentFilters(query);
  const history = readHistoryFilters(query);
  const sql = c.var.db;

  const [summary, options, currentPage, movementPage] = await Promise.all([
    reportSummary(sql, isBoss),
    reportFilterOptions(sql),
    currentStockPage(sql, current, pageParam(query, "current_page")),
    historyPage(sql, history, pageParam(query, "history_page")),
  ]);

  return renderAdmin(
    c,
    { title: "Stock Report", active: "stock-report" },
    <StockReportPage
      query={query}
      summary={summary}
      options={options}
      current={current}
      history={history}
      currentPage={currentPage}
      historyPage={movementPage}
      isBoss={isBoss}
    />,
  );
});

reportRoutes.get("/stock/export.csv", async (c) => {
  const query = new URL(c.req.url).searchParams;
  const isBoss = currentAdmin(c).role === "boss";
  const stamp = malaysiaNow().replace(/[-:]/g, "").replace(" ", "_");
  let filename: string;
  let rows: (string | number)[][];

  if (query.get("report_type") === "history") {
    filename = `stock_movement_history_${stamp}.csv`;
    rows = [
      ["Date", "Item Code", "Product", "Category", "Subcategory", "Colour", "Size", "Movement Type", "Quantity Before", "Quantity Change", "Quantity After", "Reason", "Note", "Edited By"],
      ...(await allHistory(c.var.db, readHistoryFilters(query))).map((r) => [
        r.createdAt.slice(0, 19),
        csvText(r.itemCode),
        csvText(r.productName),
        csvText(r.category),
        csvText(r.subCategory),
        csvText(r.colourName),
        csvText(r.size),
        r.type === "IN" ? "Stock In" : "Stock Out",
        r.before,
        (r.type === "IN" ? "+" : "-") + r.quantity,
        r.after,
        csvText(r.reason),
        csvText(r.note),
        csvText(r.editedBy),
      ]),
    ];
  } else {
    filename = `current_stock_levels_${stamp}.csv`;
    rows = [
      ["Item Code", "Product Name", "Brand", "Category", "Subcategory", "Colour", "Size", "Quantity", "Price (RM)", ...(isBoss ? ["Online Price (RM)"] : []), "Stock Status", "Arrival Date"],
      ...(await allCurrentStock(c.var.db, readCurrentFilters(query))).map((r) => [
        csvText(r.itemCode),
        csvText(r.name),
        csvText(r.brand),
        csvText(r.category),
        csvText(r.subCategory),
        csvText(r.colourName),
        csvText(r.size),
        r.quantity,
        r.price.toFixed(2),
        ...(isBoss ? [r.onlinePrice.toFixed(2)] : []),
        LEVEL_LABEL[stockLevel(r.quantity)],
        r.arrivalDate,
      ]),
    ];
  }

  return c.body(toCsv(rows), 200, {
    "Content-Type": "text/csv; charset=UTF-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
});

reportRoutes.get("/stock/print", async (c) => {
  const query = new URL(c.req.url).searchParams;
  const admin = currentAdmin(c);
  const requested = query.get("report_type");
  const reportType: PrintReportType = requested === "current" || requested === "history" ? requested : "all";
  const currentFilters = readCurrentFilters(query);
  const historyFilters = readHistoryFilters(query);
  const sql = c.var.db;

  const [options, currentRows, historyRows] = await Promise.all([
    reportFilterOptions(sql),
    reportType !== "history" ? allCurrentStock(sql, currentFilters) : Promise.resolve(null),
    reportType !== "current" ? allHistory(sql, historyFilters) : Promise.resolve(null),
  ]);

  return c.html(
    <PrintStockReport
      reportType={reportType}
      generatedAt={malaysiaNow()}
      generatedBy={admin.displayName}
      isBoss={admin.role === "boss"}
      current={currentRows ? { filters: currentFilters, rows: currentRows } : null}
      history={historyRows ? { filters: historyFilters, rows: historyRows } : null}
      productLabel={(id) => options.products.find((p) => p.id === id)?.label ?? `#${id}`}
      colourLabel={(id) => options.colours.find((col) => col.id === id)?.name ?? `#${id}`}
    />,
  );
});

export default reportRoutes;
