import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Utensils, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Star, 
  MessageSquare, 
  Settings,
  X,
  Plus,
  Minus,
  Smartphone,
  ChefHat,
  Trash2,
  Edit2,
  Lock,
  Upload,
  User,
  Megaphone,
  Info,
  DollarSign,
  Search,
  Trophy,
  Users,
  Ban,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Meal {
  id: number;
  name: string;
  description: string;
  price: number;
  status: 'available' | 'sold_out';
  available_at: string | null;
  category: string;
}

interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  user_id?: number;
  items: OrderItem[];
  total: number;
  type: 'sit-in' | 'take-away';
  status: 'pending' | 'preparing' | 'ready' | 'collected' | 'rejected';
  phone: string;
  customer_name: string;
  payment_proof: string;
  transaction_id?: string;
  created_at: string;
}

interface UserProfile {
  id: number;
  username: string;
}

interface Feedback {
  id: number;
  order_id: number;
  user_id?: number;
  username?: string;
  rating: number;
  comment: string;
  created_at: string;
  items?: string;
}

interface SettingsState {
  ecocash_number: string;
  admin_password?: string;
  ecocash_charges: string;
  canteen_notice: string;
}

export default function App() {
  const [portal, setPortal] = useState<'selection' | 'customer' | 'staff'>('selection');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [settings, setSettings] = useState<SettingsState>({ 
    ecocash_number: '', 
    ecocash_charges: '0', 
    canteen_notice: '' 
  });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<'sit-in' | 'take-away'>('take-away');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // User Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Admin Portal State
  const [adminOrderTab, setAdminOrderTab] = useState<'preparing' | 'ready' | 'collected'>('preparing');
  const [staffSearch, setStaffSearch] = useState('');
  const [editingMeal, setEditingMeal] = useState<Partial<Meal> | null>(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [formerPassword, setFormerPassword] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const topCustomers = useMemo(() => {
    const counts: Record<string, { count: number, name: string, phone: string }> = {};
    adminOrders.filter(o => o.status === 'collected').forEach(o => {
      const key = o.user_id ? `user-${o.user_id}` : `phone-${o.phone}`;
      if (!counts[key]) {
        counts[key] = { count: 0, name: o.customer_name, phone: o.phone };
      }
      counts[key].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [adminOrders]);

  // WebSocket setup
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ORDER_STATUS_UPDATE' || data.type === 'NEW_ORDER' || data.type === 'MEAL_UPDATE') {
        fetchMeals();
        fetchOrders();
      }
    };

    return () => ws.close();
  }, []);

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setSettings(data);
  };

  const fetchMeals = async () => {
    const res = await fetch('/api/meals');
    const data = await res.json();
    setMeals(data);
  };

  const fetchOrders = async () => {
    const res = await fetch('/api/orders');
    const data = await res.json();
    setAdminOrders(data);
    
    const token = localStorage.getItem('canteen_token');
    if (token) {
      const myRes = await fetch('/api/my-orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (myRes.ok) {
        const myData = await myRes.json();
        setMyOrders(myData);
      }
    } else {
      const savedPhone = localStorage.getItem('canteen_phone');
      if (savedPhone) {
        setMyOrders(data.filter((o: Order) => o.phone === savedPhone));
      }
    }
  };

  const fetchFeedback = async () => {
    const res = await fetch('/api/feedback');
    const data = await res.json();
    setFeedbackList(data);
  };

  const checkAuth = () => {
    const user = localStorage.getItem('canteen_user');
    if (user) {
      setCurrentUser(JSON.parse(user));
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchMeals();
    fetchOrders();
    fetchFeedback();
    checkAuth();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addToCart = (meal: Meal) => {
    if (meal.status === 'sold_out') return;
    setCart(prev => {
      const existing = prev.find(item => item.id === meal.id);
      if (existing) {
        return prev.map(item => item.id === meal.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: meal.id, name: meal.name, price: meal.price, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.id === id ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const totalWithCharges = useMemo(() => cartTotal + parseFloat(settings.ecocash_charges || '0'), [cartTotal, settings.ecocash_charges]);

  const handlePlaceOrder = async () => {
    const finalCustomerName = currentUser?.username || customerName;
    if (!phone || !finalCustomerName || (!paymentProof && !transactionId) || cart.length === 0) {
      alert('Please fill in all fields and provide payment proof (screenshot or transaction ID).');
      return;
    }
    setIsOrdering(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          total: totalWithCharges,
          type: orderType,
          phone,
          customer_name: finalCustomerName,
          payment_proof: paymentProof,
          transaction_id: transactionId,
          user_id: currentUser?.id
        })
      });
      
      if (res.ok) {
        localStorage.setItem('canteen_phone', phone);
        setCart([]);
        setCustomerName('');
        setPaymentProof(null);
        setTransactionId('');
        await fetchOrders();
        setShowOrderSuccessModal(true);
      } else {
        const errorData = await res.json();
        alert(`Failed to submit order: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Order submission error:', error);
      alert('Network error. Please check your connection and try again.');
    } finally {
      setIsOrdering(false);
    }
  };

  const updateOrderStatus = async (id: number, status: string) => {
    await fetch(`/api/orders/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchOrders();
  };

  const toggleMealStatus = async (meal: Meal) => {
    const newStatus = meal.status === 'available' ? 'sold_out' : 'available';
    const availableAt = newStatus === 'sold_out' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    await fetch(`/api/meals/${meal.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, available_at: availableAt })
    });
    fetchMeals();
  };

  const submitFeedback = async () => {
    if (!showFeedbackModal) return;
    const token = localStorage.getItem('canteen_token');
    if (!token) {
      alert('Please login to leave feedback');
      setShowAuthModal(true);
      return;
    }
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ order_id: showFeedbackModal, rating, comment })
    });
    setShowFeedbackModal(null);
    setComment('');
    setRating(5);
    fetchFeedback();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('canteen_token', data.token);
        localStorage.setItem('canteen_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setShowAuthModal(false);
        setAuthUsername('');
        setAuthPassword('');
        fetchOrders();
      } else {
        alert(data.error || 'Authentication failed');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('canteen_token');
    localStorage.removeItem('canteen_user');
    setCurrentUser(null);
    setMyOrders([]);
    setPortal('selection');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === settings.admin_password) {
      setIsAdminAuthenticated(true);
    } else {
      alert('Incorrect password');
    }
  };

  const handleChangeStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formerPassword || !newStaffPassword) {
      alert('Please fill in all fields');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: formerPassword, newPassword: newStaffPassword })
      });
      if (res.ok) {
        alert('Password changed successfully');
        setShowChangePasswordModal(false);
        setFormerPassword('');
        setNewStaffPassword('');
        fetchSettings();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to change password');
      }
    } catch (err) {
      alert('An error occurred');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const saveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingMeal?.id ? 'PUT' : 'POST';
    const url = editingMeal?.id ? `/api/meals/${editingMeal.id}` : '/api/meals';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingMeal)
    });

    if (res.ok) {
      setShowMealModal(false);
      setEditingMeal(null);
      fetchMeals();
    }
  };

  const deleteMeal = async (id: number) => {
    if (!confirm('Are you sure you want to delete this meal?')) return;
    await fetch(`/api/meals/${id}`, { method: 'DELETE' });
    fetchMeals();
  };

  const updateSetting = async (key: string, value: string) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    fetchSettings();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {portal === 'selection' ? (
        <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-600">
          <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-10 rounded-[40px] shadow-2xl text-center flex flex-col items-center justify-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 mb-6">
                <ShoppingBag size={40} />
              </div>
              <h2 className="text-3xl font-black mb-4">I'm a Customer</h2>
              <p className="text-black/40 mb-8 font-medium">Order fresh meals, track your history, and leave feedback.</p>
              <button 
                onClick={() => setPortal('customer')}
                className="w-full py-5 rounded-2xl bg-emerald-600 text-white font-bold text-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                Enter Canteen
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black p-10 rounded-[40px] shadow-2xl text-center flex flex-col items-center justify-center text-white"
            >
              <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center text-white mb-6">
                <ChefHat size={40} />
              </div>
              <h2 className="text-3xl font-black mb-4">I'm Staff</h2>
              <p className="text-white/40 mb-8 font-medium">Manage orders, update the menu, and see daily revenue.</p>
              <button 
                onClick={() => setPortal('staff')}
                className="w-full py-5 rounded-2xl bg-white text-black font-bold text-xl hover:bg-emerald-50 transition-all"
              >
                Staff Portal
              </button>
            </motion.div>
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/60 font-bold tracking-widest uppercase text-xs">
            CanteenConnect v2.0
          </div>
        </div>
      ) : (
        <>
          {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-96"
          >
            <div className="bg-emerald-600 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm">Install CanteenConnect</p>
                  <p className="text-[10px] text-white/70 font-medium">Access your meals faster from your home screen!</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleInstallClick}
                  className="bg-white text-emerald-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-50 transition-colors"
                >
                  Install
                </button>
                <button 
                  onClick={() => setShowInstallBanner(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
          <nav className="sticky top-0 z-50 bg-white border-b border-black/5 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPortal('selection')}>
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                <Utensils size={24} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">CanteenConnect</h1>
            </div>
            <div className="flex items-center gap-4">
              {portal === 'customer' && (
                currentUser ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold">{currentUser.username}</p>
                      <button onClick={handleLogout} className="text-[10px] font-bold text-red-600 uppercase hover:underline">Logout</button>
                    </div>
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold">
                      {currentUser.username[0].toUpperCase()}
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                    className="text-sm font-bold px-4 py-2 rounded-full bg-black text-white hover:bg-emerald-600 transition-colors flex items-center gap-2"
                  >
                    <User size={16} />
                    Login / Register
                  </button>
                )
              )}
              <button 
                onClick={() => setPortal('selection')}
                className="text-sm font-medium px-4 py-2 rounded-full border border-black/10 hover:bg-black/5 transition-colors"
              >
                Switch Portal
              </button>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto p-6 pb-24 md:pb-6">
            {portal === 'customer' ? (
              !currentUser ? (
                <div className="max-w-2xl mx-auto mt-20 text-center">
                  <div className="w-24 h-24 bg-emerald-100 rounded-[32px] flex items-center justify-center text-emerald-600 mx-auto mb-8">
                    <Lock size={48} />
                  </div>
                  <h2 className="text-4xl font-black mb-4">Registration Required</h2>
                  <p className="text-black/40 text-lg mb-10 font-medium">Please login or create an account to view today's menu and place orders.</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                      onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                      className="px-10 py-5 rounded-2xl bg-emerald-600 text-white font-bold text-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
                    >
                      Register Now
                    </button>
                    <button 
                      onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                      className="px-10 py-5 rounded-2xl border-2 border-black text-black font-bold text-xl hover:bg-black hover:text-white transition-all"
                    >
                      Login
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Menu Section */}
            <div className="lg:col-span-2 space-y-8">
              {/* Active Order Tracker */}
              {myOrders.some(o => o.status !== 'collected') && (
                <div className="bg-black text-white p-6 rounded-[32px] shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Utensils size={120} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-4">Live Order Status</h3>
                    <div className="space-y-6">
                      {myOrders.filter(o => o.status !== 'collected').map(order => (
                        <div key={order.id} className="flex items-center gap-6">
                          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                            {order.status === 'ready' ? <CheckCircle2 className="text-emerald-400" /> : <Clock className="animate-spin-slow" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                              <p className="font-bold text-lg">Order #{order.id}</p>
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                order.status === 'ready' ? "bg-emerald-400 text-black" : "bg-white/20 text-white"
                              )}>
                                {order.status}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: order.status === 'ready' ? '100%' : order.status === 'preparing' ? '66%' : '33%' }}
                                className={cn(
                                  "h-full transition-all duration-1000",
                                  order.status === 'ready' ? "bg-emerald-400" : "bg-white"
                                )}
                              />
                            </div>
                            <p className="text-xs mt-2 text-white/60 font-medium">
                              {order.status === 'pending' && "Waiting for staff to confirm payment..."}
                              {order.status === 'preparing' && "Chef is preparing your meal with care!"}
                              {order.status === 'ready' && "Your meal is hot and ready! Please collect it."}
                              {order.status === 'rejected' && "Order rejected. Please contact staff for details."}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Notice Board */}
              {settings.canteen_notice && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-start gap-4"
                >
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wider opacity-80">Notice Board</h3>
                    <p className="font-medium">{settings.canteen_notice}</p>
                  </div>
                </motion.div>
              )}

              <section>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h2 className="text-3xl font-bold mb-1">Today's Menu</h2>
                    <p className="text-black/50">Fresh meals prepared daily</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {meals.map(meal => (
                    <motion.div 
                      key={meal.id}
                      layout
                      className={cn(
                        "group p-4 rounded-2xl border transition-all duration-300",
                        meal.status === 'sold_out' ? "bg-black/5 border-transparent opacity-60" : "bg-white border-black/5 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5"
                      )}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                          {meal.category}
                        </span>
                        <span className="text-lg font-bold">${meal.price.toFixed(2)}</span>
                      </div>
                      <h3 className="text-lg font-bold mb-1">{meal.name}</h3>
                      <p className="text-sm text-black/50 mb-4 line-clamp-2">{meal.description}</p>
                      
                      {meal.status === 'sold_out' ? (
                        <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
                          <AlertCircle size={16} />
                          <span>Sold Out • Back {meal.available_at ? new Date(meal.available_at).toLocaleDateString() : 'soon'}</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(meal)}
                          className="w-full py-2.5 rounded-xl bg-black text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
                        >
                          <Plus size={16} />
                          Add to Order
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* My Orders Section */}
              {myOrders.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold mb-6">My Recent Orders</h2>
                  <div className="space-y-4">
                    {myOrders.map(order => (
                      <div key={order.id} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-xs font-bold text-black/40 uppercase">Order #{order.id}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock size={14} className="text-black/40" />
                              <span className="text-sm text-black/60">{new Date(order.created_at).toLocaleTimeString()}</span>
                            </div>
                          </div>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                            order.status === 'ready' ? "bg-emerald-100 text-emerald-700" : 
                            order.status === 'preparing' ? "bg-blue-100 text-blue-700" :
                            order.status === 'rejected' ? "bg-red-100 text-red-700" :
                            order.status === 'collected' ? "bg-black/5 text-black/40" : "bg-orange-100 text-orange-700"
                          )}>
                            {order.status}
                          </div>
                        </div>
                        <div className="space-y-2 mb-4">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.name}</span>
                              <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-black/5">
                          <span className="font-bold">Total: ${order.total.toFixed(2)}</span>
                          {order.status === 'collected' && (
                            <button 
                              onClick={() => setShowFeedbackModal(order.id)}
                              className="text-sm font-bold text-emerald-600 flex items-center gap-1"
                            >
                              <MessageSquare size={14} />
                              Leave Feedback
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <div className="flex items-center gap-2 text-emerald-600 font-bold animate-pulse">
                              <CheckCircle2 size={18} />
                              Ready for Collection!
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Cart Section */}
            <div id="cart-section" className="lg:col-span-1">
              <div className="sticky top-24 bg-white rounded-3xl border border-black/5 shadow-xl overflow-hidden">
                <div className="p-6 bg-black text-white flex justify-between items-center">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <ShoppingBag size={20} />
                    Your Order
                  </h2>
                  {cart.length > 0 && (
                    <button 
                      onClick={() => setCart([])}
                      className="text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Clear
                    </button>
                  )}
                </div>
                
                <div className="p-6 space-y-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Utensils size={24} className="text-black/20" />
                      </div>
                      <p className="text-black/40 font-medium">Your cart is empty</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2">
                        {cart.map(item => (
                          <div key={item.id} className="flex justify-between items-center">
                            <div>
                              <p className="font-bold">{item.name}</p>
                              <p className="text-xs text-black/40">${item.price.toFixed(2)} each</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg border border-black/10 flex items-center justify-center hover:bg-black/5">
                                <Minus size={14} />
                              </button>
                              <span className="font-bold w-4 text-center">{item.quantity}</span>
                              <button onClick={() => addToCart(meals.find(m => m.id === item.id)!)} className="w-8 h-8 rounded-lg border border-black/10 flex items-center justify-center hover:bg-black/5">
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4 pt-6 border-t border-black/5">
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                          <p className="text-xs font-bold text-emerald-800 uppercase mb-1">EcoCash Payment</p>
                          <p className="text-sm font-medium text-emerald-700">Send money to: <span className="font-black">{settings.ecocash_number}</span></p>
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-600 font-bold bg-white/50 p-2 rounded-lg">
                            <Info size={12} />
                            <span>Please add ${settings.ecocash_charges} for charges</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => setOrderType('sit-in')}
                            className={cn(
                              "flex-1 py-2 rounded-xl text-sm font-bold border transition-all",
                              orderType === 'sit-in' ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "border-black/10 text-black/40"
                            )}
                          >
                            Sit-in
                          </button>
                          <button 
                            onClick={() => setOrderType('take-away')}
                            className={cn(
                              "flex-1 py-2 rounded-xl text-sm font-bold border transition-all",
                              orderType === 'take-away' ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "border-black/10 text-black/40"
                            )}
                          >
                            Take-away
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">EcoCash Number</label>
                            <div className="relative">
                              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={16} />
                              <input 
                                type="tel" 
                                placeholder="077..."
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-black/10 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Payment Proof (Choose One)</label>
                            <div className="grid grid-cols-1 gap-3">
                              <div className="relative">
                                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={16} />
                                <input 
                                  type="text" 
                                  placeholder="EcoCash Transaction ID"
                                  value={transactionId}
                                  onChange={(e) => setTransactionId(e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-black/10 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-black/5" />
                                <span className="text-[10px] font-bold text-black/20 uppercase">OR</span>
                                <div className="h-px flex-1 bg-black/5" />
                              </div>
                              <label className={cn(
                                "flex items-center gap-2 w-full px-4 py-2 rounded-xl border border-dashed cursor-pointer transition-all",
                                paymentProof ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "border-black/20 hover:bg-black/5 text-black/50"
                              )}>
                                <Upload size={16} />
                                <span className="text-sm font-medium">{paymentProof ? 'Screenshot Uploaded' : 'Upload Screenshot'}</span>
                                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 pt-2 border-t border-black/5">
                          <div className="flex justify-between text-xs text-black/40">
                            <span>Subtotal</span>
                            <span>${cartTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-black/40">
                            <span>EcoCash Charges</span>
                            <span>${settings.ecocash_charges}</span>
                          </div>
                          <div className="flex justify-between items-end pt-1">
                            <span className="text-black/60 font-bold">Total to Send</span>
                            <span className="text-2xl font-black">${totalWithCharges.toFixed(2)}</span>
                          </div>
                        </div>

                        <button 
                          disabled={isOrdering || !phone || (!currentUser && !customerName) || (!paymentProof && !transactionId) || cart.length === 0}
                          onClick={handlePlaceOrder}
                          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-lg shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                        >
                          {isOrdering ? 'Processing...' : 'Submit Order'}
                          {!isOrdering && <ChevronRight size={20} />}
                        </button>
                        <p className="text-[10px] text-center text-black/30">Canteen will verify payment before preparing</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            </div>
          )
        ) : (
          /* Admin View */
          <div className="space-y-12">
            {portal === 'staff' && !isAdminAuthenticated ? (
              <div className="max-w-md mx-auto mt-20">
                <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-xl text-center">
                  <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 text-white">
                    <Lock size={32} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Staff Access Only</h2>
                  <p className="text-black/40 mb-8">Please enter the portal password</p>
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <input 
                      type="password" 
                      placeholder="Password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border border-black/10 focus:border-emerald-500 outline-none transition-all font-medium text-center"
                    />
                    <button className="w-full py-4 rounded-2xl bg-black text-white font-bold hover:bg-emerald-600 transition-all">
                      Unlock Portal
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                    <p className="text-sm font-bold text-black/40 uppercase mb-1">Active Orders</p>
                    <p className="text-4xl font-black">{adminOrders.filter(o => o.status !== 'collected').length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                    <p className="text-sm font-bold text-black/40 uppercase mb-1">Today's Revenue</p>
                    <p className="text-4xl font-black text-emerald-600">
                      ${adminOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                    <p className="text-sm font-bold text-black/40 uppercase mb-1">Avg Rating</p>
                    <div className="flex items-center gap-2">
                      <p className="text-4xl font-black">
                        {feedbackList.length > 0 ? (feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length).toFixed(1) : '5.0'}
                      </p>
                      <Star className="text-yellow-400 fill-yellow-400" size={24} />
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                    <p className="text-sm font-bold text-black/40 uppercase mb-1">EcoCash Number</p>
                    <div className="flex items-center justify-between">
                      <input 
                        type="text" 
                        value={settings.ecocash_number}
                        onChange={(e) => updateSetting('ecocash_number', e.target.value)}
                        className="text-xl font-black bg-transparent border-none outline-none w-full"
                      />
                      <button 
                        onClick={() => setShowChangePasswordModal(true)}
                        className="p-2 hover:bg-black/5 rounded-xl transition-colors text-black/40 hover:text-black"
                        title="Change Portal Password"
                      >
                        <Lock size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Admin Settings Panel */}
                <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Megaphone size={20} className="text-emerald-600" />
                      Notice Board Message
                    </h3>
                    <textarea 
                      value={settings.canteen_notice}
                      onChange={(e) => updateSetting('canteen_notice', e.target.value)}
                      placeholder="Announce specials or notices here..."
                      className="w-full h-24 p-4 rounded-2xl border border-black/10 focus:border-emerald-500 outline-none transition-all resize-none font-medium text-sm"
                    />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <DollarSign size={20} className="text-emerald-600" />
                      EcoCash Charges ($)
                    </h3>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" size={18} />
                      <input 
                        type="number" 
                        step="0.01"
                        value={settings.ecocash_charges}
                        onChange={(e) => updateSetting('ecocash_charges', e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-black/10 focus:border-emerald-500 outline-none transition-all font-bold"
                      />
                    </div>
                    <p className="text-xs text-black/40">This amount will be added to the customer's total at checkout.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                  {/* Order Management */}
                  <section>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <ChefHat size={24} />
                        Manage Orders
                      </h2>
                      <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search customer name..."
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 rounded-xl border border-black/10 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mb-6 bg-black/5 p-1 rounded-2xl">
                      {(['preparing', 'ready', 'collected', 'rejected'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setAdminOrderTab(tab as any)}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                            adminOrderTab === tab ? "bg-white text-black shadow-sm" : "text-black/40 hover:text-black/60"
                          )}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      {adminOrders.filter(o => {
                        const matchesSearch = o.customer_name.toLowerCase().includes(staffSearch.toLowerCase());
                        if (!matchesSearch) return false;
                        
                        if (adminOrderTab === 'preparing') return o.status === 'pending' || o.status === 'preparing';
                        return o.status === adminOrderTab;
                      }).map(order => (
                        <div key={order.id} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">Order #{order.id}</span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter",
                                  order.type === 'sit-in' ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                                )}>
                                  {order.type}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-emerald-600">{order.customer_name}</p>
                              <p className="text-xs text-black/40">{order.phone}</p>
                            </div>
                            <div className="flex gap-2">
                              {order.status === 'pending' && (
                                <>
                                  <button 
                                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700"
                                  >
                                    Start Preparing
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (confirm('Are you sure you want to reject this order?')) {
                                        updateOrderStatus(order.id, 'rejected');
                                      }
                                    }}
                                    className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-200 flex items-center gap-2"
                                  >
                                    <Ban size={16} />
                                    Reject
                                  </button>
                                </>
                              )}
                              {order.status === 'preparing' && (
                                <button 
                                  onClick={() => updateOrderStatus(order.id, 'ready')}
                                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700"
                                >
                                  Mark Done (Ready)
                                </button>
                              )}
                              {order.status === 'ready' && (
                                <button 
                                  onClick={() => updateOrderStatus(order.id, 'collected')}
                                  className="px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-black/80"
                                >
                                  Mark Collected
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-black/5 rounded-xl p-4 space-y-2">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between font-medium text-sm">
                                  <span>{item.quantity}x {item.name}</span>
                                </div>
                              ))}
                              <div className="pt-2 border-t border-black/10 flex justify-between font-black text-sm">
                                <span>Total Paid</span>
                                <span>${order.total.toFixed(2)}</span>
                              </div>
                              {order.transaction_id && (
                                <div className="pt-2 border-t border-black/10">
                                  <p className="text-[10px] font-bold text-black/40 uppercase">Transaction ID</p>
                                  <p className="text-xs font-mono font-bold text-emerald-600">{order.transaction_id}</p>
                                </div>
                              )}
                            </div>
                            <div className="relative group cursor-pointer">
                              {order.payment_proof ? (
                                <>
                                  <img src={order.payment_proof} alt="Proof" className="h-24 w-full object-cover rounded-xl border border-black/5" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                    <button onClick={() => window.open(order.payment_proof)} className="text-white text-xs font-bold">View Proof</button>
                                  </div>
                                </>
                              ) : (
                                <div className="h-24 w-full bg-black/5 rounded-xl flex items-center justify-center text-center p-2">
                                  <p className="text-[10px] font-bold text-black/30 uppercase">No Screenshot Provided</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {adminOrders.filter(o => {
                        if (adminOrderTab === 'preparing') return o.status === 'pending' || o.status === 'preparing';
                        return o.status === adminOrderTab;
                      }).length === 0 && (
                        <div className="text-center py-12 bg-white rounded-3xl border border-black/5">
                          <p className="text-black/40 font-medium">No {adminOrderTab} orders</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Top Customers Leaderboard */}
                  <section>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Trophy size={24} className="text-yellow-500" />
                        Top Customers
                      </h2>
                    </div>
                    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-black/5 bg-black/5">
                        <p className="text-xs font-black uppercase tracking-widest text-black/40">Most Completed Orders</p>
                      </div>
                      <div className="divide-y divide-black/5">
                        {topCustomers.length > 0 ? topCustomers.map((customer, idx) => (
                          <div key={idx} className="p-6 flex items-center justify-between hover:bg-black/[0.02] transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm",
                                idx === 0 ? "bg-yellow-100 text-yellow-700" :
                                idx === 1 ? "bg-slate-100 text-slate-700" :
                                idx === 2 ? "bg-orange-100 text-orange-700" : "bg-black/5 text-black/40"
                              )}>
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-bold text-lg">{customer.name}</p>
                                <p className="text-xs text-black/40 font-medium">{customer.phone}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-emerald-600">{customer.count}</p>
                              <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">Orders</p>
                            </div>
                          </div>
                        )) : (
                          <div className="p-12 text-center text-black/40 font-medium">
                            No completed orders yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Menu Management */}
                  <section>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Utensils size={24} />
                        Menu Control
                      </h2>
                      <button 
                        onClick={() => {
                          setEditingMeal({ name: '', description: '', price: 0, category: 'Main', status: 'available' });
                          setShowMealModal(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700"
                      >
                        <Plus size={16} />
                        Add Meal
                      </button>
                    </div>
                    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden mb-12">
                      <table className="w-full text-left">
                        <thead className="bg-black/5 text-[10px] font-black uppercase tracking-widest text-black/40">
                          <tr>
                            <th className="px-6 py-4">Item</th>
                            <th className="px-6 py-4">Price</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {meals.map(meal => (
                            <tr key={meal.id} className="group">
                              <td className="px-6 py-4">
                                <p className="font-bold">{meal.name}</p>
                                <p className="text-xs text-black/40">{meal.category}</p>
                              </td>
                              <td className="px-6 py-4 font-medium">${meal.price.toFixed(2)}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                                  meal.status === 'available' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                )}>
                                  {meal.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-3">
                                  <button onClick={() => { setEditingMeal(meal); setShowMealModal(true); }} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
                                  <button onClick={() => deleteMeal(meal.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Feedback Section */}
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                      <MessageSquare size={24} />
                      Customer Feedback
                    </h2>
                    <div className="space-y-4">
                      {feedbackList.map(feedback => (
                        <div key={feedback.id} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  size={14} 
                                  className={cn(i < feedback.rating ? "text-yellow-400 fill-yellow-400" : "text-black/10")} 
                                />
                              ))}
                            </div>
                            <span className="text-xs text-black/40">{new Date(feedback.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm font-medium mb-2">"{feedback.comment}"</p>
                          <p className="text-[10px] text-black/30 font-bold uppercase tracking-tighter">Order #{feedback.order_id}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">Change Portal Password</h2>
                  <button onClick={() => setShowChangePasswordModal(false)} className="p-2 hover:bg-black/5 rounded-full">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleChangeStaffPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-black/40">Current Password</label>
                    <input 
                      type="password"
                      required
                      value={formerPassword}
                      onChange={(e) => setFormerPassword(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border border-black/10 focus:border-emerald-500 outline-none transition-all font-medium"
                      placeholder="Enter former password"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-black/40">New Password</label>
                    <input 
                      type="password"
                      required
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border border-black/10 focus:border-emerald-500 outline-none transition-all font-medium"
                      placeholder="Enter new password"
                    />
                  </div>
                  <button 
                    disabled={isChangingPassword}
                    className="w-full py-4 rounded-2xl bg-black text-white font-bold hover:bg-emerald-600 transition-all disabled:opacity-50"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Meal Modal */}
      <AnimatePresence>
        {showMealModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMealModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
              <h3 className="text-2xl font-bold mb-6">{editingMeal?.id ? 'Edit Meal' : 'Add New Meal'}</h3>
              <form onSubmit={saveMeal} className="space-y-4">
                <input 
                  type="text" placeholder="Meal Name" required
                  value={editingMeal?.name || ''}
                  onChange={(e) => setEditingMeal({ ...editingMeal, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 outline-none focus:border-emerald-500"
                />
                <textarea 
                  placeholder="Description"
                  value={editingMeal?.description || ''}
                  onChange={(e) => setEditingMeal({ ...editingMeal, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 outline-none focus:border-emerald-500 h-24 resize-none"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="number" step="0.01" placeholder="Price" required
                    value={editingMeal?.price || ''}
                    onChange={(e) => setEditingMeal({ ...editingMeal, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 outline-none focus:border-emerald-500"
                  />
                  <select 
                    value={editingMeal?.category || 'Main'}
                    onChange={(e) => setEditingMeal({ ...editingMeal, category: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 outline-none focus:border-emerald-500"
                  >
                    <option>Main</option>
                    <option>Vegetarian</option>
                    <option>Drinks</option>
                    <option>Sides</option>
                  </select>
                </div>
                <button className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all">
                  Save Meal
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFeedbackModal(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">How was your meal?</h3>
                <button onClick={() => setShowFeedbackModal(null)} className="text-black/20 hover:text-black"><X size={24} /></button>
              </div>
              <div className="space-y-8">
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setRating(s)} className="transition-transform active:scale-90">
                      <Star size={40} className={cn("transition-colors", s <= rating ? "text-yellow-400 fill-yellow-400" : "text-black/10")} />
                    </button>
                  ))}
                </div>
                <textarea 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What can we improve?"
                  className="w-full h-32 p-4 rounded-2xl border border-black/10 focus:border-emerald-500 outline-none transition-all resize-none font-medium"
                />
                <button onClick={submitFeedback} className="w-full py-4 rounded-2xl bg-black text-white font-bold text-lg hover:bg-emerald-600 transition-all">
                  Submit Feedback
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAuthModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h3>
                <button onClick={() => setShowAuthModal(false)} className="text-black/20 hover:text-black"><X size={24} /></button>
              </div>
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Username</label>
                  <input 
                    type="text" required
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:border-emerald-500 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black/40">Password</label>
                  <input 
                    type="password" required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:border-emerald-500 outline-none transition-all font-medium"
                  />
                </div>
                <button 
                  disabled={isAuthLoading}
                  className="w-full py-4 rounded-2xl bg-black text-white font-bold text-lg hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {isAuthLoading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Register'}
                </button>
                <p className="text-center text-sm text-black/40">
                  {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                  <button 
                    type="button"
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    className="ml-1 text-emerald-600 font-bold hover:underline"
                  >
                    {authMode === 'login' ? 'Register' : 'Login'}
                  </button>
                </p>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Mobile Cart Button */}
      {portal === 'customer' && cart.length > 0 && (
        <div className="fixed bottom-6 left-6 right-6 z-40 md:hidden">
          <button 
            onClick={() => {
              const cartElement = document.getElementById('cart-section');
              if (cartElement) {
                cartElement.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl shadow-2xl flex items-center justify-between px-6 font-bold animate-bounce"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <ShoppingBag size={20} />
              </div>
              <span>View Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            </div>
            <span>${cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Order Success Modal */}
      <AnimatePresence>
        {showOrderSuccessModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] p-10 text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500" />
              <div className="w-24 h-24 bg-emerald-100 rounded-[32px] flex items-center justify-center text-emerald-600 mx-auto mb-8">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-3xl font-black mb-4">Order Received!</h2>
              <p className="text-black/40 mb-8 font-medium leading-relaxed">
                Your order has been sent to the kitchen. We'll notify you here as soon as it's ready for collection!
              </p>
              <button 
                onClick={() => setShowOrderSuccessModal(false)}
                className="w-full py-5 rounded-2xl bg-emerald-600 text-white font-bold text-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                Great, thanks!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}
