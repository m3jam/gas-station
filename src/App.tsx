import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Fuel, 
  Settings, 
  LogOut, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown,
  Wallet, 
  AlertCircle,
  ChevronLeft,
  Search,
  Calendar,
  Package,
  Users,
  Trash2,
  FileText,
  Printer,
  RefreshCw,
  CreditCard,
  CheckCircle,
  X,
  Menu,
  Instagram,
  Send,
  MessageCircle,
  Phone,
  Bell,
  Clock,
  AlertTriangle,
  Power,
  Gauge,
  ArrowRight,
  Copy,
  Edit,
  HandCoins,
  History,
  UserPlus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- API Client ---
const API_URL = '/api';

const api = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...((options.headers as any) || {}),
    };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.reload();
      }
      
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        // Not JSON - if it's a 403 HTML, it might be a proxy error. 
        // We only logout on 401 (Unauthorized) now to be safer.
        console.error("Non-JSON error response:", response.status, errorText.substring(0, 200));
      }
      
      const errorMessage = errorData.error || `API Error (${response.status}): ${errorText.substring(0, 100)}`;
      
      if (response.status === 403 && (
        errorData.code === 'SUBSCRIPTION_EXPIRED' || 
        errorData.code === 'STATION_INACTIVE' ||
        errorData.code === 'STATION_NOT_FOUND' ||
        errorData.code === 'NO_STATION'
      )) {
        const error = new Error(errorMessage);
        (error as any).code = errorData.code;
        throw error;
      }
      
      throw new Error(errorMessage);
    }
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  },
  login: (credentials: any) => api.fetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getStats: (date: string) => api.fetch(`/dashboard/stats?date=${date}`),
  getProducts: () => api.fetch('/products'),
  getPumps: () => api.fetch('/pumps'),
  getReadings: (date: string) => api.fetch(`/meter-readings?date=${date}`),
  saveReading: (data: any) => api.fetch('/meter-readings', { method: 'POST', body: JSON.stringify(data) }),
  saveExpense: (data: any) => api.fetch('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  getExpenses: (date: string) => api.fetch(`/expenses?date=${date}`),
  updateProduct: (id: number, data: any) => api.fetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getReports: (type: string, date: string) => api.fetch(`/reports?type=${type}&date=${date}`),
  getInventory: (date: string) => api.fetch(`/inventory-transactions?date=${date}`),
  saveInventory: (data: any) => api.fetch('/inventory-transactions', { method: 'POST', body: JSON.stringify(data) }),
  deleteInventory: (id: number) => api.fetch(`/inventory-transactions/${id}`, { method: 'DELETE' }),
  recalculateStats: (date: string) => api.fetch('/dashboard/recalculate', { method: 'POST', body: JSON.stringify({ date }) }),
  getWithdrawals: (date: string) => api.fetch(`/withdrawals?date=${date}`),
  saveWithdrawal: (data: any) => api.fetch('/withdrawals', { method: 'POST', body: JSON.stringify(data) }),
  deleteWithdrawal: (id: number) => api.fetch(`/withdrawals/${id}`, { method: 'DELETE' }),
  getCommercialSales: (date: string) => api.fetch(`/commercial-sales?date=${date}`),
  saveCommercialSale: (data: any) => api.fetch('/commercial-sales', { method: 'POST', body: JSON.stringify(data) }),
  deleteCommercialSale: (id: number) => api.fetch(`/commercial-sales/${id}`, { method: 'DELETE' }),
  getPublicStationInfo: (slug: string) => api.fetch(`/public/stations/${slug}`),
  updateStation: (id: number, data: any) => api.fetch(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getVapidPublicKey: () => api.fetch('/notifications/vapid-public-key'),
  subscribeNotifications: (subscription: any) => api.fetch('/notifications/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }),
  unsubscribeNotifications: (subscription: any) => api.fetch('/notifications/unsubscribe', { method: 'POST', body: JSON.stringify({ subscription }) }),
  updateNotificationSettings: (data: any) => api.fetch('/station-info/notifications', { method: 'PUT', body: JSON.stringify(data) }),
  updateStationNotificationSettings: (id: number, data: any) => api.fetch(`/stations/${id}/notification-settings`, { method: 'PUT', body: JSON.stringify(data) }),
  getLoans: () => api.fetch('/loans'),
  saveLoan: (data: any) => api.fetch('/loans', { method: 'POST', body: JSON.stringify(data) }),
  deleteLoan: (id: number) => api.fetch(`/loans/${id}`, { method: 'DELETE' }),
  repayLoan: (id: number, data: any) => api.fetch(`/loans/${id}/repay`, { method: 'POST', body: JSON.stringify(data) }),
  getLoanHistory: (id: number) => api.fetch(`/loans/${id}/history`),
  getStationAccounts: () => api.fetch('/station/accounts'),
  saveStationAccount: (data: any) => api.fetch('/station/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateStationAccount: (id: number, data: any) => api.fetch(`/station/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStationAccount: (id: number) => api.fetch(`/station/accounts/${id}`, { method: 'DELETE' }),
};

// --- Components ---

const Card = ({ children, className, title }: { children: React.ReactNode, className?: string, title?: string }) => (
  <div className={cn("bg-white rounded-2xl p-6 shadow-sm border border-slate-100", className)}>
    {title && <h3 className="text-lg font-bold mb-4 text-slate-800">{title}</h3>}
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <Card className="flex items-center gap-4">
    <div className={cn("p-3 rounded-xl", color)}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      {trend && <p className="text-xs text-emerald-500 font-medium mt-1">{trend}</p>}
    </div>
  </Card>
);

const SidebarItem = ({ icon: Icon, label, active, onClick, disabled }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 font-bold text-sm",
      active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-slate-50",
      disabled && "opacity-50 cursor-not-allowed grayscale"
    )}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'dashboard');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentStation, setCurrentStation] = useState<any>(null);
  const [isCustomLogin, setIsCustomLogin] = useState(false);
  const [slugError, setSlugError] = useState(false);
  const [editingStation, setEditingStation] = useState<any>(null);
  const [previewLogo, setPreviewLogo] = useState<string>('');
  const [newStationLogo, setNewStationLogo] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [pumps, setPumps] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [reportsData, setReportsData] = useState<any>(null);
  const [reportType, setReportType] = useState('daily');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dailyExpenses, setDailyExpenses] = useState<any[]>([]);
  const [expenseDateFilter, setExpenseDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [inventoryDateFilter, setInventoryDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [readingsDate, setReadingsDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [stationData, setStationData] = useState<any>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [withdrawalsData, setWithdrawalsData] = useState<any[]>([]);
  const [commercialSalesData, setCommercialSalesData] = useState<any[]>([]);
  const [withdrawalsCommercialDate, setWithdrawalsCommercialDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [loans, setLoans] = useState<any[]>([]);
  const [showRepayModal, setShowRepayModal] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<any>(null);
  const [loanHistory, setLoanHistory] = useState<any[]>([]);
  const [stationAccounts, setStationAccounts] = useState<any[]>([]);
  const [showAccountModal, setShowAccountModal] = useState<any>(null);

  useEffect(() => {
    if (user) {
      const allowedTabs: Record<string, string[]> = {
        'Writer': ['readings', 'inventory'],
        'Accountant': ['withdrawals_commercial', 'expenses', 'loans'],
        'Owner': ['dashboard', 'readings', 'inventory', 'withdrawals_commercial', 'expenses', 'loans', 'reports', 'setup', 'settings', 'subscription', 'support'],
        'Employee': ['dashboard', 'readings', 'inventory', 'withdrawals_commercial', 'expenses', 'loans', 'setup', 'reports', 'support'],
        'SuperAdmin': ['admin', 'support']
      };

      const roleAllowed = allowedTabs[user.role] || [];
      if (roleAllowed.length > 0 && !roleAllowed.includes(activeTab)) {
        setActiveTab(roleAllowed[0]);
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    setSelectedProductId(null);
    if (activeTab === 'settings' && user?.role === 'Owner') {
      loadStationData();
      loadStationAccounts();
    }
  }, [activeTab, user]);

  useEffect(() => {
    const init = async () => {
      const path = window.location.pathname.substring(1);
      if (path && path !== 'admin') {
        try {
          const station = await api.getPublicStationInfo(path);
          if (station) {
            setCurrentStation(station);
            setIsCustomLogin(true);
          }
        } catch (err) {
          setSlugError(true);
        }
      } else if (path === 'admin') {
        setIsCustomLogin(false);
      }

      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (token && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        if (parsedUser.role === 'SuperAdmin') {
          setActiveTab('admin');
        }

        // Handle Stripe Redirects
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
          alert('تم تفعيل الاشتراك بنجاح! شكراً لثقتكم.');
          window.history.replaceState({}, document.title, "/");
        } else if (params.get('success') === 'false') {
          alert('تم إلغاء عملية الدفع.');
          window.history.replaceState({}, document.title, "/");
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'SuperAdmin') {
        loadStations();
        if (!['admin', 'support'].includes(activeTab)) {
          setActiveTab('admin');
        }
      } else {
        // Only load dashboard data if not on subscription tab
        if (activeTab !== 'subscription') {
          loadDashboardData();
        }
        if (user.role === 'Owner') {
          loadStationData();
        }
      }
    }
  }, [user, date, activeTab]);

  useEffect(() => {
    if (user && user.role === 'Owner') {
      checkNotificationStatus();
    }
  }, [user]);

  const checkNotificationStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
      setNotificationPermission(Notification.permission);
    } catch (err) {
      console.error("Error checking notification status:", err);
    }
  };

  const subscribeToNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('متصفحك لا يدعم الإشعارات');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission !== 'granted') {
        alert('يجب السماح بالإشعارات لاستقبال التنبيهات');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const { publicKey } = await api.getVapidPublicKey();
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      await api.subscribeNotifications(subscription);
      setIsSubscribed(true);
      
      // Also enable notifications for the station if it's the owner
      if (user.role === 'Owner') {
        await api.updateNotificationSettings({ notifications_enabled: true });
        loadStationData();
      }
      
      alert('تم تفعيل الإشعارات بنجاح');
    } catch (err) {
      console.error("Subscription error:", err);
      alert('فشل تفعيل الإشعارات');
    }
  };

  const unsubscribeFromNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await api.unsubscribeNotifications(subscription);
      }
      setIsSubscribed(false);
      
      if (user.role === 'Owner') {
        await api.updateNotificationSettings({ notifications_enabled: false });
        loadStationData();
      }
      
      alert('تم إيقاف الإشعارات');
    } catch (err) {
      console.error("Unsubscription error:", err);
    }
  };

  const loadStations = async () => {
    try {
      const data = await api.fetch('/stations');
      setStations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogoUpload = (e: any, setLogo: (url: string) => void) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyStationLink = (slug: string) => {
    if (!slug) {
      alert('يرجى تعيين رابط للمحطة أولاً');
      return;
    }
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
    alert('تم نسخ الرابط بنجاح');
  };

  const loadStationData = async () => {
    try {
      const data = await api.fetch('/station-info');
      setStationData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStationAccounts = async () => {
    try {
      const data = await api.getStationAccounts();
      setStationAccounts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDashboardData = async () => {
    if (activeTab === 'subscription') return;
    setSubscriptionError(null);
    try {
      const [statsData, productsData, pumpsData] = await Promise.all([
        api.getStats(date),
        api.getProducts(),
        api.getPumps()
      ]);
      setStats(statsData);
      setProducts(productsData);
      setPumps(pumpsData);
      
      if (user && user.role !== 'Employee') {
        const loansData = await api.getLoans();
        setLoans(loansData);
      }
      
      if (activeTab === 'reports') {
        loadReports();
      }
    } catch (err: any) {
      console.error("Dashboard load error:", err);
      if (err.code === 'SUBSCRIPTION_EXPIRED') {
        setSubscriptionError('عذراً، انتهى اشتراك هذه المحطة. يرجى التواصل مع الإدارة للتجديد.');
        if (user?.role === 'Owner') setActiveTab('subscription');
      } else if (err.code === 'STATION_INACTIVE') {
        setSubscriptionError('هذه المحطة غير مفعلة حالياً. يرجى التواصل مع الإدارة.');
        if (user?.role === 'Owner') setActiveTab('subscription');
      } else if (err.code === 'STATION_NOT_FOUND' || err.code === 'NO_STATION') {
        setSubscriptionError('عذراً، هناك مشكلة في بيانات المحطة المرتبطة بحسابك. يرجى التواصل مع الدعم الفني.');
      }
    }
  };

  const loadReports = async () => {
    try {
      let dateStr = reportDate;
      if (reportType === 'monthly') dateStr = reportDate.substring(0, 7);
      if (reportType === 'yearly') dateStr = reportDate.substring(0, 4);
      
      const data = await api.getReports(reportType, dateStr);
      setReportsData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDailyExpenses = async () => {
    try {
      const data = await api.getExpenses(expenseDateFilter);
      setDailyExpenses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadInventory = async () => {
    try {
      const data = await api.getInventory(inventoryDateFilter);
      setInventoryData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadWithdrawalsCommercial = async () => {
    try {
      const [wData, cData] = await Promise.all([
        api.getWithdrawals(withdrawalsCommercialDate),
        api.getCommercialSales(withdrawalsCommercialDate)
      ]);
      setWithdrawalsData(wData);
      setCommercialSalesData(cData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'reports') {
      loadReports();
    }
    if (user && activeTab === 'expenses') {
      loadDailyExpenses();
    }
    if (user && activeTab === 'inventory') {
      loadInventory();
    }
    if (user && activeTab === 'withdrawals_commercial') {
      loadWithdrawalsCommercial();
    }
  }, [activeTab, reportType, reportDate, expenseDateFilter, inventoryDateFilter, withdrawalsCommercialDate]);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const res = await api.login(Object.fromEntries(formData));
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
    } catch (err: any) {
      alert(err.message || 'خطأ في تسجيل الدخول');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  if (slugError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-12">
          <div className="bg-rose-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="text-rose-600 w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-4">المحطة غير موجودة</h1>
          <p className="text-slate-500 font-bold mb-8">عذراً، الرابط الذي تحاول الوصول إليه غير صحيح أو تم حذفه.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            العودة للرئيسية
          </button>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100"
        >
          <div className="text-center mb-8">
            {isCustomLogin && currentStation?.logo_url ? (
              <img 
                src={currentStation.logo_url} 
                alt={currentStation.name} 
                className="max-h-32 mx-auto mb-6 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                <Fuel className="text-white w-8 h-8" />
              </div>
            )}
            <h1 className="text-2xl font-black text-slate-800">
              {isCustomLogin ? currentStation?.name : 'نظام محطتي'}
            </h1>
            <p className="text-slate-500 mt-2 font-medium">إدارة محطات الوقود الذكية</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم</label>
              <input 
                name="username" 
                type="text" 
                required 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-right"
                placeholder="أدخل اسم المستخدم"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
              <input 
                name="password" 
                type="password" 
                required 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-right"
                placeholder="••••••••"
              />
            </div>
            <button className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mt-4">
              دخول للنظام
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 w-64 bg-white border-l border-slate-100 p-6 flex flex-col z-50 transition-transform duration-300 lg:relative lg:translate-x-0 no-print",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between mb-10 px-2">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Fuel className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-black text-slate-800">{user?.station_name || 'محطتي'}</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="space-y-2 flex-1 overflow-y-auto">
          {user.role !== 'SuperAdmin' && (
            <>
              {(user.role === 'Owner' || user.role === 'Employee') && (
                <SidebarItem 
                  icon={LayoutDashboard} 
                  label="الصفحة الرئيسية " 
                  active={activeTab === 'dashboard'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('dashboard'); setIsSidebarOpen(false); } }} 
                />
              )}
              {(user.role === 'Owner' || user.role === 'Employee' || user.role === 'Writer') && (
                <SidebarItem 
                  icon={Gauge} 
                  label="إدخال المبيعات" 
                  active={activeTab === 'readings'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('readings'); setIsSidebarOpen(false); } }} 
                />
              )}
              {(user.role === 'Owner' || user.role === 'Employee' || user.role === 'Accountant') && (
                <SidebarItem 
                  icon={PlusCircle} 
                  label="السحب والتجاري" 
                  active={activeTab === 'withdrawals_commercial'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('withdrawals_commercial'); setIsSidebarOpen(false); } }} 
                />
              )}
              {(user.role === 'Owner' || user.role === 'Employee' || user.role === 'Accountant') && (
                <SidebarItem 
                  icon={Wallet} 
                  label="المصاريف" 
                  active={activeTab === 'expenses'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('expenses'); setIsSidebarOpen(false); } }} 
                />
              )}
              {(user.role === 'Owner' || user.role === 'Accountant') && (
                <SidebarItem 
                  icon={HandCoins} 
                  label="القروض" 
                  active={activeTab === 'loans'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('loans'); setIsSidebarOpen(false); } }} 
                />
              )}
              {(user.role === 'Owner' || user.role === 'Employee') && (
                <SidebarItem 
                  icon={Package} 
                  label="المنتجات والمضخات" 
                  active={activeTab === 'setup'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('setup'); setIsSidebarOpen(false); } }} 
                />
              )}
              {(user.role === 'Owner' || user.role === 'Employee' || user.role === 'Writer') && (
                <SidebarItem 
                  icon={TrendingUp} 
                  label="الواردات (الخزين)" 
                  active={activeTab === 'inventory'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('inventory'); setIsSidebarOpen(false); } }} 
                />
              )}
              {user.role === 'Owner' && (
                <SidebarItem 
                  icon={Settings} 
                  label="الإعدادات" 
                  active={activeTab === 'settings'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('settings'); setIsSidebarOpen(false); } }} 
                />
              )}
              {(user.role === 'Owner' || user.role === 'Employee') && (
                <SidebarItem 
                  icon={FileText} 
                  label="التقارير" 
                  active={activeTab === 'reports'} 
                  disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                  onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('reports'); setIsSidebarOpen(false); } }} 
                />
              )}
            </>
          )}
          {user.role === 'Owner' && (
            <SidebarItem 
              icon={CreditCard} 
              label="الاشتراك" 
              active={activeTab === 'subscription'} 
              onClick={() => { setActiveTab('subscription'); setIsSidebarOpen(false); }} 
            />
          )}
          {user.role === 'SuperAdmin' && (
            <SidebarItem 
              icon={Users} 
              label="إدارة المحطات" 
              active={activeTab === 'admin'} 
              onClick={() => { setActiveTab('admin'); setIsSidebarOpen(false); }} 
            />
          )}
          <SidebarItem 
            icon={Phone} 
            label="الدعم الفني" 
            active={activeTab === 'support'} 
            onClick={() => { setActiveTab('support'); setIsSidebarOpen(false); }} 
          />
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-50">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full p-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-all font-bold"
          >
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 no-print">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-xl lg:text-2xl font-black text-slate-800">
                  {activeTab === 'dashboard' && 'لوحة التحكم'}
                  {activeTab === 'readings' && 'إدخال عدادات اليوم'}
                  {activeTab === 'withdrawals_commercial' && 'السحب والتجاري'}
                  {activeTab === 'expenses' && 'إدارة المصاريف'}
                  {activeTab === 'loans' && 'إدارة القروض'}
                  {activeTab === 'setup' && 'المنتجات والمضخات'}
                  {activeTab === 'inventory' && 'إدارة الواردات والخزين'}
                  {activeTab === 'settings' && 'إعدادات المحطة'}
                  {activeTab === 'reports' && 'التقارير المالية'}
                  {activeTab === 'subscription' && 'الاشتراك'}
                  {activeTab === 'admin' && 'إدارة المحطات'}
                  {activeTab === 'support' && 'الدعم الفني'}
                </h2>
                <p className="text-slate-500 font-medium text-xs lg:text-sm mt-1">
                  {format(new Date(date), 'EEEE, d MMMM yyyy', { locale: ar })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
            {activeTab === 'dashboard' && (
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        </header>

        {subscriptionError && user?.role !== 'SuperAdmin' && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-rose-50 border border-rose-100 p-6 rounded-2xl flex items-center gap-4 text-rose-600"
          >
            <AlertCircle className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="font-black text-lg">تنبيه النظام</h3>
              <p className="font-medium">{subscriptionError}</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {subscriptionError && user?.role !== 'SuperAdmin' && activeTab !== 'subscription' && activeTab !== 'support' && (
            <motion.div 
              key="subscription-required"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 text-center space-y-6"
            >
              <div className="bg-rose-100 p-6 rounded-full text-rose-600 shadow-xl shadow-rose-100">
                <CreditCard className="w-16 h-16" />
              </div>
              <div className="max-w-md space-y-2">
                <h2 className="text-3xl font-black text-slate-800">الاشتراك مطلوب</h2>
                <p className="text-slate-500 font-bold text-lg leading-relaxed">
                  {user?.role === 'Owner' 
                    ? "يرجى تجديد اشتراكك لتتمكن من الوصول إلى كافة ميزات النظام." 
                    : "عذراً، اشتراك المحطة متوقف حالياً. يرجى مراجعة صاحب المحطة."}
                </p>
              </div>
              {user?.role === 'Owner' && (
                <button 
                  onClick={() => setActiveTab('subscription')}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  الذهاب لصفحة الاشتراك
                </button>
              )}
            </motion.div>
          )}

          {(!subscriptionError || user?.role === 'SuperAdmin' || activeTab === 'subscription' || activeTab === 'support') && (
            <>
              {activeTab === 'dashboard' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {!stats ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              ) : (
                <>
              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  title="إجمالي المبيعات" 
                  value={`${(() => {
                    if (!stats?.products) return "0";
                    let remainingWithdrawal = stats.withdrawals?.reduce((acc: any, w: any) => acc + (w.quantity || 0), 0) || 0;
                    const total = stats.products.reduce((acc: any, p: any) => {
                      let liters = parseFloat(p.total_liters || 0);
                      if (remainingWithdrawal > 0 && (p.name.includes('كاز') || p.name.includes('ديزل'))) {
                        const deduction = Math.min(liters, remainingWithdrawal);
                        liters -= deduction;
                        remainingWithdrawal -= deduction;
                      }
                      return acc + (liters * (p.sell_price || 0));
                    }, 0);
                    return total.toLocaleString();
                  })()} د.ع`}
                  icon={TrendingUp}
                  color="bg-indigo-500"
                />
                <StatCard 
                  title="صافي الربح" 
                  value={`${(() => {
                    if (!stats?.products) return "0";
                    let remainingWithdrawal = stats.withdrawals?.reduce((acc: any, w: any) => acc + (w.quantity || 0), 0) || 0;
                    const totalProfit = stats.products.reduce((acc: any, p: any) => {
                      let liters = parseFloat(p.total_liters || 0);
                      if (remainingWithdrawal > 0 && (p.name.includes('كاز') || p.name.includes('ديزل'))) {
                        const deduction = Math.min(liters, remainingWithdrawal);
                        liters -= deduction;
                        remainingWithdrawal -= deduction;
                      }
                      const profitPerLiter = (p.sell_price || 0) - (p.buy_price || 0);
                      return acc + (liters * profitPerLiter);
                    }, 0);
                    return (totalProfit - (stats.totalExpenses || 0)).toLocaleString();
                  })()} د.ع`}
                  icon={TrendingUp}
                  color="bg-emerald-500"
                />
                <StatCard 
                  title="إجمالي المصاريف" 
                  value={`${stats.totalExpenses.toLocaleString()} د.ع`}
                  icon={Wallet}
                  color="bg-rose-500"
                />
                <StatCard 
                  title="عدد المنتجات" 
                  value={stats.products.length}
                  icon={Package}
                  color="bg-amber-500"
                />
              </div>

              {/* Product Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.products.map((product: any) => (
                  <div key={product.name}>
                    <Card className="relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-black text-slate-800">{product.name}</h4>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">إحصائيات اليوم</p>
                        </div>
                        {product.stock_quantity < product.low_stock_threshold && (
                          <div className="bg-rose-100 text-rose-600 p-1.5 rounded-lg animate-pulse">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500 font-medium">المبيعات (لتر)</span>
                          <span className="text-sm font-bold text-slate-800">{product.total_liters || 0} لتر</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500 font-medium">المبيعات (دينار)</span>
                          <span className="text-sm font-bold text-slate-800">{(product.total_sales || 0).toLocaleString()} د.ع</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500 font-medium">الربح</span>
                          <span className="text-sm font-bold text-emerald-600">{(product.total_profit || 0).toLocaleString()} د.ع</span>
                        </div>
                        <div className="pt-4 border-t border-slate-50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-400 font-bold">المخزون الحالي</span>
                            <span className={cn("text-xs font-bold", product.stock_quantity < product.low_stock_threshold ? "text-rose-500" : "text-slate-600")}>
                              {product.stock_quantity.toLocaleString()} لتر
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full transition-all duration-500", product.stock_quantity < product.low_stock_threshold ? "bg-rose-500" : "bg-indigo-500")}
                              style={{ width: `${Math.min(100, (product.stock_quantity / 50000) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>


              {/* New Widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <Card title="ملخص التجاري">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                      <span className="text-slate-600 font-bold">إجمالي الكمية المباعة</span>
                      <span className="text-indigo-600 font-black text-lg">{(stats.commercialSummary?.totalLiters || 0).toLocaleString()} لتر</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-xl">
                      <span className="text-emerald-700 font-bold">إجمالي فرق السعر (الربح)</span>
                      <span className="text-emerald-600 font-black text-lg">{(stats.commercialSummary?.totalDiff || 0).toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </Card>

                <Card title="سجل السحوبات">
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {stats.withdrawals?.map((w: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0">
                        <div className="flex flex-col">
                          <span className="text-rose-600 font-bold">{(w.quantity || 0).toLocaleString()} لتر</span>
                          <span className="text-xs text-slate-400">{w.reason}</span>
                        </div>
                        <span className="text-xs text-slate-400">{format(new Date(w.withdrawal_date), 'HH:mm')}</span>
                      </div>
                    ))}
                    {(!stats.withdrawals || stats.withdrawals.length === 0) && (
                      <p className="text-center text-slate-400 py-4">لا توجد سحوبات مسجلة</p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-slate-600 font-bold">إجمالي السحوبات</span>
                    <span className="text-rose-600 font-black">{(stats.withdrawals?.reduce((acc: any, w: any) => acc + (w.quantity || 0), 0) || 0).toLocaleString()} لتر</span>
                  </div>
                </Card>
              </div>
              </>
              )}
            </motion.div>
          )}

          {activeTab === 'withdrawals_commercial' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="withdrawals_commercial"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Date Picker for this page */}
              <div className="flex justify-end">
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <input 
                    type="date" 
                    value={withdrawalsCommercialDate} 
                    onChange={(e) => setWithdrawalsCommercialDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl p-2 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Withdrawals Section */}
                <div className="space-y-6">
                  <Card title="تسجيل سحب (كاز السيارات)">
                    <form onSubmit={async (e: any) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      try {
                        await api.saveWithdrawal({
                          withdrawal_date: withdrawalsCommercialDate,
                          quantity: parseFloat(formData.get('quantity') as string),
                          reason: formData.get('reason') as string
                        });
                        alert('تم حفظ السحب بنجاح');
                        e.target.reset();
                        loadWithdrawalsCommercial();
                        loadDashboardData();
                      } catch (err) {
                        alert('خطأ في حفظ السحب');
                      }
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">الكمية (لتر)</label>
                        <input 
                          name="quantity"
                          type="number" 
                          step="0.01"
                          required
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">السبب</label>
                        <textarea 
                          name="reason"
                          required
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="اكتب سبب السحب هنا..."
                        />
                      </div>
                      <button className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                        حفظ السحب
                      </button>
                    </form>
                  </Card>

                  <Card title="سجل السحوبات">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 px-4 text-slate-400 font-bold text-sm">الكمية</th>
                            <th className="py-3 px-4 text-slate-400 font-bold text-sm">السبب</th>
                            <th className="py-3 px-4 text-slate-400 font-bold text-sm">الإجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {withdrawalsData.map((w) => (
                            <tr key={w.id} className="border-b border-slate-50 last:border-0">
                              <td className="py-3 px-4 font-bold text-slate-700">{w.quantity} لتر</td>
                              <td className="py-3 px-4 text-slate-500 text-sm">{w.reason}</td>
                              <td className="py-3 px-4">
                                <button 
                                  onClick={async () => {
                                    if (confirm('هل أنت متأكد من حذف هذا السحب؟')) {
                                      try {
                                        await api.deleteWithdrawal(w.id);
                                        loadWithdrawalsCommercial();
                                        loadDashboardData();
                                      } catch (err) {
                                        alert('خطأ في حذف السحب');
                                      }
                                    }
                                  }}
                                  className="text-rose-500 hover:text-rose-700 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {withdrawalsData.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">لا توجد سحوبات مسجلة لهذا التاريخ</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                {/* Commercial Sales Section */}
                <div className="space-y-6">
                  <Card title="تسجيل مبيعات تجاري">
                    <form onSubmit={async (e: any) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      try {
                        await api.saveCommercialSale({
                          sale_date: withdrawalsCommercialDate,
                          quantity: parseFloat(formData.get('quantity') as string),
                          commercial_price: parseFloat(formData.get('commercial_price') as string)
                        });
                        alert('تم حفظ المبيعات بنجاح');
                        e.target.reset();
                        loadWithdrawalsCommercial();
                        loadDashboardData();
                      } catch (err) {
                        alert('خطأ في حفظ المبيعات');
                      }
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">الكمية (لتر)</label>
                        <input 
                          name="quantity"
                          type="number" 
                          step="0.01"
                          required
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">سعر البيع التجاري (للتر الواحد)</label>
                        <input 
                          name="commercial_price"
                          type="number" 
                          required
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                      </div>
                      <button className="w-full bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                        حفظ المبيعات
                      </button>
                    </form>
                  </Card>

                  <Card title="سجل المبيعات التجاري">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 px-4 text-slate-400 font-bold text-sm">الكمية</th>
                            <th className="py-3 px-4 text-slate-400 font-bold text-sm">السعر</th>
                            <th className="py-3 px-4 text-slate-400 font-bold text-sm">الفرق</th>
                            <th className="py-3 px-4 text-slate-400 font-bold text-sm">الإجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commercialSalesData.map((s) => (
                            <tr key={s.id} className="border-b border-slate-50 last:border-0">
                              <td className="py-3 px-4 font-bold text-slate-700">{s.quantity} لتر</td>
                              <td className="py-3 px-4 text-slate-700 font-bold">{s.commercial_price.toLocaleString()} د.ع</td>
                              <td className="py-3 px-4 text-emerald-600 font-bold">{s.difference.toLocaleString()} د.ع</td>
                              <td className="py-3 px-4">
                                <button 
                                  onClick={async () => {
                                    if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
                                      try {
                                        await api.deleteCommercialSale(s.id);
                                        loadWithdrawalsCommercial();
                                        loadDashboardData();
                                      } catch (err) {
                                        alert('خطأ في حذف السجل');
                                      }
                                    }
                                  }}
                                  className="text-rose-500 hover:text-rose-700 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {commercialSalesData.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">لا توجد مبيعات تجارية مسجلة لهذا التاريخ</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'readings' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="readings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex justify-end">
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <input 
                    type="date" 
                    value={readingsDate} 
                    onChange={(e) => setReadingsDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl p-2 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {!selectedProductId ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map(product => (
                    <motion.div
                      key={product.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedProductId(product.id)}
                      className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-xl hover:border-indigo-200 transition-all group text-center"
                    >
                      <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Fuel className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800">{product.name}</h3>
                      <p className="text-slate-500 font-bold mt-2">اضغط لإدخال قراءات المضخات</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedProductId(null)}
                      className="bg-white p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold"
                    >
                      <ArrowRight className="w-5 h-5" />
                      رجوع للمنتجات
                    </button>
                    <h2 className="text-2xl font-black text-slate-800">
                      مضخات {products.find(p => p.id === selectedProductId)?.name}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pumps.filter(p => p.product_id === selectedProductId).map(pump => (
                      <div key={pump.id}>
                        <Card title={pump.name}>
                          <form onSubmit={async (e: any) => {
                          e.preventDefault();
                          const formData = new FormData(e.target);
                          try {
                            await api.saveReading({
                              pump_id: pump.id,
                              reading_date: readingsDate,
                              opening_meter_1: parseFloat(formData.get('opening_1') as string),
                              closing_meter_1: parseFloat(formData.get('closing_1') as string),
                              opening_meter_2: parseFloat(formData.get('opening_2') as string),
                              closing_meter_2: parseFloat(formData.get('closing_2') as string),
                            });
                            alert('تم حفظ القراءات بنجاح');
                            loadDashboardData();
                          } catch (err) {
                            alert('خطأ في حفظ القراءات');
                          }
                        }} className="space-y-4">
                          <div className="space-y-2 border-b border-slate-200 pb-3">
                            <p className="text-[10px] font-black text-indigo-600 uppercase">العداد الأول (A)</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">افتتاحي</label>
                                <input 
                                  name="opening_1" 
                                  type="number" 
                                  step="0.01"
                                  defaultValue={pump.last_meter_reading_1}
                                  required 
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">ختامي</label>
                                <input 
                                  name="closing_1" 
                                  type="number" 
                                  step="0.01"
                                  required 
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-indigo-600 uppercase">العداد الثاني (B)</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">افتتاحي</label>
                                <input 
                                  name="opening_2" 
                                  type="number" 
                                  step="0.01"
                                  defaultValue={pump.last_meter_reading_2}
                                  required 
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">ختامي</label>
                                <input 
                                  name="closing_2" 
                                  type="number" 
                                  step="0.01"
                                  required 
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                          <button className="w-full bg-indigo-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all">
                            حفظ القراءات
                          </button>
                        </form>
                      </Card>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'expenses' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="expenses"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className="flex justify-end">
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <input 
                    type="date" 
                    value={expenseDateFilter} 
                    onChange={(e) => setExpenseDateFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl p-2 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <Card title="تسجيل مصروف جديد">
                <form onSubmit={async (e: any) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  try {
                    await api.saveExpense({
                      expense_date: expenseDateFilter,
                      category: formData.get('category'),
                      amount: parseFloat(formData.get('amount') as string),
                      notes: formData.get('notes'),
                    });
                    alert('تم حفظ المصروف');
                    loadDashboardData();
                    e.target.reset();
                  } catch (err) {
                    alert('خطأ في الحفظ');
                  }
                }} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">الفئة</label>
                      <select name="category" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="رواتب">رواتب</option>
                        <option value="صيانة">صيانة</option>
                        <option value="كهرباء">كهرباء</option>
                        <option value="نقل">نقل</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">المبلغ</label>
                      <input name="amount" type="number" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ملاحظات</label>
                    <textarea name="notes" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24"></textarea>
                  </div>
                  <button className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    حفظ المصروف
                  </button>
                </form>
              </Card>

              <Card title="عرض المصاريف المدخلة" className="mt-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">اختر التاريخ</label>
                    <input 
                      type="date" 
                      value={expenseDateFilter}
                      onChange={(e) => setExpenseDateFilter(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={loadDailyExpenses}
                      className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all"
                    >
                      عرض المصاريف
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-bold text-slate-500 text-sm">الفئة</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">المبلغ</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {dailyExpenses.map((exp: any) => (
                        <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 font-bold text-slate-800">{exp.category}</td>
                          <td className="py-4 text-rose-600 font-bold">{exp.amount.toLocaleString()} د.ع</td>
                          <td className="py-4 text-slate-500 text-sm">{exp.notes || '---'}</td>
                        </tr>
                      ))}
                      {dailyExpenses.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                            لا توجد مصاريف مسجلة لهذا التاريخ
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {dailyExpenses.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50">
                          <td className="py-4 px-2 font-black text-slate-800">الإجمالي</td>
                          <td className="py-4 px-2 font-black text-rose-600">
                            {dailyExpenses.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()} د.ع
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'loans' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="loans"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <Card title="إضافة قرض جديد">
                <form onSubmit={async (e: any) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  try {
                    await api.saveLoan({
                      employee_name: formData.get('employee_name'),
                      amount: parseFloat(formData.get('amount') as string),
                      loan_date: formData.get('loan_date'),
                    });
                    alert('تم إضافة القرض بنجاح');
                    loadDashboardData();
                    e.target.reset();
                  } catch (err) {
                    alert('خطأ في إضافة القرض');
                  }
                }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">اسم الموظف</label>
                      <input name="employee_name" type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">مبلغ القرض</label>
                      <input name="amount" type="number" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">تاريخ القرض</label>
                      <input name="loan_date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <button className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    إضافة القرض
                  </button>
                </form>
              </Card>

              <Card title="جدول القروض">
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-bold text-slate-500 text-sm">اسم الموظف</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">المبلغ الأصلي</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">إجمالي المسدد</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">المبلغ المتبقي</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">التاريخ</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loans.map((loan: any) => {
                        const remaining = loan.amount - loan.total_paid;
                        const isFullyPaid = remaining <= 0;
                        return (
                          <tr key={loan.id} className={cn("hover:bg-slate-50 transition-colors", isFullyPaid && "bg-emerald-50/50")}>
                            <td className="py-4 font-bold text-slate-800">
                              {loan.employee_name}
                              {isFullyPaid && <span className="mr-2 text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">مسدد بالكامل</span>}
                            </td>
                            <td className="py-4 font-bold text-slate-600">{loan.amount.toLocaleString()} د.ع</td>
                            <td className="py-4 font-bold text-emerald-600">{loan.total_paid.toLocaleString()} د.ع</td>
                            <td className="py-4 font-bold text-rose-600">{remaining.toLocaleString()} د.ع</td>
                            <td className="py-4 text-slate-500 text-sm">{format(new Date(loan.loan_date), 'yyyy-MM-dd')}</td>
                            <td className="py-4">
                              <div className="flex items-center justify-center gap-2">
                                {!isFullyPaid && (
                                  <button 
                                    onClick={() => setShowRepayModal(loan)}
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="تسديد"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                  </button>
                                )}
                                <button 
                                  onClick={async () => {
                                    try {
                                      const history = await api.getLoanHistory(loan.id);
                                      setLoanHistory(history);
                                      setShowHistoryModal(loan);
                                    } catch (err) {
                                      alert('خطأ في جلب السجل');
                                    }
                                  }}
                                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                  title="سجل التسديدات"
                                >
                                  <History className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (confirm('هل أنت متأكد من حذف هذا القرض؟')) {
                                      try {
                                        await api.deleteLoan(loan.id);
                                        loadDashboardData();
                                      } catch (err) {
                                        alert('خطأ في الحذف');
                                      }
                                    }
                                  }}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="حذف"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {loans.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                            لا توجد قروض مسجلة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'setup' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="إضافة منتج جديد">
                  <form onSubmit={async (e: any) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    try {
                      await api.fetch('/products', { 
                        method: 'POST', 
                        body: JSON.stringify({
                          name: formData.get('name'),
                          buy_price: parseFloat(formData.get('buy_price') as string),
                          sell_price: parseFloat(formData.get('sell_price') as string),
                          low_stock_threshold: parseFloat(formData.get('threshold') as string),
                        }) 
                      });
                      alert('تمت إضافة المنتج');
                      loadDashboardData();
                      e.target.reset();
                    } catch (err) {
                      alert('خطأ في الإضافة');
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">اسم المنتج</label>
                      <input name="name" type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">سعر الشراء</label>
                        <input name="buy_price" type="number" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">سعر البيع</label>
                        <input name="sell_price" type="number" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">حد تنبيه المخزون</label>
                      <input name="threshold" type="number" defaultValue="1000" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all">
                      إضافة المنتج
                    </button>
                  </form>
                </Card>

                <Card title="إضافة مضخة جديدة">
                  <form onSubmit={async (e: any) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    try {
                      await api.fetch('/pumps', { 
                        method: 'POST', 
                        body: JSON.stringify({
                          product_id: parseInt(formData.get('product_id') as string),
                          name: formData.get('name'),
                        }) 
                      });
                      alert('تمت إضافة المضخة');
                      loadDashboardData();
                      e.target.reset();
                    } catch (err) {
                      alert('خطأ في الإضافة');
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">المنتج المرتبط</label>
                      <select name="product_id" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">اسم/رقم المضخة</label>
                      <input name="name" type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="مثال: مضخة 1" />
                    </div>
                    <button className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all">
                      إضافة المضخة
                    </button>
                  </form>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <Card title="إدارة المنتجات وتعديل الأسعار">
                <div className="flex justify-end mb-4">
                  <button 
                    onClick={async () => {
                      if (window.confirm('هل تريد تحديث جميع مبيعات وأرباح اليوم بناءً على الأسعار الجديدة؟')) {
                        try {
                          await api.recalculateStats(date);
                          await loadDashboardData();
                          alert('تم تحديث البيانات بنجاح');
                        } catch (err) {
                          alert('خطأ في التحديث');
                        }
                      }
                    }}
                    className="bg-amber-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-amber-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-100"
                  >
                    <RefreshCw className="w-4 h-4" />
                    تحديث المبيعات والأرباح
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-bold text-slate-500 text-sm">المنتج</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">سعر الشراء</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">سعر البيع</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">المخزون الحالي</th>
                        <th className="pb-4 font-bold text-slate-500 text-sm">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {products.map((product) => (
                        <tr key={product.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="py-4 font-bold text-slate-800">{product.name}</td>
                          <td className="py-4">
                            <input 
                              type="number" 
                              defaultValue={product.buy_price}
                              onBlur={async (e) => {
                                const newVal = parseFloat(e.target.value);
                                if (newVal !== product.buy_price) {
                                  try {
                                    await api.updateProduct(product.id, { ...product, buy_price: newVal });
                                    loadDashboardData();
                                  } catch (err) { alert('خطأ في التحديث'); }
                                }
                              }}
                              className="w-24 p-1 border border-transparent group-hover:border-slate-200 rounded bg-transparent focus:bg-white outline-none text-sm"
                            />
                          </td>
                          <td className="py-4">
                            <input 
                              type="number" 
                              defaultValue={product.sell_price}
                              onBlur={async (e) => {
                                const newVal = parseFloat(e.target.value);
                                if (newVal !== product.sell_price) {
                                  try {
                                    await api.updateProduct(product.id, { ...product, sell_price: newVal });
                                    loadDashboardData();
                                  } catch (err) { alert('خطأ في التحديث'); }
                                }
                              }}
                              className="w-24 p-1 border border-transparent group-hover:border-slate-200 rounded bg-transparent focus:bg-white outline-none text-sm font-bold text-indigo-600"
                            />
                          </td>
                          <td className="py-4 text-slate-500 text-sm font-mono">{product.stock_quantity.toLocaleString()} لتر</td>
                          <td className="py-4">
                            <span className="text-[10px] text-slate-400 italic">تعديل تلقائي عند الخروج</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {user.role === 'Owner' && (
                <Card title="إشعارات المتصفح">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-sm mb-1">استقبل تنبيهات فورية عند إضافة مصروفات أو سحوبات</p>
                      <p className="text-[10px] text-slate-400">تصل الإشعارات حتى لو كان التطبيق مغلقاً</p>
                    </div>
                    <button 
                      onClick={isSubscribed ? unsubscribeFromNotifications : subscribeToNotifications}
                      className={cn(
                        "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
                        isSubscribed 
                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100" 
                          : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                      )}
                    >
                      <Bell className={cn("w-4 h-4", isSubscribed && "fill-current")} />
                      {isSubscribed ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات'}
                    </button>
                  </div>
                  {notificationPermission === 'denied' && (
                    <div className="mt-4 p-3 bg-rose-50 rounded-xl flex items-center gap-3 text-rose-600 text-xs">
                      <AlertCircle className="w-4 h-4" />
                      <span>لقد قمت بحظر الإشعارات من إعدادات المتصفح. يرجى السماح بها يدوياً لاستقبال التنبيهات.</span>
                    </div>
                  )}
                </Card>
              )}

              {user.role === 'Owner' && stationData?.roles_enabled && (
                <Card title="إدارة الحسابات (الكاتب والمحاسب)">
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <button 
                      onClick={() => setShowAccountModal({ role: 'Writer' })}
                      className="flex-1 bg-indigo-50 text-indigo-600 p-4 rounded-2xl font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 border border-indigo-100"
                    >
                      <UserPlus className="w-5 h-5" />
                      إنشاء حساب كاتب
                    </button>
                    <button 
                      onClick={() => setShowAccountModal({ role: 'Accountant' })}
                      className="flex-1 bg-emerald-50 text-emerald-600 p-4 rounded-2xl font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 border border-emerald-100"
                    >
                      <UserPlus className="w-5 h-5" />
                      إنشاء حساب محاسب
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-4 font-bold text-slate-500 text-sm">الاسم الكامل</th>
                          <th className="pb-4 font-bold text-slate-500 text-sm">اسم المستخدم</th>
                          <th className="pb-4 font-bold text-slate-500 text-sm">الدور</th>
                          <th className="pb-4 font-bold text-slate-500 text-sm">آخر دخول</th>
                          <th className="pb-4 font-bold text-slate-500 text-sm text-left">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {stationAccounts.map((account) => (
                          <tr key={account.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-bold text-slate-800">{account.full_name}</td>
                            <td className="py-4 text-slate-600 font-mono">{account.username}</td>
                            <td className="py-4">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold",
                                account.role === 'Writer' ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                              )}>
                                {account.role === 'Writer' ? 'كاتب' : 'محاسب'}
                              </span>
                            </td>
                            <td className="py-4 text-slate-400 text-xs">
                              {account.last_login ? format(new Date(account.last_login), 'yyyy-MM-dd HH:mm', { locale: ar }) : 'لم يدخل بعد'}
                            </td>
                            <td className="py-4 text-left">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => setShowAccountModal(account)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 transition-all"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
                                      try {
                                        await api.deleteStationAccount(account.id);
                                        loadStationAccounts();
                                      } catch (err) { alert('خطأ في الحذف'); }
                                    }
                                  }}
                                  className="p-2 text-slate-400 hover:text-rose-600 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {stationAccounts.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 text-sm italic">
                              لا توجد حسابات مضافة حالياً
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'reports' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <Card className="no-print">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                    <button 
                      onClick={() => setReportType('daily')}
                      className={cn("flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all", reportType === 'daily' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >يومي</button>
                    <button 
                      onClick={() => setReportType('monthly')}
                      className={cn("flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all", reportType === 'monthly' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >شهري</button>
                    <button 
                      onClick={() => setReportType('yearly')}
                      className={cn("flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all", reportType === 'yearly' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >سنوي</button>
                  </div>
                  
                  <div className="flex-1 w-full">
                    <input 
                      type={reportType === 'daily' ? 'date' : reportType === 'monthly' ? 'month' : 'number'}
                      value={reportType === 'yearly' ? reportDate.substring(0, 4) : reportType === 'monthly' ? reportDate.substring(0, 7) : reportDate}
                      onChange={(e) => {
                        if (reportType === 'yearly') setReportDate(`${e.target.value}-01-01`);
                        else if (reportType === 'monthly') setReportDate(`${e.target.value}-01`);
                        else setReportDate(e.target.value);
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      placeholder={reportType === 'yearly' ? 'أدخل السنة (مثال: 2024)' : ''}
                    />
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={loadReports}
                      className="flex-1 sm:flex-none bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all"
                    >تحديث</button>
                    
                    <button 
                      onClick={() => {
                        setTimeout(() => {
                          window.print();
                        }, 500);
                      }}
                      className="flex-1 sm:flex-none bg-slate-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة
                    </button>
                  </div>
                </div>
              </Card>

              {reportsData && (
                <div className="print:block">
                  <div className="hidden print:block mb-8 text-center border-b pb-4">
                    <h1 className="text-2xl font-black">تقرير مبيعات محطة {user.station_name}</h1>
                    <p className="text-slate-500 font-bold mt-2">
                      {reportType === 'daily' && `تقرير يوم: ${reportDate}`}
                      {reportType === 'monthly' && `تقرير شهر: ${reportDate.substring(0, 7)}`}
                      {reportType === 'yearly' && `تقرير سنة: ${reportDate.substring(0, 4)}`}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                      title="إجمالي المبيعات" 
                      value={`${(() => {
                        if (!reportsData?.products) return "0";
                        let remainingWithdrawal = reportsData.totalWithdrawalsLiters || 0;
                        const total = reportsData.products.reduce((acc: any, p: any) => {
                          let liters = parseFloat(p.total_liters || 0);
                          if (remainingWithdrawal > 0 && (p.name.includes('كاز') || p.name.includes('ديزل'))) {
                            const deduction = Math.min(liters, remainingWithdrawal);
                            liters -= deduction;
                            remainingWithdrawal -= deduction;
                          }
                          return acc + (liters * (p.sell_price || 0));
                        }, 0);
                        return total.toLocaleString();
                      })()} د.ع`}
                      icon={TrendingUp}
                      color="bg-indigo-500"
                    />
                    <StatCard 
                      title="إجمالي الربح" 
                      value={`${(() => {
                        if (!reportsData?.products) return "0";
                        let remainingWithdrawal = reportsData.totalWithdrawalsLiters || 0;
                        const totalProfit = reportsData.products.reduce((acc: any, p: any) => {
                          let liters = parseFloat(p.total_liters || 0);
                          if (remainingWithdrawal > 0 && (p.name.includes('كاز') || p.name.includes('ديزل'))) {
                            const deduction = Math.min(liters, remainingWithdrawal);
                            liters -= deduction;
                            remainingWithdrawal -= deduction;
                          }
                          const profitPerLiter = (p.sell_price || 0) - (p.buy_price || 0);
                          return acc + (liters * profitPerLiter);
                        }, 0);
                        return totalProfit.toLocaleString();
                      })()} د.ع`}
                      icon={TrendingUp}
                      color="bg-emerald-500"
                    />
                    <StatCard 
                      title="إجمالي المصاريف" 
                      value={`${reportsData.totalExpenses.toLocaleString()} د.ع`}
                      icon={Wallet}
                      color="bg-rose-500"
                    />
                    <StatCard 
                      title="صافي الدخل" 
                      value={`${(reportsData.products.reduce((acc: any, p: any) => {
                        const withdrawalQty = p.name.includes('كاز') || p.name.includes('ديزل') 
                          ? (reportsData.totalWithdrawalsLiters || 0)
                          : 0;
                        const effectiveLiters = Math.max(0, (p.total_liters || 0) - withdrawalQty);
                        const profitPerLiter = (p.sell_price || 0) - (p.buy_price || 0);
                        const effectiveProfit = effectiveLiters * profitPerLiter;
                        return acc + effectiveProfit;
                      }, 0) - reportsData.totalExpenses).toLocaleString()} د.ع`}
                      icon={TrendingUp}
                      color="bg-amber-500"
                    />
                  </div>

                  <Card title="تفاصيل المنتجات">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 font-bold text-slate-500 text-sm">المنتج</th>
                            <th className="pb-4 font-bold text-slate-500 text-sm">الكمية المباعة (لتر)</th>
                            <th className="pb-4 font-bold text-slate-500 text-sm">إجمالي المبيعات</th>
                            <th className="pb-4 font-bold text-slate-500 text-sm">إجمالي الربح</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {reportsData.products.map((product: any) => (
                            <tr key={product.name} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 font-bold text-slate-800">{product.name}</td>
                              <td className="py-4 text-slate-600 font-mono">{(product.total_liters || 0).toLocaleString()} لتر</td>
                              <td className="py-4 text-slate-600 font-bold">{(product.total_sales || 0).toLocaleString()} د.ع</td>
                              <td className="py-4 text-emerald-600 font-bold">{(product.total_profit || 0).toLocaleString()} د.ع</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'inventory' && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <InventoryView 
                inventory={inventoryData} 
                products={products} 
                onSave={async (data: any) => {
                  await api.saveInventory(data);
                  loadInventory();
                  loadDashboardData();
                }}
                onDelete={async (id: number) => {
                  if (window.confirm('هل أنت متأكد من حذف هذا الوارد؟')) {
                    await api.deleteInventory(id);
                    loadInventory();
                    loadDashboardData();
                  }
                }}
                dateFilter={inventoryDateFilter}
                onDateChange={setInventoryDateFilter}
              />
            </motion.div>
          )}
          {activeTab === 'subscription' && (
            <motion.div 
              key="subscription"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SubscriptionView 
                station={stationData}
                onRefresh={async () => {
                  await loadStationData();
                  await loadDashboardData();
                }}
                onSubscribe={async (plan: string) => {
                  try {
                    const { url } = await api.fetch('/create-checkout-session', {
                      method: 'POST',
                      body: JSON.stringify({ plan })
                    });
                    window.location.href = url;
                  } catch (err) {
                    alert('خطأ في إنشاء جلسة الدفع');
                  }
                }}
                onConfirmManual={async (plan: string) => {
                  try {
                    await api.fetch('/request-manual-activation', {
                      method: 'POST',
                      body: JSON.stringify({ plan })
                    });
                    alert('تم إرسال طلب التفعيل بنجاح. سيتم مراجعة التحويل وتفعيل حسابك قريباً.');
                    loadStationData();
                  } catch (err) {
                    alert('خطأ في إرسال الطلب');
                  }
                }}
              />
            </motion.div>
          )}
          {activeTab === 'admin' && user.role === 'SuperAdmin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Notifications for SuperAdmin */}
              {stations.some(s => s.subscription_status === 'Pending') && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                  <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-amber-800">تنبيه طلبات التفعيل</h4>
                    <p className="text-amber-600 text-sm font-bold">يوجد {stations.filter(s => s.subscription_status === 'Pending').length} محطة تنتظر تفعيل الاشتراك يدوياً.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <Card title="إضافة محطة جديدة">
                    <form onSubmit={async (e: any) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      const data = Object.fromEntries(formData);
                      try {
                        await api.fetch('/stations', { 
                          method: 'POST', 
                          body: JSON.stringify({
                            ...data,
                            logo_url: newStationLogo
                          }) 
                        });
                        alert('تم إنشاء المحطة والمالك بنجاح');
                        e.target.reset();
                        setNewStationLogo('');
                        loadStations();
                      } catch (err) {
                        alert('خطأ في الإضافة');
                      }
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">اسم المحطة</label>
                        <input name="name" type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">نوع الاشتراك</label>
                          <select name="subscription_plan" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                            <option value="Basic">أساسي</option>
                            <option value="Premium">مميز</option>
                            <option value="Enterprise">مؤسسات</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">المدة (أشهر)</label>
                          <input name="months" type="number" min="1" defaultValue="1" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">اسم مستخدم المالك</label>
                        <input name="owner_username" type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">كلمة مرور المالك</label>
                        <input name="owner_password" type="password" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <input name="roles_enabled" type="checkbox" id="new_roles_enabled" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor="new_roles_enabled" className="text-sm font-bold text-slate-700 cursor-pointer">تفعيل نظام الأدوار (كاتب/محاسب)</label>
                      </div>
                      <button className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                        إنشاء المحطة والمالك
                      </button>
                    </form>
                  </Card>
                </div>

                <div className="lg:col-span-2">
                  <Card title="المحطات المضافة">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 font-bold text-slate-500 text-sm text-right">اسم المحطة</th>
                            <th className="pb-4 font-bold text-slate-500 text-sm text-right">بيانات الدخول</th>
                            <th className="pb-4 font-bold text-slate-500 text-sm text-right">الحالة</th>
                            <th className="pb-4 font-bold text-slate-500 text-sm text-right">الاشتراك</th>
                            <th className="pb-4 font-bold text-slate-500 text-sm text-right">تاريخ الانتهاء</th>
                            <th className="pb-4 font-bold text-slate-500 text-sm text-right">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {stations.map((station) => {
                            const isExpired = station.subscription_expires_at && new Date(station.subscription_expires_at) < new Date();
                            const isPending = station.subscription_status === 'Pending';
                            const isNew = station.subscription_status === 'Inactive';
                            const isInactive = !station.is_active || isExpired || isPending || isNew;
                            
                            return (
                              <tr key={station.id} className={cn(
                                "group hover:bg-slate-50 transition-colors border-b border-slate-50",
                                isPending && "bg-amber-50/30",
                                isNew && "bg-slate-50/30",
                                isInactive && "opacity-50 grayscale-[0.8] bg-slate-50/50"
                              )}>
                                <td className="py-4 font-bold text-slate-800">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                      <Fuel className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className={cn(isInactive && "text-slate-400")}>{station.name}</span>
                                      {isPending && (
                                        <span className="text-[10px] text-amber-600 font-black animate-pulse flex items-center gap-1">
                                          <Clock className="w-3 h-3" /> ينتظر التفعيل
                                        </span>
                                      )}
                                      {isNew && (
                                        <span className="text-[10px] text-slate-500 font-black flex items-center gap-1">
                                          <Clock className="w-3 h-3" /> بانتظار الدفع
                                        </span>
                                      )}
                                      {isExpired && (
                                        <span className="text-[10px] text-rose-600 font-black flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3" /> منتهي الصلاحية
                                        </span>
                                      )}
                                      {!station.is_active && !isExpired && !isPending && !isNew && (
                                        <span className="text-[10px] text-slate-400 font-black flex items-center gap-1">
                                          <Power className="w-3 h-3" /> معطل يدوياً
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              <td className="py-4">
                                <div className="flex flex-col gap-1 text-[10px] font-bold">
                                  <div className="flex items-center gap-1 text-slate-600">
                                    <span className="text-slate-400">المستخدم:</span>
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">{station.owner_username || '---'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-slate-600">
                                    <span className="text-slate-400">المرور:</span>
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{station.owner_password_plain || '---'}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4">
                                <div className="flex flex-col gap-1">
                                  <button 
                                    onClick={async () => {
                                      try {
                                        await api.fetch(`/stations/${station.id}/toggle`, { 
                                          method: 'POST', 
                                          body: JSON.stringify({ is_active: !station.is_active }) 
                                        });
                                        loadStations();
                                      } catch (err) {
                                        alert('خطأ في التغيير');
                                      }
                                    }}
                                    className={cn(
                                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all w-fit",
                                      station.is_active ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                    )}
                                  >
                                    {station.is_active ? 'نشط' : 'متوقف'}
                                  </button>
                                  {station.subscription_status === 'Pending' && (
                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black w-fit">معلق</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4">
                                <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-xs font-bold">
                                  {station.subscription_plan}
                                </span>
                              </td>
                              <td className="py-4 text-sm text-slate-500 font-medium">
                                {station.subscription_expires_at ? format(new Date(station.subscription_expires_at), 'yyyy-MM-dd') : '---'}
                              </td>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingStation(station);
                                      setPreviewLogo(station.logo_url || '');
                                    }}
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="تعديل المحطة"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  {(isPending || isNew) ? (
                                    <button 
                                      onClick={async () => {
                                        const months = window.prompt('تأكيد استلام المبلغ وتفعيل الاشتراك لعدد أشهر:', '1');
                                        if (months) {
                                          try {
                                            await api.fetch(`/stations/${station.id}/renew`, { 
                                              method: 'POST', 
                                              body: JSON.stringify({ months: parseInt(months), plan: station.subscription_plan }) 
                                            });
                                            alert('تم تفعيل المحطة بنجاح');
                                            loadStations();
                                          } catch (err) {
                                            alert('خطأ في التفعيل');
                                          }
                                        }
                                      }}
                                      className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                                    >
                                      تفعيل الآن
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={async () => {
                                        const months = window.prompt('أدخل عدد الأشهر للتجديد:', '1');
                                        if (months) {
                                          try {
                                            await api.fetch(`/stations/${station.id}/renew`, { 
                                              method: 'POST', 
                                              body: JSON.stringify({ months: parseInt(months), plan: station.subscription_plan }) 
                                            });
                                            alert('تم التجديد بنجاح');
                                            loadStations();
                                          } catch (err) {
                                            alert('خطأ في التجديد');
                                          }
                                        }
                                      }}
                                      className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors text-xs font-bold"
                                      title="تجديد الاشتراك"
                                    >
                                      تجديد
                                    </button>
                                  )}
                                  <button 
                                    onClick={async () => {
                                      if (window.confirm('هل أنت متأكد من حذف هذه المحطة؟ سيتم حذف جميع البيانات المتعلقة بها.')) {
                                        try {
                                          const res = await api.fetch(`/stations/${station.id}`, { method: 'DELETE' });
                                          if (res.success) {
                                            alert('تم حذف المحطة بنجاح');
                                            loadStations();
                                          } else {
                                            alert('خطأ في الحذف');
                                          }
                                        } catch (err: any) {
                                          alert('خطأ في الاتصال بالخادم');
                                        }
                                      }
                                    }}
                                    className="text-rose-500 hover:bg-rose-100 p-2 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                          {stations.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                                لا توجد محطات مضافة حالياً
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'support' && (
            <motion.div 
              key="support"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-4xl mx-auto"
            >
              <Card title="تواصل مع الدعم الفني">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                  {/* WhatsApp */}
                  <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col items-center gap-4 group hover:shadow-lg transition-all">
                    <div className="bg-emerald-500 p-4 rounded-2xl text-white shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">واتساب</h4>
                      <p className="text-slate-500 font-bold mt-1">07809432231</p>
                    </div>
                    <a 
                      href="https://wa.me/9647809432231" 
                      target="_blank" 
                      rel="noreferrer"
                      className="mt-2 bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all"
                    >
                      مراسلة الآن
                    </a>
                  </div>

                  {/* Telegram */}
                  <div className="p-6 rounded-2xl bg-sky-50 border border-sky-100 flex flex-col items-center gap-4 group hover:shadow-lg transition-all">
                    <div className="bg-sky-500 p-4 rounded-2xl text-white shadow-lg shadow-sky-200 group-hover:scale-110 transition-transform">
                      <Send className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">تليكرام</h4>
                      <p className="text-slate-500 font-bold mt-1">@M3JAM_1994</p>
                    </div>
                    <a 
                      href="https://t.me/M3JAM_1994" 
                      target="_blank" 
                      rel="noreferrer"
                      className="mt-2 bg-sky-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-sky-700 transition-all"
                    >
                      انضم للقناة
                    </a>
                  </div>

                  {/* Instagram */}
                  <div className="p-6 rounded-2xl bg-rose-50 border border-rose-100 flex flex-col items-center gap-4 group hover:shadow-lg transition-all">
                    <div className="bg-rose-500 p-4 rounded-2xl text-white shadow-lg shadow-rose-200 group-hover:scale-110 transition-transform">
                      <Instagram className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">انستكرام</h4>
                      <p className="text-slate-500 font-bold mt-1">@M3JAM</p>
                    </div>
                    <a 
                      href="https://instagram.com/M3JAM" 
                      target="_blank" 
                      rel="noreferrer"
                      className="mt-2 bg-rose-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-rose-700 transition-all"
                    >
                      متابعة
                    </a>
                  </div>
                </div>

                <div className="mt-12 p-8 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                  <h3 className="text-xl font-black text-slate-800 mb-2">هل تحتاج لمساعدة فورية؟</h3>
                  <p className="text-slate-500 font-medium mb-6">فريق الدعم الفني متواجد لمساعدتك في أي وقت على مدار الساعة.</p>
                  <div className="flex justify-center gap-4">
                    <div className="flex items-center gap-2 text-slate-600 font-bold">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span>دعم فني 24/7</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 font-bold">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span>تحديثات مستمرة</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
      </main>
      {editingStation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
          >
            {/* Edit Form */}
            <div className="flex-1 p-8 overflow-y-auto border-l border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                    <Edit className="w-6 h-6" />
                  </div>
                  تعديل بيانات المحطة
                </h3>
                <button 
                  onClick={() => setEditingStation(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={async (e: any) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                try {
                  await api.updateStation(editingStation.id, {
                    name: data.name,
                    address: data.address,
                    phone: data.phone,
                    roles_enabled: data.roles_enabled === 'on'
                  });
                  
                  // Update notification settings separately
                  await api.updateStationNotificationSettings(editingStation.id, {
                    notifications_enabled: data.notifications_enabled === 'on',
                    notify_expenses: data.notify_expenses === 'on',
                    notify_withdrawals: data.notify_withdrawals === 'on',
                    notify_commercial_sales: data.notify_commercial_sales === 'on'
                  });

                  alert('تم تحديث بيانات المحطة بنجاح');
                  setEditingStation(null);
                  loadStations();
                } catch (err: any) {
                  alert(err.message || 'خطأ في التحديث');
                }
              }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">اسم المحطة</label>
                    <input name="name" type="text" defaultValue={editingStation.name} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    إعدادات الإشعارات
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all">
                      <input 
                        type="checkbox" 
                        name="notifications_enabled" 
                        defaultChecked={editingStation.notifications_enabled}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm font-bold text-slate-700">تفعيل الإشعارات للمحطة</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all">
                      <input 
                        type="checkbox" 
                        name="notify_expenses" 
                        defaultChecked={editingStation.notify_expenses}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm font-bold text-slate-700">إشعارات المصروفات</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all">
                      <input 
                        type="checkbox" 
                        name="notify_withdrawals" 
                        defaultChecked={editingStation.notify_withdrawals}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm font-bold text-slate-700">إشعارات السحوبات</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all">
                      <input 
                        type="checkbox" 
                        name="notify_commercial_sales" 
                        defaultChecked={editingStation.notify_commercial_sales}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm font-bold text-slate-700">إشعارات البيع التجاري</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 cursor-pointer hover:border-indigo-200 transition-all col-span-full">
                      <input 
                        type="checkbox" 
                        name="roles_enabled" 
                        defaultChecked={editingStation.roles_enabled}
                        className="w-5 h-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm font-bold text-indigo-900">تفعيل نظام الأدوار (كاتب/محاسب)</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">العنوان</label>
                    <input name="address" type="text" defaultValue={editingStation.address} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">رقم الهاتف</label>
                    <input name="phone" type="text" defaultValue={editingStation.phone} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
                    حفظ التغييرات
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditingStation(null)}
                    className="px-8 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>

            {/* Preview Section */}
            <div className="w-full md:w-80 bg-slate-50 p-8 flex flex-col items-center justify-center border-r border-slate-100">
              <div className="text-center mb-8">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">معاينة شاشة الدخول</span>
                <p className="text-xs text-slate-400 mt-2">هكذا ستظهر الشاشة لأصحاب المحطة</p>
              </div>

              <div className="w-full aspect-[9/16] bg-white rounded-[2.5rem] shadow-2xl border-[8px] border-slate-900 relative overflow-hidden flex flex-col items-center p-6">
                <div className="w-12 h-1 bg-slate-800 rounded-full mb-8 mt-2"></div>
                
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  {previewLogo ? (
                    <img src={previewLogo} alt="Logo" className="w-24 h-24 object-contain mb-8" />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-8">
                      <Fuel className="w-12 h-12" />
                    </div>
                  )}
                  
                  <div className="w-full space-y-3">
                    <div className="h-10 bg-slate-50 rounded-xl border border-slate-100"></div>
                    <div className="h-10 bg-slate-50 rounded-xl border border-slate-100"></div>
                    <div className="h-10 bg-indigo-600 rounded-xl"></div>
                  </div>
                </div>

                <div className="mt-auto mb-4 text-[8px] text-slate-300 font-bold">نظام إدارة المحطات الذكي</div>
              </div>

              {editingStation.slug && (
                <div className="mt-8 w-full">
                  <button 
                    onClick={() => copyStationLink(editingStation.slug)}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-all group"
                  >
                    <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    نسخ رابط الدخول المباشر
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <UserPlus className={cn("w-6 h-6", showAccountModal.role === 'Writer' ? "text-indigo-600" : "text-emerald-600")} />
                {showAccountModal.id ? 'تعديل حساب' : `إنشاء حساب ${showAccountModal.role === 'Writer' ? 'كاتب' : 'محاسب'}`}
              </h3>
              <button onClick={() => setShowAccountModal(null)} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={async (e: any) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const data = Object.fromEntries(formData);
              try {
                if (showAccountModal.id) {
                  await api.updateStationAccount(showAccountModal.id, { ...data, role: showAccountModal.role });
                } else {
                  await api.saveStationAccount({ ...data, role: showAccountModal.role });
                }
                loadStationAccounts();
                setShowAccountModal(null);
                alert('تم حفظ الحساب بنجاح');
              } catch (err: any) {
                alert(err.message || 'خطأ في الحفظ');
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">الاسم الكامل</label>
                <input 
                  name="full_name" 
                  type="text" 
                  defaultValue={showAccountModal.full_name} 
                  required 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم</label>
                <input 
                  name="username" 
                  type="text" 
                  defaultValue={showAccountModal.username} 
                  required 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  كلمة المرور {showAccountModal.id && '(اتركها فارغة إذا كنت لا تريد تغييرها)'}
                </label>
                <input 
                  name="password" 
                  type="password" 
                  required={!showAccountModal.id}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                />
              </div>
              <div className="pt-4">
                <button className={cn(
                  "w-full text-white p-4 rounded-2xl font-bold transition-all shadow-lg",
                  showAccountModal.role === 'Writer' ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                )}>
                  حفظ الحساب
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showRepayModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">تسديد مبلغ من القرض</h3>
              <button onClick={() => setShowRepayModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={async (e: any) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              try {
                await api.repayLoan(showRepayModal.id, {
                  amount: parseFloat(formData.get('amount') as string),
                  repayment_date: formData.get('repayment_date'),
                });
                alert('تم تسجيل التسديد بنجاح');
                setShowRepayModal(null);
                loadDashboardData();
              } catch (err) {
                alert('خطأ في التسديد');
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">الموظف</label>
                <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-600">{showRepayModal.employee_name}</div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">مبلغ التسديد</label>
                <input name="amount" type="number" required max={showRepayModal.amount - showRepayModal.total_paid} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-[10px] text-slate-400 mt-1 font-bold">المبلغ المتبقي: {(showRepayModal.amount - showRepayModal.total_paid).toLocaleString()} د.ع</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">تاريخ التسديد</label>
                <input name="repayment_date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                تأكيد التسديد
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800">سجل تسديدات القرض</h3>
                <p className="text-sm text-slate-500 font-bold">الموظف: {showHistoryModal.employee_name}</p>
              </div>
              <button onClick={() => setShowHistoryModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 font-bold text-slate-500 text-sm">التاريخ</th>
                    <th className="pb-4 font-bold text-slate-500 text-sm">المبلغ المسدد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loanHistory.map((h: any) => (
                    <tr key={h.id}>
                      <td className="py-4 text-slate-600 font-bold">{format(new Date(h.repayment_date), 'yyyy-MM-dd')}</td>
                      <td className="py-4 text-emerald-600 font-bold">{h.amount.toLocaleString()} د.ع</td>
                    </tr>
                  ))}
                  {loanHistory.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-slate-400 font-medium">لا توجد تسديدات مسجلة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-slate-500 font-bold">إجمالي المسدد:</span>
              <span className="text-xl font-black text-emerald-600">{showHistoryModal.total_paid.toLocaleString()} د.ع</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SubscriptionView({ station, onSubscribe, onConfirmManual, onRefresh }: any) {
  const [showManualInfo, setShowManualInfo] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const plans = [
    {
      id: 'Premium',
      name: 'الاشتراك الكامل',
      price: '25,000',
      features: [
        'إدارة المنتجات والمضخات',
        'إدخال المبيعات اليومية',
        'إدارة المخزون والواردات',
        'تقارير المبيعات والأرباح',
        'دعم فني متكامل',
        'كافة صلاحيات النظام'
      ],
      color: 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500'
    }
  ];

  if (showManualInfo && selectedPlan) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button 
          onClick={() => setShowManualInfo(false)}
          className="flex items-center gap-2 text-indigo-600 font-bold hover:gap-3 transition-all"
        >
          <ChevronLeft className="w-5 h-5 rotate-180" />
          <span>العودة للخطط</span>
        </button>

        <Card title="تفاصيل التحويل المباشر" className="text-right">
          <div className="space-y-6 p-4">
            {station?.subscription_status !== 'Active' && (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-amber-800 font-bold text-sm">
                يرجى تحويل مبلغ ({selectedPlan.price} د.ع) إلى الحساب أدناه ثم الضغط على زر "تأكيد التحويل"
              </div>
            )}

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-slate-500 text-xs mb-1">رقم حساب الماستر كارد</span>
                <span className="text-2xl font-black tracking-wider text-slate-800">917339770914</span>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-slate-500 text-xs mb-1">اسم صاحب البطاقة</span>
                <span className="text-xl font-black text-slate-800"> MOHAMMED HAMMOOD </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-slate-500 text-xs mb-1">نوع البطاقة / المصرف</span>
                <span className="text-lg font-black text-slate-800">مصرف الرافدين </span>
              </div>
            </div>

            <button 
              onClick={() => onConfirmManual(selectedPlan.id)}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
            >
              لقد قمت بتحويل المبلغ، تأكيد الطلب
            </button>
            
            <p className="text-center text-slate-400 text-xs font-bold">
              سيتم مراجعة طلبك وتفعيل الحساب خلال أقل من 24 ساعة
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-black text-slate-800 mb-4 text-right">اختر خطة الاشتراك المناسبة لمحطتك</h2>
        <p className="text-slate-500 font-medium text-right">ابدأ الآن بإدارة محطتك بشكل احترافي مع نظامنا المتكامل</p>
      </div>

      <div className="flex justify-center">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={cn(
              "p-8 rounded-3xl border transition-all hover:scale-105 text-right flex flex-col max-w-md w-full",
              plan.color
            )}
          >
            <div className="mb-6">
              <h3 className="text-xl font-black mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 justify-center">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className="text-sm font-bold opacity-60">د.ع / شهر</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-bold justify-end flex-row-reverse">
                  <span>{feature}</span>
                  <CheckCircle className={cn("w-5 h-5", plan.id === 'Enterprise' ? "text-emerald-400" : "text-emerald-500")} />
                </li>
              ))}
            </ul>

            <div className="space-y-3">
              <button 
                onClick={() => {
                  setSelectedPlan(plan);
                  setShowManualInfo(true);
                }}
                disabled={station?.subscription_plan === plan.id}
                className={cn(
                  "w-full py-4 rounded-2xl font-black transition-all shadow-lg",
                  plan.id === 'Enterprise' 
                    ? "bg-white text-slate-900 hover:bg-slate-100" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100",
                  station?.subscription_plan === plan.id && "opacity-50 cursor-not-allowed"
                )}
              >
                {station?.subscription_plan === plan.id ? 'خطتك الحالية' : 'التحويل المباشر'}
              </button>
              
              <button 
                onClick={() => onSubscribe(plan.id)}
                className="w-full py-2 text-xs font-bold opacity-60 hover:opacity-100 transition-all"
              >
                أو الدفع عبر البطاقة إلكترونياً
              </button>
            </div>
          </div>
        ))}
      </div>

      {station && (
        <Card title="حالة الاشتراك الحالي" className="max-w-md mx-auto text-right">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={cn(
                "px-3 py-1 rounded-lg font-black",
                station.subscription_status === 'Active' ? "bg-emerald-100 text-emerald-600" : 
                station.subscription_status === 'Pending' ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
              )}>
                {station.subscription_status === 'Active' ? 'نشط' : 
                 station.subscription_status === 'Pending' ? 'بانتظار التفعيل من الإدارة' : 'بانتظار الدفع'}
              </span>
              <span className="text-slate-500 font-bold">حالة الحساب:</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg font-black">{station.subscription_plan || '---'}</span>
              <span className="text-slate-500 font-bold">الخطة الحالية:</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-800 font-black">
                {station.subscription_expires_at ? format(new Date(station.subscription_expires_at), 'yyyy-MM-dd') : 'غير محدد'}
              </span>
              <span className="text-slate-500 font-bold">تاريخ الانتهاء:</span>
            </div>
            
            <button 
              onClick={async () => {
                setIsRefreshing(true);
                await onRefresh();
                setTimeout(() => setIsRefreshing(false), 1000);
              }}
              disabled={isRefreshing}
              className="w-full mt-4 flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              تحديث حالة الاشتراك
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function InventoryView({ inventory, products, onSave, onDelete, dateFilter, onDateChange }: any) {
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    await onSave({
      ...data,
      quantity: parseFloat(data.quantity as string),
      unit_price: parseFloat(data.unit_price as string),
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="date" 
              value={dateFilter} 
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl p-2 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <PlusCircle className="w-5 h-5" />
          <span>إضافة وارد جديد</span>
        </button>
      </div>

      {showForm && (
        <Card title="تسجيل كمية واردة جديدة">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">المنتج</label>
              <select name="product_id" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">اختر المنتج</option>
                {products?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">الكمية (لتر)</label>
              <input name="quantity" type="number" step="0.01" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">سعر الشراء للتر (دينار)</label>
              <input name="unit_price" type="number" step="0.01" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم المورد</label>
              <input name="supplier_name" type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="اختياري" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">التاريخ</label>
              <input name="transaction_date" type="date" defaultValue={dateFilter} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                حفظ الوارد
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card title="سجل الواردات">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-black text-slate-400 text-sm uppercase">التاريخ</th>
                <th className="pb-4 font-black text-slate-400 text-sm uppercase">المنتج</th>
                <th className="pb-4 font-black text-slate-400 text-sm uppercase">الكمية</th>
                <th className="pb-4 font-black text-slate-400 text-sm uppercase">سعر الشراء</th>
                <th className="pb-4 font-black text-slate-400 text-sm uppercase">المورد</th>
                <th className="pb-4 font-black text-slate-400 text-sm uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {inventory?.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 text-sm font-bold text-slate-700">{item.transaction_date}</td>
                  <td className="py-4 text-sm font-bold text-slate-700">{item.product_name}</td>
                  <td className="py-4 text-sm font-bold text-indigo-600">{(item.quantity || 0).toLocaleString()} لتر</td>
                  <td className="py-4 text-sm font-bold text-slate-700">{(item.unit_price || 0).toLocaleString()} د.ع</td>
                  <td className="py-4 text-sm font-medium text-slate-500">{item.supplier_name || '-'}</td>
                  <td className="py-4">
                    <button 
                      onClick={() => onDelete(item.id)}
                      className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!inventory || inventory.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">لا توجد سجلات لهذا التاريخ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
