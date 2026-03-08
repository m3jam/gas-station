import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Fuel, 
  Settings, 
  LogOut, 
  PlusCircle, 
  TrendingUp, 
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
  ArrowRight
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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
  const [stationData, setStationData] = useState<any>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedProductId(null);
  }, [activeTab]);

  useEffect(() => {
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

  const loadStations = async () => {
    try {
      const data = await api.fetch('/stations');
      setStations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStationData = async () => {
    try {
      const data = await api.fetch('/station-info');
      setStationData(data);
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
  }, [activeTab, reportType, reportDate, expenseDateFilter, inventoryDateFilter]);

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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100"
        >
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
              <Fuel className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">نظام {user?.station_name || 'محطتي'}</h1>
            <p className="text-slate-500 mt-2 font-medium">إدارة محطات الوقود الذكية</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم</label>
              <input 
                name="username" 
                type="text" 
                required 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                placeholder="أدخل اسم المستخدم"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
              <input 
                name="password" 
                type="password" 
                required 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
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
              <SidebarItem 
                icon={LayoutDashboard} 
                label="الصفحة الرئيسية " 
                active={activeTab === 'dashboard'} 
                disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('dashboard'); setIsSidebarOpen(false); } }} 
              />
              <SidebarItem 
                icon={Gauge} 
                label="إدخال المبيعات" 
                active={activeTab === 'readings'} 
                disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('readings'); setIsSidebarOpen(false); } }} 
              />
              <SidebarItem 
                icon={Wallet} 
                label="المصاريف" 
                active={activeTab === 'expenses'} 
                disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('expenses'); setIsSidebarOpen(false); } }} 
              />
              <SidebarItem 
                icon={Package} 
                label="المنتجات والمضخات" 
                active={activeTab === 'setup'} 
                disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('setup'); setIsSidebarOpen(false); } }} 
              />
              <SidebarItem 
                icon={TrendingUp} 
                label="الواردات (الخزين)" 
                active={activeTab === 'inventory'} 
                disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('inventory'); setIsSidebarOpen(false); } }} 
              />
              <SidebarItem 
                icon={Settings} 
                label="الإعدادات" 
                active={activeTab === 'settings'} 
                disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('settings'); setIsSidebarOpen(false); } }} 
              />
              <SidebarItem 
                icon={FileText} 
                label="التقارير" 
                active={activeTab === 'reports'} 
                disabled={!!subscriptionError && user?.role !== 'SuperAdmin'}
                onClick={() => { if (!subscriptionError || user?.role === 'SuperAdmin') { setActiveTab('reports'); setIsSidebarOpen(false); } }} 
              />
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
                  {activeTab === 'expenses' && 'إدارة المصاريف'}
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
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl p-2 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
              {activeTab === 'dashboard' && stats && user.role !== 'SuperAdmin' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  title="إجمالي المبيعات" 
                  value={`${stats.products.reduce((acc: any, p: any) => acc + (p.total_sales || 0), 0).toLocaleString()} د.ع`}
                  icon={TrendingUp}
                  color="bg-indigo-500"
                />
                <StatCard 
                  title="صافي الربح" 
                  value={`${(stats.products.reduce((acc: any, p: any) => acc + (p.total_profit || 0), 0) - stats.totalExpenses).toLocaleString()} د.ع`}
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

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="مبيعات المنتجات اليوم (دينار)">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.products}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        <Bar dataKey="total_sales" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="توزيع الأرباح">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.products}
                          dataKey="total_profit"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                        >
                          {stats.products.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
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
                              reading_date: date,
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
              className="max-w-2xl mx-auto"
            >
              <Card title="تسجيل مصروف جديد">
                <form onSubmit={async (e: any) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  try {
                    await api.saveExpense({
                      expense_date: date,
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
                      value={`${reportsData.products.reduce((acc: any, p: any) => acc + (p.total_sales || 0), 0).toLocaleString()} د.ع`}
                      icon={TrendingUp}
                      color="bg-indigo-500"
                    />
                    <StatCard 
                      title="إجمالي الربح" 
                      value={`${reportsData.products.reduce((acc: any, p: any) => acc + (p.total_profit || 0), 0).toLocaleString()} د.ع`}
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
                      value={`${(reportsData.products.reduce((acc: any, p: any) => acc + (p.total_profit || 0), 0) - reportsData.totalExpenses).toLocaleString()} د.ع`}
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
                      try {
                        await api.fetch('/stations', { 
                          method: 'POST', 
                          body: JSON.stringify(Object.fromEntries(formData)) 
                        });
                        alert('تم إنشاء المحطة والمالك بنجاح');
                        e.target.reset();
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
        'إدخال العدادات اليومية',
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
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-amber-800 font-bold text-sm">
              يرجى تحويل مبلغ ({selectedPlan.price} د.ع) إلى الحساب أدناه ثم الضغط على زر "تأكيد التحويل"
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-slate-500 text-xs mb-1">رقم بطاقة الماستر كارد</span>
                <span className="text-2xl font-black tracking-wider text-slate-800">5123 4567 8901 2345</span>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-slate-500 text-xs mb-1">اسم صاحب البطاقة</span>
                <span className="text-xl font-black text-slate-800">اسمك الكامل هنا</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-slate-500 text-xs mb-1">نوع البطاقة / المصرف</span>
                <span className="text-lg font-black text-slate-800">زين كاش / الرافدين / مصرف الطيف</span>
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
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className="text-sm font-bold opacity-60">د.ع / شهر</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-bold justify-end">
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
