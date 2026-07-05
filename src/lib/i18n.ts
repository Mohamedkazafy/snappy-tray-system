import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      app: { name: "Restaurant POS", tagline: "Fast, simple point-of-sale" },
      common: {
        loading: "Loading…",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        add: "Add",
        create: "Create",
        update: "Update",
        search: "Search",
        actions: "Actions",
        name: "Name",
        price: "Price",
        cost: "Cost",
        qty: "Qty",
        quantity: "Quantity",
        total: "Total",
        subtotal: "Subtotal",
        tax: "Tax",
        discount: "Discount",
        paid: "Paid",
        remaining: "Remaining",
        notes: "Notes",
        status: "Status",
        type: "Type",
        category: "Category",
        confirm: "Confirm",
        yes: "Yes",
        no: "No",
        back: "Back",
        next: "Next",
        close: "Close",
        print: "Print",
        charge: "Charge",
        complete: "Complete",
        signOut: "Sign out",
        signIn: "Sign in",
        signUp: "Sign up",
        email: "Email",
        password: "Password",
        fullName: "Full name",
        language: "Language",
      },
      nav: {
        pos: "POS",
        tables: "Tables",
        dashboard: "Dashboard",
        products: "Products",
        categories: "Categories",
        payments: "Payments",
        warehouses: "Warehouses",
        suppliers: "Suppliers",
        purchases: "Purchases",
        inventory: "Inventory",
        closing: "Day Closing",
        reports: "Reports",
        employees: "Employees",
        settings: "Settings",
      },
      auth: {
        signInTitle: "Sign in to continue",
        signUpTitle: "Create your account",
        needAccount: "Need an account? Sign up",
        haveAccount: "Have an account? Sign in",
        firstAdminHint: "The first user to sign up becomes the administrator.",
        pleaseWait: "Please wait…",
        createAccount: "Create account",
        accountCreated: "Account created. You are signed in.",
        failed: "Sign-in failed",
      },
      pos: { title: "Point of Sale" },
      tables: { title: "Tables" },
    },
  },
  ar: {
    translation: {
      app: { name: "نقاط بيع المطعم", tagline: "نظام بيع سريع وبسيط" },
      common: {
        loading: "جارٍ التحميل…",
        save: "حفظ",
        cancel: "إلغاء",
        delete: "حذف",
        edit: "تعديل",
        add: "إضافة",
        create: "إنشاء",
        update: "تحديث",
        search: "بحث",
        actions: "إجراءات",
        name: "الاسم",
        price: "السعر",
        cost: "التكلفة",
        qty: "الكمية",
        quantity: "الكمية",
        total: "الإجمالي",
        subtotal: "المجموع الفرعي",
        tax: "الضريبة",
        discount: "الخصم",
        paid: "المدفوع",
        remaining: "المتبقي",
        notes: "ملاحظات",
        status: "الحالة",
        type: "النوع",
        category: "الفئة",
        confirm: "تأكيد",
        yes: "نعم",
        no: "لا",
        back: "رجوع",
        next: "التالي",
        close: "إغلاق",
        print: "طباعة",
        charge: "تحصيل",
        complete: "إتمام",
        signOut: "تسجيل الخروج",
        signIn: "تسجيل الدخول",
        signUp: "إنشاء حساب",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        fullName: "الاسم الكامل",
        language: "اللغة",
      },
      nav: {
        pos: "نقاط البيع",
        tables: "الطاولات",
        dashboard: "لوحة التحكم",
        products: "المنتجات",
        categories: "الفئات",
        payments: "طرق الدفع",
        warehouses: "المستودعات",
        suppliers: "الموردون",
        purchases: "المشتريات",
        inventory: "المخزون",
        closing: "إقفال اليوم",
        reports: "التقارير",
        employees: "الموظفون",
        settings: "الإعدادات",
      },
      auth: {
        signInTitle: "سجّل الدخول للمتابعة",
        signUpTitle: "أنشئ حسابك",
        needAccount: "لا تملك حساباً؟ أنشئ حساباً",
        haveAccount: "لديك حساب؟ سجّل الدخول",
        firstAdminHint: "أول مستخدم يسجل يصبح المدير.",
        pleaseWait: "يرجى الانتظار…",
        createAccount: "إنشاء الحساب",
        accountCreated: "تم إنشاء الحساب. تم تسجيل دخولك.",
        failed: "فشل تسجيل الدخول",
      },
      pos: { title: "نقاط البيع" },
      tables: { title: "الطاولات" },
    },
  },
} as const;

const STORAGE_KEY = "pos.lang";
const DEFAULT_LANG = "ar";

function getInitialLang(): "ar" | "en" {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "ar" ? stored : DEFAULT_LANG;
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getInitialLang(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export function setLanguage(lang: "ar" | "en") {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }
}

export function currentLanguage(): "ar" | "en" {
  return (i18n.language as "ar" | "en") || DEFAULT_LANG;
}

export default i18n;
