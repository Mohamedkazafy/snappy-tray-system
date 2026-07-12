import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      appName: "Restaurant POS",
      signOut: "Sign out",
      loading: "Loading…",
      cancel: "Cancel",
      save: "Save",
      search: "Search…",
      actions: "Actions",
      total: "Total",
      date: "Date",
      product: "Product",
      warehouse: "Warehouse",
      qty: "Qty",
      cost: "Cost",
      avgCost: "Avg cost",
      value: "Value",
      type: "Type",
      reason: "Reason",
      exportExcel: "Export Excel",
      // nav
      "nav.pos": "POS",
      "nav.tables": "Tables",
      "nav.special-orders": "Special Orders",
      "nav.dashboard": "Dashboard",
      "nav.products": "Products",
      "nav.categories": "Categories",
      "nav.payment-methods": "Payments",
      "nav.warehouses": "Warehouses",
      "nav.suppliers": "Suppliers",
      "nav.purchases": "Purchases",
      "nav.inventory": "Inventory",
      "nav.closing": "Day Closing",
      "nav.reports": "Reports",
      "nav.employees": "Employees",
      "nav.settings": "Settings",
      // inventory
      "inv.title": "Inventory",
      "inv.subtitle": "Live stock levels and movement history",
      "inv.adjust": "Adjust",
      "inv.transfer": "Transfer",
      "inv.currentStock": "Current stock",
      "inv.movements": "Movements",
      "inv.searchProduct": "Search product…",
      "inv.noStock": "No stock yet.",
      "inv.stockAdjustment": "Stock adjustment",
      "inv.stockTransfer": "Stock transfer",
      "inv.delta": "Delta (use negative to decrease)",
      "inv.note": "Note",
      "inv.from": "From",
      "inv.to": "To",
      "inv.quantity": "Quantity",
      "inv.selectProduct": "Select product",
      // reports
      "rep.title": "Reports",
      "rep.subtitle": "Slice sales by any dimension",
      "rep.revenueCostProfit": "Revenue / Cost / Profit",
      "rep.byDate": "By date",
      "rep.byProduct": "By product",
      "rep.byCategory": "By category",
      "rep.byEmployee": "By employee",
      "rep.byMethod": "By payment",
      "rep.bySaleType": "By sale type",
      "rep.category": "Category",
      "rep.employee": "Employee",
      "rep.method": "Method",
      "rep.saleType": "Sale type",
      "rep.noData": "No data.",
    },
  },
  ar: {
    translation: {
      appName: "نقطة بيع المطعم",
      signOut: "تسجيل الخروج",
      loading: "جارٍ التحميل…",
      cancel: "إلغاء",
      save: "حفظ",
      search: "بحث…",
      actions: "إجراءات",
      total: "الإجمالي",
      date: "التاريخ",
      product: "الصنف",
      warehouse: "المخزن",
      qty: "الكمية",
      cost: "التكلفة",
      avgCost: "متوسط التكلفة",
      value: "القيمة",
      type: "النوع",
      reason: "السبب",
      exportExcel: "تصدير إكسل",
      "nav.pos": "نقطة البيع",
      "nav.tables": "الطاولات",
      "nav.special-orders": "الطلبات الخاصة",
      "nav.dashboard": "لوحة التحكم",
      "nav.products": "الأصناف",
      "nav.categories": "التصنيفات",
      "nav.payment-methods": "طرق الدفع",
      "nav.warehouses": "المخازن",
      "nav.suppliers": "الموردون",
      "nav.purchases": "المشتريات",
      "nav.inventory": "المخزون",
      "nav.closing": "إقفال اليوم",
      "nav.reports": "التقارير",
      "nav.employees": "الموظفون",
      "nav.settings": "الإعدادات",
      "inv.title": "المخزون",
      "inv.subtitle": "مستويات المخزون الحية وسجل الحركات",
      "inv.adjust": "تعديل",
      "inv.transfer": "تحويل",
      "inv.currentStock": "المخزون الحالي",
      "inv.movements": "الحركات",
      "inv.searchProduct": "ابحث عن صنف…",
      "inv.noStock": "لا يوجد مخزون بعد.",
      "inv.stockAdjustment": "تعديل مخزون",
      "inv.stockTransfer": "تحويل مخزون",
      "inv.delta": "الفرق (استخدم قيمة سالبة للتخفيض)",
      "inv.note": "ملاحظة",
      "inv.from": "من",
      "inv.to": "إلى",
      "inv.quantity": "الكمية",
      "inv.selectProduct": "اختر الصنف",
      "rep.title": "التقارير",
      "rep.subtitle": "تحليل المبيعات من كل الزوايا",
      "rep.revenueCostProfit": "الإيراد / التكلفة / الربح",
      "rep.byDate": "حسب التاريخ",
      "rep.byProduct": "حسب الصنف",
      "rep.byCategory": "حسب التصنيف",
      "rep.byEmployee": "حسب الموظف",
      "rep.byMethod": "حسب الدفع",
      "rep.bySaleType": "حسب نوع البيع",
      "rep.category": "التصنيف",
      "rep.employee": "الموظف",
      "rep.method": "طريقة الدفع",
      "rep.saleType": "نوع البيع",
      "rep.noData": "لا توجد بيانات.",
    },
  },
};

const stored = typeof window !== "undefined" ? window.localStorage.getItem("lang") : null;

i18n.use(initReactI18next).init({
  resources,
  lng: stored || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(lng: "en" | "ar") {
  i18n.changeLanguage(lng);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("lang", lng);
    document.documentElement.lang = lng;
    document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  }
}

if (typeof window !== "undefined") {
  document.documentElement.lang = i18n.language;
  document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
}

export default i18n;
