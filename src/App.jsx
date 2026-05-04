import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { 
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from 'recharts';
import { 
  Home, TrendingUp, Wallet, Target, PieChart as PieIcon,
  Plus, Trash2, X, Check, AlertTriangle, Repeat, BarChart3, Crown, Gem, 
  Menu, Cloud, Loader2, Flame, Sparkles, Bot, Send, ArrowUpRight, ArrowDownRight,
  Lightbulb, Edit2, Save, Calendar, ChevronDown, LogOut, LogIn,
  Search, Sun, Moon, Download, FileSpreadsheet, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';

// ============ STATE ============
const initialState = { 
  incomes: [], 
  expenses: [], 
  recurringExpenses: [], 
  recurringIncomes: [],
  investments: [], 
  budgets: [], 
  goals: [], 
  customCategories: [],
  xp: 0, 
  streak: 0,
  theme: 'dark'
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_DATA': return { ...state, ...action.payload };
    case 'ADD_INCOME': return { ...state, incomes: [...state.incomes, action.payload], xp: state.xp + 10 };
    case 'EDIT_INCOME': return { ...state, incomes: state.incomes.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_INCOME': return { ...state, incomes: state.incomes.filter(i => i.id !== action.payload) };
    case 'ADD_EXPENSE': return { ...state, expenses: [...state.expenses, action.payload], xp: state.xp + 5 };
    case 'EDIT_EXPENSE': return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EXPENSE': return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };
    case 'ADD_RECURRING': return { ...state, recurringExpenses: [...state.recurringExpenses, action.payload] };
    case 'EDIT_RECURRING': return { ...state, recurringExpenses: state.recurringExpenses.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_RECURRING': return { ...state, recurringExpenses: state.recurringExpenses.filter(e => e.id !== action.payload) };
    case 'ADD_RECURRING_INCOME': return { ...state, recurringIncomes: [...(state.recurringIncomes || []), action.payload] };
    case 'EDIT_RECURRING_INCOME': return { ...state, recurringIncomes: (state.recurringIncomes || []).map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_RECURRING_INCOME': return { ...state, recurringIncomes: (state.recurringIncomes || []).filter(r => r.id !== action.payload) };
    case 'TOGGLE_THEME': return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };
    case 'ADD_INVESTMENT': return { ...state, investments: [...state.investments, action.payload], xp: state.xp + 15 };
    case 'EDIT_INVESTMENT': return { ...state, investments: state.investments.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_INVESTMENT': return { ...state, investments: state.investments.filter(i => i.id !== action.payload) };
    case 'ADD_BUDGET': return { ...state, budgets: [...state.budgets, action.payload] };
    case 'EDIT_BUDGET': return { ...state, budgets: state.budgets.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'DELETE_BUDGET': return { ...state, budgets: state.budgets.filter(b => b.id !== action.payload) };
    case 'ADD_CUSTOM_CATEGORY': return { ...state, customCategories: [...state.customCategories, action.payload] };
    case 'DELETE_CUSTOM_CATEGORY': return { ...state, customCategories: state.customCategories.filter(c => c.name !== action.payload) };
    case 'ADD_GOAL': return { ...state, goals: [...state.goals, action.payload], xp: state.xp + 20 };
    case 'EDIT_GOAL': return { ...state, goals: state.goals.map(g => g.id === action.payload.id ? action.payload : g) };
    case 'CONTRIBUTE_GOAL': return { 
      ...state, 
      goals: state.goals.map(g => g.id === action.payload.id ? { 
        ...g, 
        currentAmount: g.currentAmount + action.payload.amount,
        contributions: [...(g.contributions || []), { amount: action.payload.amount, date: new Date().toISOString() }]
      } : g), 
      xp: state.xp + 25 
    };
    case 'DELETE_GOAL': return { ...state, goals: state.goals.filter(g => g.id !== action.payload) };
    default: return state;
  }
}

// ============ UTILITIES ============
const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);
const generateId = () => Math.random().toString(36).substr(2, 9);

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍔', color: '#F59E0B' },
  { name: 'Transport', icon: '🚗', color: '#3B82F6' },
  { name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { name: 'Bills', icon: '📄', color: '#EF4444' },
  { name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
  { name: 'Health', icon: '💊', color: '#10B981' },
  { name: 'Education', icon: '📚', color: '#6366F1' },
  { name: 'Other', icon: '📦', color: '#6B7280' },
];

const INVESTMENT_TYPES = [
  { name: 'Mutual Funds', icon: '📈', color: '#8B5CF6' },
  { name: 'Stocks', icon: '📊', color: '#3B82F6' },
  { name: 'Fixed Deposit', icon: '🏦', color: '#10B981' },
  { name: 'PPF', icon: '🏛️', color: '#F59E0B' },
  { name: 'Gold', icon: '🥇', color: '#EAB308' },
  { name: 'Crypto', icon: '₿', color: '#F97316' },
];

const PRESET_GOALS = [
  { name: 'Emergency Fund', icon: '🛡️', description: '3-6 months of expenses' },
  { name: 'Dream Vacation', icon: '✈️', description: 'Travel the world' },
  { name: 'International Trip', icon: '🌍', description: 'Explore new countries' },
  { name: 'New Car', icon: '🚗', description: 'Your dream car' },
  { name: 'Bike', icon: '🏍️', description: 'Two-wheeler' },
  { name: 'Scooter', icon: '🛵', description: 'Daily commute' },
  { name: 'House Down Payment', icon: '🏠', description: 'Your own home' },
  { name: 'Home Renovation', icon: '🔨', description: 'Upgrade your space' },
  { name: 'Higher Studies', icon: '🎓', description: 'Masters/PhD' },
  { name: 'Course/Certification', icon: '📜', description: 'Skill upgrade' },
  { name: 'Wedding Fund', icon: '💍', description: 'Big day savings' },
  { name: 'New Laptop', icon: '💻', description: 'Work & play' },
  { name: 'iPhone', icon: '📱', description: 'Latest smartphone' },
  { name: 'Gaming Setup', icon: '🎮', description: 'Ultimate gaming' },
  { name: 'Early Retirement', icon: '🏖️', description: 'Financial freedom' },
  { name: 'Retirement Corpus', icon: '👴', description: 'Golden years' },
  { name: 'Start a Business', icon: '🚀', description: 'Be your own boss' },
  { name: 'Investment Corpus', icon: '💰', description: 'Wealth building' },
];

// ============ HELPER: Get all categories ============
const getCategories = (customCategories = []) => {
  return [...DEFAULT_CATEGORIES, ...customCategories];
};

// ============ EXPORT UTILITIES ============
const exportToExcel = (state) => {
  const wb = XLSX.utils.book_new();

  // Income sheet
  const incomeData = state.incomes.map(i => ({
    Month: new Date(i.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    Source: i.source,
    Amount: Number(i.amount)
  }));
  // Recurring Income sheet
  const recIncomeData = (state.recurringIncomes || []).map(r => ({
    Name: r.name, Source: r.source, Amount: Number(r.amount), Frequency: 'Monthly'
  }));
  // Expenses sheet
  const expenseData = state.expenses.map(e => ({
    Date: new Date(e.date).toLocaleDateString('en-IN'),
    Category: e.category,
    Description: e.merchant || '',
    Amount: Number(e.amount)
  }));
  // Recurring Expenses
  const recExpData = state.recurringExpenses.map(r => ({
    Name: r.name, Category: r.category, Amount: Number(r.amount), Frequency: 'Monthly'
  }));
  // Investments
  const invData = state.investments.map(i => ({
    Date: new Date(i.date).toLocaleDateString('en-IN'),
    Type: i.type, Name: i.name || '', Amount: Number(i.amount)
  }));
  // Goals
  const goalData = state.goals.map(g => ({
    Name: g.name, Target: Number(g.targetAmount),
    Saved: Number(g.currentAmount),
    Progress: `${Math.round((g.currentAmount / g.targetAmount) * 100)}%`,
    Deadline: g.deadline || ''
  }));

  if (incomeData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeData), 'Income');
  if (recIncomeData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recIncomeData), 'Recurring Income');
  if (expenseData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseData), 'Expenses');
  if (recExpData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recExpData), 'Recurring Expenses');
  if (invData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), 'Investments');
  if (goalData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalData), 'Goals');

  XLSX.writeFile(wb, `FinTracker_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
};

const exportToPDF = (state) => {
  const doc = new jsPDF();
  const balances = calculateBalances(state);
  const cm = getCurrentMonth();

  doc.setFontSize(20);
  doc.setTextColor(139, 92, 246);
  doc.text('FinTracker Report', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 28);

  // Summary
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text('Monthly Summary', 14, 40);
  doc.autoTable({
    startY: 44,
    head: [['Metric', 'Amount']],
    body: [
      ['Monthly Income', formatCurrency(balances.monthlyIncome)],
      ['Monthly Expenses', formatCurrency(balances.monthlyExpenses + balances.monthlyRecurring)],
      ['Monthly Investments', formatCurrency(balances.monthlyInvestments)],
      ['Available Balance', formatCurrency(balances.monthlyAvailable)],
      ['Total Portfolio', formatCurrency(balances.totalInvestments)],
    ],
    theme: 'striped', headStyles: { fillColor: [139, 92, 246] }
  });

  // Income
  if (state.incomes.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Month', 'Source', 'Amount']],
      body: state.incomes.sort((a,b) => b.month.localeCompare(a.month)).slice(0,20).map(i => [
        new Date(i.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        i.source, formatCurrency(i.amount)
      ]),
      title: 'Income', didDrawPage: (d) => { doc.text('Income', 14, d.settings.startY - 3); },
      theme: 'striped', headStyles: { fillColor: [16, 185, 129] }
    });
  }

  // Expenses
  if (state.expenses.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Date', 'Category', 'Description', 'Amount']],
      body: state.expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,20).map(e => [
        new Date(e.date).toLocaleDateString('en-IN'), e.category, e.merchant || '', formatCurrency(e.amount)
      ]),
      theme: 'striped', headStyles: { fillColor: [239, 68, 68] }
    });
  }

  // Goals
  if (state.goals.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Goal', 'Target', 'Saved', 'Progress']],
      body: state.goals.map(g => [
        g.name, formatCurrency(g.targetAmount), formatCurrency(g.currentAmount),
        `${Math.round((g.currentAmount / g.targetAmount) * 100)}%`
      ]),
      theme: 'striped', headStyles: { fillColor: [139, 92, 246] }
    });
  }

  doc.save(`FinTracker_Report_${new Date().toISOString().slice(0,10)}.pdf`);
};

// ============ SEARCH COMPONENT ============
const SearchBar = ({ value, onChange, placeholder = 'Search...' }) => (
  <div className="relative">
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 pl-9 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
    />
    {value && (
      <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
        <X size={14} />
      </button>
    )}
  </div>
);

// ============ EXPORT BUTTON COMPONENT ============
const ExportButtons = ({ state }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl font-medium flex items-center gap-2 border border-white/10 transition-all text-sm"
      >
        <Download size={16} /> Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
          <button
            onClick={() => { exportToExcel(state); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-white text-sm transition-all"
          >
            <FileSpreadsheet size={16} className="text-green-400" /> Excel (.xlsx)
          </button>
          <button
            onClick={() => { exportToPDF(state); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-white text-sm transition-all border-t border-white/10"
          >
            <FileText size={16} className="text-red-400" /> PDF Report
          </button>
        </div>
      )}
    </div>
  );
};

// ============ COMPONENTS ============
const Toast = ({ message, show }) => show ? (
  <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-2 animate-pulse">
    <Check size={18} /><span className="font-medium">{message}</span>
  </div>
) : null;

const Modal = ({ isOpen, onClose, title, children }) => isOpen ? (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
    <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 w-full max-w-md border border-white/10 shadow-2xl max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={20} className="text-gray-400" /></button>
      </div>
      {children}
    </div>
  </div>
) : null;

const Card = ({ children, className = '', glow = false }) => (
  <div className={`bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl p-4 md:p-5 border border-white/10 backdrop-blur-xl hover:border-purple-500/30 transition-all duration-300 ${glow ? 'shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/20' : ''} ${className}`}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, color, change, trend }) => (
  <Card className="group hover:scale-[1.02] transition-all">
    <div className="flex items-start justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-gray-400 text-xs md:text-sm mb-1 truncate">{title}</p>
        <p className={`text-lg md:text-2xl font-bold truncate ${color}`}>{value}</p>
        {change && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change}
          </p>
        )}
      </div>
      <div className={`p-2 md:p-3 rounded-xl flex-shrink-0 ml-2 bg-gradient-to-br ${color === 'text-green-400' ? 'from-green-500/20 to-emerald-500/20' : color === 'text-red-400' ? 'from-red-500/20 to-orange-500/20' : color === 'text-cyan-400' ? 'from-cyan-500/20 to-blue-500/20' : 'from-purple-500/20 to-pink-500/20'}`}>
        <Icon size={20} className={color} />
      </div>
    </div>
  </Card>
);

const ProgressRing = ({ progress, size = 100, color = '#8B5CF6' }) => {
  const r = (size - 10) / 2, c = r * 2 * Math.PI, o = c - (Math.min(100, progress) / 100) * c;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10} strokeDasharray={c} strokeDashoffset={o} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${color})` }} className="transition-all duration-1000" />
    </svg>
  );
};

const DateInput = ({ value, onChange, label }) => (
  <div className="w-full">
    {label && <label className="text-sm text-gray-400 block mb-2">{label}</label>}
    <div className="relative">
      <input 
        type="date" 
        value={value} 
        onChange={onChange}
        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 pr-10 text-white focus:outline-none focus:border-purple-500 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        style={{ colorScheme: 'dark' }}
      />
      <Calendar size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  </div>
);

const MonthInput = ({ value, onChange, label }) => (
  <div className="w-full">
    {label && <label className="text-sm text-gray-400 block mb-2">{label}</label>}
    <div className="relative">
      <input 
        type="month" 
        value={value} 
        onChange={onChange}
        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 pr-10 text-white focus:outline-none focus:border-purple-500 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        style={{ colorScheme: 'dark' }}
      />
      <Calendar size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  </div>
);

// ============ BALANCE CALCULATION HELPER ============
const calculateBalances = (state) => {
  const cm = getCurrentMonth();
  
  // Monthly calculations
  const monthlyIncome = state.incomes.filter(i => i.month === cm).reduce((s, i) => s + Number(i.amount), 0);
  const monthlyExpenses = state.expenses.filter(e => e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0);
  const monthlyRecurring = state.recurringExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const monthlyInvestments = state.investments.filter(i => i.date?.startsWith(cm)).reduce((s, i) => s + Number(i.amount), 0);
  const monthlyGoalContributions = state.goals.flatMap(g => g.contributions || []).filter(c => c.date?.startsWith(cm)).reduce((s, c) => s + Number(c.amount), 0);
  
  const monthlyAvailable = monthlyIncome - monthlyExpenses - monthlyRecurring - monthlyInvestments - monthlyGoalContributions;
  
  // Overall calculations
  const totalIncome = state.incomes.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = state.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalRecurring = state.recurringExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalInvestments = state.investments.reduce((s, i) => s + Number(i.amount), 0);
  const totalGoalContributions = state.goals.reduce((s, g) => s + Number(g.currentAmount || 0), 0);
  
  const overallAvailable = totalIncome - totalExpenses - totalInvestments - totalGoalContributions;
  
  return {
    monthlyIncome,
    monthlyExpenses,
    monthlyRecurring,
    monthlyInvestments,
    monthlyGoalContributions,
    monthlyAvailable,
    totalIncome,
    totalExpenses,
    totalInvestments,
    totalGoalContributions,
    overallAvailable
  };
};

// ============ DASHBOARD ============
const Dashboard = ({ state }) => {
  const cm = getCurrentMonth();
  const pm = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
  const balances = calculateBalances(state);
  const CATEGORIES = getCategories(state.customCategories);
  
  const pmi = state.incomes.filter(i => i.month === pm).reduce((s, i) => s + Number(i.amount), 0);
  const pme = state.expenses.filter(e => e.date?.startsWith(pm)).reduce((s, e) => s + Number(e.amount), 0);
  const incomeChange = pmi > 0 ? ((balances.monthlyIncome - pmi) / pmi * 100).toFixed(0) : 0;
  const expenseChange = pme > 0 ? ((balances.monthlyExpenses - pme) / pme * 100).toFixed(0) : 0;
  
  const ebc = CATEGORIES.map(c => ({ name: c.name, value: state.expenses.filter(e => e.category === c.name && e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0), color: c.color })).filter(c => c.value > 0);
  
  const l6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
  const td = l6.map(m => ({ 
    month: new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' }), 
    income: state.incomes.filter(i => i.month === m).reduce((s, i) => s + Number(i.amount), 0), 
    expenses: state.expenses.filter(e => e.date?.startsWith(m)).reduce((s, e) => s + Number(e.amount), 0)
  }));
  
  const sr = balances.monthlyIncome > 0 ? ((balances.monthlyIncome - balances.monthlyExpenses - balances.monthlyRecurring) / balances.monthlyIncome) * 100 : 0;
  const hs = Math.min(100, Math.max(0, Math.round(sr * 2)));
  
  const investmentData = INVESTMENT_TYPES.map(t => ({
    name: t.name,
    value: state.investments.filter(i => i.type === t.name).reduce((s, i) => s + Number(i.amount), 0),
    color: t.color
  })).filter(i => i.value > 0);
  
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Export */}
      <div className="flex justify-end"><ExportButtons state={state} /></div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card glow className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-2xl" />
          <p className="text-gray-400 text-sm mb-1">Monthly Available</p>
          <p className={`text-2xl md:text-3xl font-bold ${balances.monthlyAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(balances.monthlyAvailable)}</p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="text-gray-400">In: <span className="text-green-400">{formatCurrency(balances.monthlyIncome)}</span></span>
            <span className="text-gray-400">Out: <span className="text-red-400">{formatCurrency(balances.monthlyExpenses + balances.monthlyRecurring)}</span></span>
            <span className="text-gray-400">Inv: <span className="text-cyan-400">{formatCurrency(balances.monthlyInvestments)}</span></span>
            <span className="text-gray-400">Goals: <span className="text-purple-400">{formatCurrency(balances.monthlyGoalContributions)}</span></span>
          </div>
        </Card>
        <Card glow className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-2xl" />
          <p className="text-gray-400 text-sm mb-1">Overall Available</p>
          <p className={`text-2xl md:text-3xl font-bold ${balances.overallAvailable >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{formatCurrency(balances.overallAvailable)}</p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="text-gray-400">Total In: <span className="text-green-400">{formatCurrency(balances.totalIncome)}</span></span>
            <span className="text-gray-400">Invested: <span className="text-cyan-400">{formatCurrency(balances.totalInvestments)}</span></span>
            <span className="text-gray-400">Goals: <span className="text-purple-400">{formatCurrency(balances.totalGoalContributions)}</span></span>
          </div>
        </Card>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Income" value={formatCurrency(balances.monthlyIncome)} icon={TrendingUp} color="text-green-400" change={`${incomeChange}%`} trend={Number(incomeChange) >= 0 ? 'up' : 'down'} />
        <StatCard title="Expenses" value={formatCurrency(balances.monthlyExpenses + balances.monthlyRecurring)} icon={Wallet} color="text-red-400" change={`${expenseChange}%`} trend={Number(expenseChange) <= 0 ? 'up' : 'down'} />
        <StatCard title="Invested" value={formatCurrency(balances.totalInvestments)} icon={BarChart3} color="text-cyan-400" />
        <StatCard title="Goals" value={state.goals.length.toString()} icon={Target} color="text-purple-400" />
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" /> Income vs Expenses Trend
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={td}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" tickFormatter={v => '₹' + (v/1000) + 'k'} fontSize={12} />
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} formatter={v => formatCurrency(v)} />
              <Area type="monotone" dataKey="income" stroke="#10B981" fill="url(#incomeGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" stroke="#EF4444" fill="url(#expenseGrad)" strokeWidth={2} />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        
        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-400" /> Health Score
          </h3>
          <div className="flex flex-col items-center">
            <div className="relative">
              <ProgressRing progress={hs} size={130} color={hs > 60 ? '#10B981' : hs > 30 ? '#F59E0B' : '#EF4444'} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white">{hs}</span>
                <span className="text-xs text-gray-400">/ 100</span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-white">
                {hs > 60 ? '🎉 Excellent!' : hs > 30 ? '⚠️ Can improve' : '🚨 Needs attention'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Savings rate: {sr.toFixed(0)}%</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <PieIcon size={18} className="text-pink-400" /> Expense Breakdown
          </h3>
          {ebc.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={160} className="sm:w-1/2">
                <PieChart>
                  <Pie data={ebc} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                    {ebc.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 w-full">
                {ebc.slice(0, 4).map(c => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      <span className="text-gray-300 truncate">{c.name}</span>
                    </div>
                    <span className="text-white font-medium">{formatCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-gray-500">No expenses this month</div>
          )}
        </Card>
        
        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-cyan-400" /> Investment Allocation
          </h3>
          {investmentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={investmentData} layout="vertical">
                <XAxis type="number" tickFormatter={v => '₹' + (v/1000) + 'k'} stroke="#6B7280" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#6B7280" fontSize={11} width={80} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {investmentData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-gray-500">No investments yet</div>
          )}
        </Card>
      </div>
      
      {/* Goals Progress */}
      {state.goals.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Target size={18} className="text-purple-400" /> Goals Progress
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.goals.slice(0, 3).map(g => {
              const p = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
              return (
                <div key={g.id} className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl">{g.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{g.name}</p>
                    <div className="h-2 bg-white/10 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${Math.min(100, p)}%` }} />
                    </div>
                    <p className="text-gray-400 text-xs mt-1">{Math.round(p)}% • {formatCurrency(g.currentAmount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

// ============ INCOME ============
const Income = ({ state, dispatch, showToast }) => {
  const [show, setShow] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editRecItem, setEditRecItem] = useState(null);
  const [amt, setAmt] = useState('');
  const [src, setSrc] = useState('Salary');
  const [mon, setMon] = useState(getCurrentMonth());
  const [search, setSearch] = useState('');
  // Recurring income form
  const [rn, setRn] = useState('');
  const [ra, setRa] = useState('');
  const [rs, setRs] = useState('Salary');

  const openEdit = (item) => { setEditItem(item); setAmt(item.amount.toString()); setSrc(item.source); setMon(item.month); setShow(true); };
  const openAdd = () => { setEditItem(null); setAmt(''); setSrc('Salary'); setMon(getCurrentMonth()); setShow(true); };
  const openEditRec = (item) => { setEditRecItem(item); setRn(item.name); setRa(item.amount.toString()); setRs(item.source); setShowRec(true); };
  const openAddRec = () => { setEditRecItem(null); setRn(''); setRa(''); setRs('Salary'); setShowRec(true); };

  const save = () => {
    const n = Number(amt);
    if (!amt || n <= 0) return alert('Enter valid amount');
    if (editItem) {
      dispatch({ type: 'EDIT_INCOME', payload: { ...editItem, amount: n, source: src, month: mon } });
      showToast('Income updated!');
    } else {
      dispatch({ type: 'ADD_INCOME', payload: { id: generateId(), amount: n, source: src, month: mon } });
      showToast('Income added!');
    }
    setShow(false); setEditItem(null);
  };

  const saveRec = () => {
    const n = Number(ra);
    if (!rn || !ra || n <= 0) return alert('Fill all fields');
    if (editRecItem) {
      dispatch({ type: 'EDIT_RECURRING_INCOME', payload: { ...editRecItem, name: rn, amount: n, source: rs } });
      showToast('Recurring income updated!');
    } else {
      dispatch({ type: 'ADD_RECURRING_INCOME', payload: { id: generateId(), name: rn, amount: n, source: rs, frequency: 'monthly' } });
      showToast('Recurring income added!');
    }
    setShowRec(false); setEditRecItem(null);
  };

  const recurringIncomes = state.recurringIncomes || [];
  const mi = state.incomes.reduce((a, i) => { a[i.month] = (a[i.month] || 0) + Number(i.amount); return a; }, {});
  const chartData = Object.entries(mi).sort().slice(-6).map(([m, t]) => ({
    month: new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' }),
    amount: t
  }));

  const filteredIncomes = state.incomes.filter(i =>
    i.source.toLowerCase().includes(search.toLowerCase()) ||
    new Date(i.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-white">Income</h2>
        <div className="flex gap-2">
          <button onClick={openAddRec} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl font-medium flex items-center gap-2 border border-white/10 transition-all text-sm"><Repeat size={16} /> Recurring</button>
          <button onClick={openAdd} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all text-sm">
            <Plus size={18} /> Add
          </button>
        </div>
      </div>

      {/* Recurring Income */}
      {recurringIncomes.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Repeat size={18} className="text-green-400" /> Recurring Income</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recurringIncomes.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl group hover:bg-white/10 transition-all">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{r.name}</p>
                  <p className="text-gray-400 text-xs">{r.source} • Monthly</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <p className="text-green-400 font-bold text-sm">{formatCurrency(r.amount)}</p>
                  <button onClick={() => openEditRec(r)} className="p-1 hover:bg-blue-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} className="text-blue-400" /></button>
                  <button onClick={() => dispatch({ type: 'DELETE_RECURRING_INCOME', payload: r.id })} className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-sm">
            <span className="text-gray-400">Total monthly recurring</span>
            <span className="text-green-400 font-bold">{formatCurrency(recurringIncomes.reduce((s, r) => s + Number(r.amount), 0))}</span>
          </div>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-4">Income Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" tickFormatter={v => '₹' + (v/1000) + 'k'} fontSize={12} />
              <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="amount" fill="url(#greenGrad)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(mi).sort().reverse().slice(0, 6).map(([m, t]) => (
          <Card key={m} className="hover:scale-[1.02] transition-all">
            <p className="text-gray-400 text-xs">{new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
            <p className="text-xl font-bold text-green-400 mt-1">{formatCurrency(t)}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-white font-semibold">History</h3>
          <div className="w-full sm:w-64"><SearchBar value={search} onChange={setSearch} placeholder="Search income..." /></div>
        </div>
        <div className="space-y-2">
          {filteredIncomes.length === 0 && <p className="text-gray-500 text-center py-8">{search ? 'No results found' : 'No income yet'}</p>}
          {filteredIncomes.sort((a, b) => b.month.localeCompare(a.month)).map(i => (
            <div key={i.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl group hover:bg-white/10 transition-all">
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium truncate">{i.source}</p>
                <p className="text-gray-400 text-sm">{new Date(i.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <p className="text-green-400 font-bold">{formatCurrency(i.amount)}</p>
                <button onClick={() => openEdit(i)} className="p-1.5 hover:bg-blue-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} className="text-blue-400" /></button>
                <button onClick={() => dispatch({ type: 'DELETE_INCOME', payload: i.id })} className="p-1.5 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal isOpen={show} onClose={() => { setShow(false); setEditItem(null); }} title={editItem ? "Edit Income" : "Add Income"}>
        <div className="space-y-4">
          <div><label className="text-sm text-gray-400 block mb-2">Amount (₹)</label><input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="50000" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" /></div>
          <div><label className="text-sm text-gray-400 block mb-2">Source</label><select value={src} onChange={e => setSrc(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500">{['Salary', 'Freelance', 'Business', 'Investment', 'Other'].map(s => <option key={s} value={s} className="bg-slate-800">{s}</option>)}</select></div>
          <MonthInput value={mon} onChange={e => setMon(e.target.value)} label="Month" />
          <button onClick={save} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all">
            {editItem ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add</>}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showRec} onClose={() => { setShowRec(false); setEditRecItem(null); }} title={editRecItem ? "Edit Recurring Income" : "Add Recurring Income"}>
        <div className="space-y-4">
          <div><label className="text-sm text-gray-400 block mb-2">Name</label><input type="text" value={rn} onChange={e => setRn(e.target.value)} placeholder="Monthly Salary, Rent Income..." className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <div><label className="text-sm text-gray-400 block mb-2">Source</label><select value={rs} onChange={e => setRs(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:outline-none">{['Salary', 'Freelance', 'Business', 'Rental', 'Investment', 'Other'].map(s => <option key={s} value={s} className="bg-slate-800">{s}</option>)}</select></div>
          <div><label className="text-sm text-gray-400 block mb-2">Amount (₹)</label><input type="number" value={ra} onChange={e => setRa(e.target.value)} placeholder="50000" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <button onClick={saveRec} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">
            {editRecItem ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add</>}
          </button>
        </div>
      </Modal>
    </div>
  );
};

// ============ EXPENSES ============
const Expenses = ({ state, dispatch, showToast }) => {
  const [show, setShow] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editRecItem, setEditRecItem] = useState(null);
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState('Food');
  const [mer, setMer] = useState('');
  const [dat, setDat] = useState(new Date().toISOString().split('T')[0]);
  const [rn, setRn] = useState('');
  const [ra, setRa] = useState('');
  const [rc, setRc] = useState('Bills');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  
  const CATEGORIES = getCategories(state.customCategories);
  
  const openEdit = (item) => { setEditItem(item); setAmt(item.amount.toString()); setCat(item.category); setMer(item.merchant || ''); setDat(item.date); setShow(true); };
  const openAdd = () => { setEditItem(null); setAmt(''); setCat('Food'); setMer(''); setDat(new Date().toISOString().split('T')[0]); setShow(true); };
  const openEditRec = (item) => { setEditRecItem(item); setRn(item.name); setRa(item.amount.toString()); setRc(item.category); setShowRec(true); };
  const openAddRec = () => { setEditRecItem(null); setRn(''); setRa(''); setRc('Bills'); setShowRec(true); };
  
  const save = () => {
    const n = Number(amt);
    if (!amt || n <= 0) return alert('Enter valid amount');
    if (editItem) {
      dispatch({ type: 'EDIT_EXPENSE', payload: { ...editItem, amount: n, category: cat, merchant: mer, date: dat } });
      showToast('Expense updated!');
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload: { id: generateId(), amount: n, category: cat, merchant: mer, date: dat } });
      showToast('Expense added!');
    }
    setShow(false); setEditItem(null);
  };
  
  const saveRec = () => {
    const n = Number(ra);
    if (!rn || !ra || n <= 0) return alert('Fill all fields');
    if (editRecItem) {
      dispatch({ type: 'EDIT_RECURRING', payload: { ...editRecItem, name: rn, amount: n, category: rc } });
      showToast('Recurring updated!');
    } else {
      dispatch({ type: 'ADD_RECURRING', payload: { id: generateId(), name: rn, amount: n, category: rc, frequency: 'monthly' } });
      showToast('Recurring added!');
    }
    setShowRec(false); setEditRecItem(null);
  };
  
  const cm = getCurrentMonth();
  const categoryData = CATEGORIES.map(c => ({
    name: c.name,
    value: state.expenses.filter(e => e.category === c.name && e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0),
    icon: c.icon
  })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  const filteredExpenses = state.expenses.filter(e => {
    const matchSearch = !search || 
      (e.merchant || '').toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      formatCurrency(e.amount).includes(search);
    const matchCat = filterCat === 'All' || e.category === filterCat;
    return matchSearch && matchCat;
  });
  
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-white">Expenses</h2>
        <div className="flex gap-2">
          <button onClick={openAddRec} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl font-medium flex items-center gap-2 border border-white/10 transition-all text-sm"><Repeat size={16} /> Recurring</button>
          <button onClick={openAdd} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all text-sm"><Plus size={18} /> Add</button>
        </div>
      </div>
      
      {categoryData.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-4">This Month by Category</h3>
          <div className="space-y-3">
            {categoryData.map(c => {
              const total = categoryData.reduce((s, x) => s + x.value, 0);
              const pct = total > 0 ? (c.value / total) * 100 : 0;
              return (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-xl w-8">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white truncate">{c.name}</span>
                      <span className="text-gray-400 flex-shrink-0 ml-2">{formatCurrency(c.value)}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      
      {state.recurringExpenses.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Repeat size={18} className="text-orange-400" /> Recurring</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {state.recurringExpenses.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl group hover:bg-white/10 transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl flex-shrink-0">{CATEGORIES.find(c => c.name === e.category)?.icon || '📦'}</span>
                  <div className="min-w-0"><p className="text-white text-sm font-medium truncate">{e.name}</p><p className="text-gray-400 text-xs">Monthly</p></div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <p className="text-red-400 font-bold text-sm">{formatCurrency(e.amount)}</p>
                  <button onClick={() => openEditRec(e)} className="p-1 hover:bg-blue-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} className="text-blue-400" /></button>
                  <button onClick={() => dispatch({ type: 'DELETE_RECURRING', payload: e.id })} className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-white font-semibold">Transactions</h3>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <div className="flex-1 sm:w-48"><SearchBar value={search} onChange={setSearch} placeholder="Search expenses..." /></div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="bg-white/10 border border-white/20 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-purple-500">
              <option value="All" className="bg-slate-800">All Categories</option>
              {CATEGORIES.map(c => <option key={c.name} value={c.name} className="bg-slate-800">{c.icon} {c.name}</option>)}
            </select>
          </div>
        </div>
        {search || filterCat !== 'All' ? (
          <p className="text-gray-500 text-xs mb-2">{filteredExpenses.length} result{filteredExpenses.length !== 1 ? 's' : ''}</p>
        ) : null}
        <div className="space-y-2">
          {filteredExpenses.length === 0 && <p className="text-gray-500 text-center py-8">{search || filterCat !== 'All' ? 'No results found' : 'No expenses yet'}</p>}
          {filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => (
            <div key={e.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl group hover:bg-white/10 transition-all">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl flex-shrink-0">{CATEGORIES.find(c => c.name === e.category)?.icon || '📦'}</span>
                <div className="min-w-0"><p className="text-white text-sm font-medium truncate">{e.merchant || e.category}</p><p className="text-gray-400 text-xs">{formatDate(e.date)} • {e.category}</p></div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <p className="text-red-400 font-bold text-sm">{formatCurrency(e.amount)}</p>
                <button onClick={() => openEdit(e)} className="p-1 hover:bg-blue-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} className="text-blue-400" /></button>
                <button onClick={() => dispatch({ type: 'DELETE_EXPENSE', payload: e.id })} className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      
      <Modal isOpen={show} onClose={() => { setShow(false); setEditItem(null); }} title={editItem ? "Edit Expense" : "Add Expense"}>
        <div className="space-y-4">
          <div><label className="text-sm text-gray-400 block mb-2">Amount (₹)</label><input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="500" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <div><label className="text-sm text-gray-400 block mb-2">Category</label><select value={cat} onChange={e => setCat(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:outline-none">{CATEGORIES.map(c => <option key={c.name} value={c.name} className="bg-slate-800">{c.icon} {c.name}</option>)}</select></div>
          <div><label className="text-sm text-gray-400 block mb-2">Description</label><input type="text" value={mer} onChange={e => setMer(e.target.value)} placeholder="Swiggy..." className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <DateInput value={dat} onChange={e => setDat(e.target.value)} label="Date" />
          <button onClick={save} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">{editItem ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add</>}</button>
        </div>
      </Modal>
      
      <Modal isOpen={showRec} onClose={() => { setShowRec(false); setEditRecItem(null); }} title={editRecItem ? "Edit Recurring" : "Add Recurring"}>
        <div className="space-y-4">
          <div><label className="text-sm text-gray-400 block mb-2">Name</label><input type="text" value={rn} onChange={e => setRn(e.target.value)} placeholder="Netflix, Rent..." className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <div><label className="text-sm text-gray-400 block mb-2">Amount (₹)</label><input type="number" value={ra} onChange={e => setRa(e.target.value)} placeholder="500" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <div><label className="text-sm text-gray-400 block mb-2">Category</label><select value={rc} onChange={e => setRc(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:outline-none">{CATEGORIES.map(c => <option key={c.name} value={c.name} className="bg-slate-800">{c.icon} {c.name}</option>)}</select></div>
          <button onClick={saveRec} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">{editRecItem ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add</>}</button>
        </div>
      </Modal>
    </div>
  );
};

// ============ INVESTMENTS ============
const Investments = ({ state, dispatch, showToast }) => {
  const [show, setShow] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [type, setType] = useState('Mutual Funds');
  const [amt, setAmt] = useState('');
  const [name, setName] = useState('');
  const [dat, setDat] = useState(new Date().toISOString().split('T')[0]);
  
  const openEdit = (item) => { setEditItem(item); setType(item.type); setAmt(item.amount.toString()); setName(item.name || ''); setDat(item.date); setShow(true); };
  const openAdd = () => { setEditItem(null); setType('Mutual Funds'); setAmt(''); setName(''); setDat(new Date().toISOString().split('T')[0]); setShow(true); };
  
  const save = () => {
    const n = Number(amt);
    if (!amt || n <= 0) return alert('Enter valid amount');
    if (editItem) {
      dispatch({ type: 'EDIT_INVESTMENT', payload: { ...editItem, type, amount: n, name, date: dat } });
      showToast('Investment updated!');
    } else {
      dispatch({ type: 'ADD_INVESTMENT', payload: { id: generateId(), type, amount: n, name, date: dat } });
      showToast('Investment added!');
    }
    setShow(false); setEditItem(null);
  };
  
  const tbt = INVESTMENT_TYPES.map(t => ({ ...t, total: state.investments.filter(i => i.type === t.name).reduce((s, i) => s + Number(i.amount), 0) })).filter(t => t.total > 0);
  const ti = state.investments.reduce((s, i) => s + Number(i.amount), 0);
  
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-white">Investments</h2>
        <button onClick={openAdd} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all text-sm"><Plus size={18} /> Add</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card glow className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-2xl" />
          <h3 className="text-gray-400 text-sm mb-2">Total Portfolio</h3>
          <p className="text-3xl md:text-4xl font-bold text-cyan-400">{formatCurrency(ti)}</p>
          <p className="text-gray-400 text-sm mt-2">{state.investments.length} investments</p>
        </Card>
        
        {tbt.length > 0 && (
          <Card>
            <h3 className="text-white font-semibold mb-3">Allocation</h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={tbt} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="total">
                  {tbt.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
      
      <Card>
        <h3 className="text-white font-semibold mb-3">History</h3>
        <div className="space-y-2">
          {state.investments.length === 0 && <p className="text-gray-500 text-center py-8">No investments yet</p>}
          {state.investments.sort((a, b) => new Date(b.date) - new Date(a.date)).map(i => (
            <div key={i.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl group hover:bg-white/10 transition-all">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl flex-shrink-0">{INVESTMENT_TYPES.find(t => t.name === i.type)?.icon || '📈'}</span>
                <div className="min-w-0"><p className="text-white text-sm font-medium truncate">{i.name || i.type}</p><p className="text-gray-400 text-xs">{formatDate(i.date)}</p></div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <p className="text-cyan-400 font-bold text-sm">{formatCurrency(i.amount)}</p>
                <button onClick={() => openEdit(i)} className="p-1 hover:bg-blue-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} className="text-blue-400" /></button>
                <button onClick={() => dispatch({ type: 'DELETE_INVESTMENT', payload: i.id })} className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      
      <Modal isOpen={show} onClose={() => { setShow(false); setEditItem(null); }} title={editItem ? "Edit Investment" : "Add Investment"}>
        <div className="space-y-4">
          <div><label className="text-sm text-gray-400 block mb-2">Type</label><select value={type} onChange={e => setType(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:outline-none">{INVESTMENT_TYPES.map(t => <option key={t.name} value={t.name} className="bg-slate-800">{t.icon} {t.name}</option>)}</select></div>
          <div><label className="text-sm text-gray-400 block mb-2">Name (Optional)</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="HDFC..." className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <div><label className="text-sm text-gray-400 block mb-2">Amount (₹)</label><input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="10000" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <DateInput value={dat} onChange={e => setDat(e.target.value)} label="Date" />
          <button onClick={save} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">{editItem ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add</>}</button>
        </div>
      </Modal>
    </div>
  );
};

// ============ GOALS ============
const Goals = ({ state, dispatch, showToast }) => {
  const [show, setShow] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showC, setShowC] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sel, setSel] = useState(null);
  const [name, setName] = useState('');
  const [ta, setTa] = useState('');
  const [ca, setCa] = useState('0');
  const [dl, setDl] = useState('');
  const [ic, setIc] = useState('🎯');
  const [camt, setCamt] = useState('');
  const icons = ['🎯', '🏠', '🚗', '✈️', '💍', '📚', '💻', '🎓', '👶', '💰', '🏖️', '💎', '🛡️', '🏍️', '🛵', '🔨', '📜', '🎮', '🚀', '👴', '📱', '🌍'];
  
  const balances = calculateBalances(state);
  
  const openEdit = (item) => { setEditItem(item); setName(item.name); setTa(item.targetAmount.toString()); setCa(item.currentAmount.toString()); setDl(item.deadline || ''); setIc(item.icon); setShow(true); };
  const openAdd = () => { setEditItem(null); setName(''); setTa(''); setCa('0'); setDl(''); setIc('🎯'); setShow(true); };
  const selectPreset = (preset) => { setName(preset.name); setIc(preset.icon); setShowPresets(false); setShow(true); };
  
  const save = () => {
    const nt = Number(ta), nc = Number(ca) || 0;
    if (!name || !ta || nt <= 0) return alert('Fill required fields');
    if (editItem) {
      dispatch({ type: 'EDIT_GOAL', payload: { ...editItem, name, targetAmount: nt, currentAmount: nc, deadline: dl, icon: ic } });
      showToast('Goal updated!');
    } else {
      dispatch({ type: 'ADD_GOAL', payload: { id: generateId(), name, targetAmount: nt, currentAmount: nc, deadline: dl, icon: ic, contributions: [] } });
      showToast('Goal created!');
    }
    setShow(false); setEditItem(null);
  };
  
  const contribute = () => {
    const n = Number(camt);
    if (!camt || n <= 0) return alert('Enter valid amount');
    if (n > balances.monthlyAvailable && balances.monthlyAvailable > 0) {
      if (!confirm(`This exceeds your monthly available balance (${formatCurrency(balances.monthlyAvailable)}). Continue?`)) return;
    }
    dispatch({ type: 'CONTRIBUTE_GOAL', payload: { id: sel.id, amount: n } });
    setCamt(''); setShowC(false);
    showToast('Contribution added!');
  };
  
  const calculateMonthlyContribution = (goal) => {
    if (!goal.deadline) return null;
    const remaining = goal.targetAmount - goal.currentAmount;
    if (remaining <= 0) return 0;
    const today = new Date();
    const deadline = new Date(goal.deadline);
    const monthsLeft = Math.max(1, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24 * 30)));
    return Math.ceil(remaining / monthsLeft);
  };
  
  const totalGoals = state.goals.reduce((s, g) => s + Number(g.targetAmount), 0);
  const totalSaved = state.goals.reduce((s, g) => s + Number(g.currentAmount), 0);
  const overallProgress = totalGoals > 0 ? (totalSaved / totalGoals) * 100 : 0;
  
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-white">Goals</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowPresets(true)} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl font-medium flex items-center gap-2 border border-white/10 transition-all text-sm"><Sparkles size={16} /> Templates</button>
          <button onClick={openAdd} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all text-sm"><Plus size={18} /> Custom</button>
        </div>
      </div>
      
      {/* Available Balance Card */}
      <Card glow className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full blur-2xl" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-1">Available for Goals</p>
            <p className={`text-2xl md:text-3xl font-bold ${balances.monthlyAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(balances.monthlyAvailable)}</p>
            <p className="text-gray-400 text-xs mt-1">This month after all deductions</p>
          </div>
          <Wallet size={32} className="text-green-400/50" />
        </div>
      </Card>
      
      {/* Summary */}
      {state.goals.length > 0 && (
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Overall Progress</p>
              <p className="text-2xl md:text-3xl font-bold text-white">{formatCurrency(totalSaved)} <span className="text-lg text-gray-400">/ {formatCurrency(totalGoals)}</span></p>
              <p className="text-purple-400 text-sm mt-1">{overallProgress.toFixed(0)}% complete</p>
            </div>
            <div className="relative">
              <ProgressRing progress={overallProgress} size={70} color="#A855F7" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{Math.round(overallProgress)}%</span>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {state.goals.length === 0 ? (
        <Card><div className="text-center py-12"><Target size={48} className="mx-auto text-gray-600 mb-4" /><p className="text-gray-400">No goals yet. Create or choose from templates!</p></div></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {state.goals.map(g => {
            const p = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
            const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const monthlyNeeded = calculateMonthlyContribution(g);
            
            return (
              <Card key={g.id} className="group hover:scale-[1.01] transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl md:text-3xl flex-shrink-0">{g.icon}</span>
                    <div className="min-w-0">
                      <h4 className="text-white font-bold truncate">{g.name}</h4>
                      {daysLeft !== null && <p className={`text-xs ${daysLeft < 30 ? 'text-red-400' : 'text-gray-400'}`}>{daysLeft > 0 ? `${daysLeft} days left` : 'Deadline passed'}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(g)} className="p-1.5 hover:bg-blue-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} className="text-blue-400" /></button>
                    <button onClick={() => dispatch({ type: 'DELETE_GOAL', payload: g.id })} className="p-1.5 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                </div>
                
                <div className="flex items-center justify-center my-4">
                  <div className="relative">
                    <ProgressRing progress={p} size={90} color={p >= 100 ? '#10B981' : '#8B5CF6'} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-lg font-bold text-white">{Math.round(p)}%</span></div>
                  </div>
                </div>
                
                <div className="text-center mb-3">
                  <p className="text-white font-bold text-sm">{formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}</p>
                  <p className="text-gray-400 text-xs">Left: {formatCurrency(g.targetAmount - g.currentAmount)}</p>
                  {monthlyNeeded !== null && monthlyNeeded > 0 && (
                    <p className="text-purple-400 text-xs mt-1 flex items-center justify-center gap-1">
                      <TrendingUp size={12} /> {formatCurrency(monthlyNeeded)}/month needed
                    </p>
                  )}
                </div>
                
                <button onClick={() => { setSel(g); setShowC(true); }} disabled={p >= 100} className={`w-full py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-all text-sm ${p >= 100 ? 'bg-green-500/20 text-green-400' : 'bg-white/10 hover:bg-white/20 text-white'}`}>{p >= 100 ? <><Check size={16} /> Done!</> : <><Plus size={16} /> Contribute</>}</button>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Presets Modal */}
      <Modal isOpen={showPresets} onClose={() => setShowPresets(false)} title="Choose a Goal Template">
        <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {PRESET_GOALS.map(p => (
            <button key={p.name} onClick={() => selectPreset(p)} className="flex flex-col items-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-center">
              <span className="text-3xl mb-2">{p.icon}</span>
              <p className="text-white text-sm font-medium">{p.name}</p>
              <p className="text-gray-400 text-xs mt-1">{p.description}</p>
            </button>
          ))}
        </div>
      </Modal>
      
      {/* Create/Edit Goal Modal */}
      <Modal isOpen={show} onClose={() => { setShow(false); setEditItem(null); }} title={editItem ? "Edit Goal" : "Create Goal"}>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Icon</label>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {icons.map(i => <button key={i} onClick={() => setIc(i)} className={`text-xl p-2 rounded-lg transition-all ${ic === i ? 'bg-purple-500/30 ring-2 ring-purple-500' : 'hover:bg-white/10'}`}>{i}</button>)}
            </div>
          </div>
          <div><label className="text-sm text-gray-400 block mb-2">Goal Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Emergency Fund..." className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <div><label className="text-sm text-gray-400 block mb-2">Target Amount (₹)</label><input type="number" value={ta} onChange={e => setTa(e.target.value)} placeholder="500000" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <div><label className="text-sm text-gray-400 block mb-2">Already Saved (₹)</label><input type="number" value={ca} onChange={e => setCa(e.target.value)} placeholder="0" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <DateInput value={dl} onChange={e => setDl(e.target.value)} label="Deadline (for monthly calculation)" />
          <button onClick={save} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">{editItem ? <><Save size={18} /> Update</> : <><Plus size={18} /> Create</>}</button>
        </div>
      </Modal>
      
      {/* Contribute Modal */}
      <Modal isOpen={showC} onClose={() => setShowC(false)} title={`Contribute to ${sel?.name}`}>
        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-xl">
            <p className="text-gray-400 text-sm">Available Balance</p>
            <p className={`text-2xl font-bold ${balances.monthlyAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(balances.monthlyAvailable)}</p>
          </div>
          {sel && calculateMonthlyContribution(sel) && (
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <p className="text-purple-400 text-sm">💡 Suggested: {formatCurrency(calculateMonthlyContribution(sel))}/month to reach goal on time</p>
            </div>
          )}
          <div><label className="text-sm text-gray-400 block mb-2">Amount (₹)</label><input type="number" value={camt} onChange={e => setCamt(e.target.value)} placeholder="1000" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <button onClick={contribute} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"><Plus size={18} /> Contribute</button>
        </div>
      </Modal>
    </div>
  );
};

// ============ BUDGETS ============
const Budgets = ({ state, dispatch, showToast }) => {
  const [show, setShow] = useState(false);
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [cat, setCat] = useState('Food');
  const [lim, setLim] = useState('');
  const [mon, setMon] = useState(getCurrentMonth());
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');
  const [newCatColor, setNewCatColor] = useState('#8B5CF6');
  
  const cm = getCurrentMonth();
  const CATEGORIES = getCategories(state.customCategories);
  const categoryIcons = ['📌', '🏥', '🎁', '✂️', '🏋️', '🎨', '🐕', '📞', '🏦', '🎪', '☕', '🍕', '🎵', '📰', '🧹', '💼'];
  const colors = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6'];
  
  const openEdit = (item) => { 
    setEditItem(item); 
    setCat(item.category); 
    setLim(item.limit.toString()); 
    setMon(item.month); 
    setShow(true); 
  };
  const openAdd = () => { setEditItem(null); setCat('Food'); setLim(''); setMon(getCurrentMonth()); setShow(true); };
  
  const save = () => {
    const n = Number(lim);
    if (!lim || n <= 0) return alert('Enter valid limit');
    if (editItem) {
      dispatch({ type: 'EDIT_BUDGET', payload: { ...editItem, category: cat, limit: n, month: mon } });
      showToast('Budget updated!');
    } else {
      const ex = state.budgets.find(b => b.category === cat && b.month === mon);
      if (ex) {
        dispatch({ type: 'EDIT_BUDGET', payload: { ...ex, limit: n } });
      } else {
        dispatch({ type: 'ADD_BUDGET', payload: { id: generateId(), category: cat, limit: n, month: mon } });
      }
      showToast('Budget set!');
    }
    setLim(''); setCat('Food'); setMon(getCurrentMonth()); setShow(false); setEditItem(null);
  };
  
  const saveCustomCat = () => {
    if (!newCatName.trim()) return alert('Enter category name');
    if (CATEGORIES.find(c => c.name.toLowerCase() === newCatName.toLowerCase())) return alert('Category already exists');
    dispatch({ type: 'ADD_CUSTOM_CATEGORY', payload: { name: newCatName, icon: newCatIcon, color: newCatColor } });
    showToast('Category created!');
    setNewCatName(''); setNewCatIcon('📌'); setNewCatColor('#8B5CF6'); setShowCustomCat(false);
  };
  
  const bd = CATEGORIES.map(c => {
    const b = state.budgets.find(b => b.category === c.name && b.month === cm);
    const s = state.expenses.filter(e => e.category === c.name && e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0);
    const l = b ? Number(b.limit) : 0, p = l > 0 ? (s / l) * 100 : 0;
    return { ...c, spent: s, limit: l, percentage: p, budgetId: b?.id };
  });
  
  const totalBudget = bd.reduce((s, b) => s + b.limit, 0);
  const totalSpent = bd.reduce((s, b) => s + Math.min(b.spent, b.limit), 0);
  const overBudget = bd.filter(b => b.percentage > 100).length;
  
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-white">Budgets</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowCustomCat(true)} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl font-medium flex items-center gap-2 border border-white/10 transition-all text-sm"><Plus size={16} /> Category</button>
          <button onClick={openAdd} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all text-sm"><Plus size={18} /> Budget</button>
        </div>
      </div>
      
      {bd.filter(b => b.limit > 0).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card glow>
            <p className="text-gray-400 text-sm mb-1">Total Budget</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalBudget)}</p>
          </Card>
          <Card>
            <p className="text-gray-400 text-sm mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-purple-400">{formatCurrency(totalSpent)}</p>
          </Card>
          <Card className={overBudget > 0 ? 'ring-1 ring-red-500/50' : ''}>
            <p className="text-gray-400 text-sm mb-1">Over Budget</p>
            <p className={`text-2xl font-bold ${overBudget > 0 ? 'text-red-400' : 'text-green-400'}`}>{overBudget} categories</p>
          </Card>
        </div>
      )}
      
      <Card>
        <h3 className="text-white font-semibold mb-4">{new Date(cm + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
        <div className="space-y-4">
          {bd.filter(b => b.limit > 0).length === 0 && <p className="text-gray-500 text-center py-8">No budgets set</p>}
          {bd.filter(b => b.limit > 0).map(c => (
            <div key={c.name} className="space-y-2 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl flex-shrink-0">{c.icon}</span>
                  <span className="text-white font-medium truncate">{c.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <div className="text-right">
                    <span className={`font-bold ${c.percentage > 100 ? 'text-red-400' : c.percentage > 80 ? 'text-yellow-400' : 'text-green-400'}`}>{formatCurrency(c.spent)}</span>
                    <span className="text-gray-400"> / {formatCurrency(c.limit)}</span>
                  </div>
                  <button onClick={() => openEdit({ id: c.budgetId, category: c.name, limit: c.limit, month: cm })} className="p-1 hover:bg-blue-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} className="text-blue-400" /></button>
                  <button onClick={() => dispatch({ type: 'DELETE_BUDGET', payload: c.budgetId })} className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${c.percentage > 100 ? 'bg-gradient-to-r from-red-500 to-orange-500' : c.percentage > 80 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`} style={{ width: `${Math.min(100, c.percentage)}%` }} />
              </div>
              {c.percentage > 100 && <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={12} /> Over by {formatCurrency(c.spent - c.limit)}</p>}
            </div>
          ))}
        </div>
      </Card>
      
      {/* Custom Categories List */}
      {state.customCategories?.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-3">Custom Categories</h3>
          <div className="flex flex-wrap gap-2">
            {state.customCategories.map(c => (
              <div key={c.name} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl group">
                <span>{c.icon}</span>
                <span className="text-white text-sm">{c.name}</span>
                <button onClick={() => dispatch({ type: 'DELETE_CUSTOM_CATEGORY', payload: c.name })} className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"><X size={12} className="text-red-400" /></button>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Set Budget Modal */}
      <Modal isOpen={show} onClose={() => { setShow(false); setEditItem(null); }} title={editItem ? "Edit Budget" : "Set Budget"}>
        <div className="space-y-4">
          <div><label className="text-sm text-gray-400 block mb-2">Category</label><select value={cat} onChange={e => setCat(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:outline-none">{CATEGORIES.map(c => <option key={c.name} value={c.name} className="bg-slate-800">{c.icon} {c.name}</option>)}</select></div>
          <div><label className="text-sm text-gray-400 block mb-2">Budget Limit (₹)</label><input type="number" value={lim} onChange={e => setLim(e.target.value)} placeholder="5000" className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <MonthInput value={mon} onChange={e => setMon(e.target.value)} label="Month" />
          <button onClick={save} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">{editItem ? <><Save size={18} /> Update</> : 'Set Budget'}</button>
        </div>
      </Modal>
      
      {/* Create Custom Category Modal */}
      <Modal isOpen={showCustomCat} onClose={() => setShowCustomCat(false)} title="Create Category">
        <div className="space-y-4">
          <div><label className="text-sm text-gray-400 block mb-2">Category Name</label><input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Groceries..." className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none" /></div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Icon</label>
            <div className="flex flex-wrap gap-2">
              {categoryIcons.map(i => <button key={i} onClick={() => setNewCatIcon(i)} className={`text-xl p-2 rounded-lg transition-all ${newCatIcon === i ? 'bg-purple-500/30 ring-2 ring-purple-500' : 'hover:bg-white/10'}`}>{i}</button>)}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(c => <button key={c} onClick={() => setNewCatColor(c)} className={`w-8 h-8 rounded-lg transition-all ${newCatColor === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} />)}
            </div>
          </div>
          <button onClick={saveCustomCat} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"><Plus size={18} /> Create Category</button>
        </div>
      </Modal>
    </div>
  );
};

// ============ INSIGHTS ============
const Insights = ({ state }) => {
  const cm = getCurrentMonth();
  const pm = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
  const CATEGORIES = getCategories(state.customCategories);
  const balances = calculateBalances(state);
  
  const pme = state.expenses.filter(e => e.date?.startsWith(pm)).reduce((s, e) => s + Number(e.amount), 0);
  const sr = balances.monthlyIncome > 0 ? ((balances.monthlyIncome - balances.monthlyExpenses - balances.monthlyRecurring) / balances.monthlyIncome) * 100 : 0;
  const expenseChange = pme > 0 ? ((balances.monthlyExpenses - pme) / pme) * 100 : 0;
  
  const topCategory = CATEGORIES.map(c => ({
    name: c.name, icon: c.icon,
    amount: state.expenses.filter(e => e.category === c.name && e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0)
  })).sort((a, b) => b.amount - a.amount)[0];
  
  const overBudget = CATEGORIES.filter(c => {
    const b = state.budgets.find(b => b.category === c.name && b.month === cm);
    const s = state.expenses.filter(e => e.category === c.name && e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0);
    return b && s > Number(b.limit);
  });
  
  const insights = [];
  if (sr >= 30) insights.push({ type: 'success', icon: '🎉', title: 'Great Savings!', text: `You're saving ${sr.toFixed(0)}% of your income. Keep it up!` });
  else if (sr >= 20) insights.push({ type: 'info', icon: '👍', title: 'Good Progress', text: `Savings rate is ${sr.toFixed(0)}%. Try to reach 30%.` });
  else if (sr > 0) insights.push({ type: 'warning', icon: '⚠️', title: 'Low Savings', text: `Only saving ${sr.toFixed(0)}%. Aim for at least 20%.` });
  else if (balances.monthlyIncome > 0) insights.push({ type: 'danger', icon: '🚨', title: 'Overspending!', text: `You're spending more than you earn.` });
  
  if (expenseChange > 20) insights.push({ type: 'warning', icon: '📈', title: 'Expenses Up', text: `Spending increased ${expenseChange.toFixed(0)}% from last month.` });
  else if (expenseChange < -10) insights.push({ type: 'success', icon: '📉', title: 'Expenses Down', text: `Great! Spending reduced ${Math.abs(expenseChange).toFixed(0)}%.` });
  
  if (topCategory && topCategory.amount > 0) insights.push({ type: 'info', icon: topCategory.icon, title: 'Top Spending', text: `${topCategory.name} is your highest expense at ${formatCurrency(topCategory.amount)}.` });
  if (overBudget.length > 0) insights.push({ type: 'danger', icon: '💸', title: 'Over Budget', text: `${overBudget.length} ${overBudget.length === 1 ? 'category is' : 'categories are'} over budget.` });
  
  const completedGoals = state.goals.filter(g => g.currentAmount >= g.targetAmount).length;
  if (completedGoals > 0) insights.push({ type: 'success', icon: '🏆', title: 'Goals Achieved', text: `You've completed ${completedGoals} goal${completedGoals > 1 ? 's' : ''}!` });
  
  const investmentRate = balances.totalIncome > 0 ? (balances.totalInvestments / balances.totalIncome) * 100 : 0;
  if (investmentRate < 10 && balances.totalIncome > 0) insights.push({ type: 'info', icon: '💡', title: 'Investment Tip', text: `Only ${investmentRate.toFixed(0)}% invested. Consider investing more.` });
  
  const weeklyData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (7 * (3 - i)));
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    return { week: `W${i + 1}`, amount: state.expenses.filter(e => { const d = new Date(e.date); return d >= weekStart && d < weekEnd; }).reduce((s, e) => s + Number(e.amount), 0) };
  });
  
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-white">Insights</h2>
        <Sparkles size={24} className="text-yellow-400" />
      </div>
      
      <div className="space-y-3">
        {insights.length === 0 && <Card><p className="text-gray-400 text-center py-8">Add more data to get personalized insights!</p></Card>}
        {insights.map((ins, i) => (
          <Card key={i} className={`border-l-4 ${ins.type === 'success' ? 'border-l-green-500' : ins.type === 'warning' ? 'border-l-yellow-500' : ins.type === 'danger' ? 'border-l-red-500' : 'border-l-blue-500'}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{ins.icon}</span>
              <div className="min-w-0"><h4 className="text-white font-semibold">{ins.title}</h4><p className="text-gray-400 text-sm mt-1">{ins.text}</p></div>
            </div>
          </Card>
        ))}
      </div>
      
      {weeklyData.some(w => w.amount > 0) && (
        <Card>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-purple-400" /> Weekly Spending</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="week" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" tickFormatter={v => '₹' + (v/1000) + 'k'} fontSize={12} />
              <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="amount" fill="url(#purpleGrad)" radius={[4, 4, 0, 0]} />
              <defs><linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A855F7" /><stop offset="100%" stopColor="#7C3AED" /></linearGradient></defs>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      
      <Card>
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><PieIcon size={18} className="text-pink-400" /> Category Comparison</h3>
        <div className="space-y-3">
          {CATEGORIES.map(c => {
            const current = state.expenses.filter(e => e.category === c.name && e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0);
            const prev = state.expenses.filter(e => e.category === c.name && e.date?.startsWith(pm)).reduce((s, e) => s + Number(e.amount), 0);
            if (current === 0 && prev === 0) return null;
            const change = prev > 0 ? ((current - prev) / prev) * 100 : (current > 0 ? 100 : 0);
            return (
              <div key={c.name} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2 min-w-0"><span className="text-xl flex-shrink-0">{c.icon}</span><span className="text-white truncate">{c.name}</span></div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-white font-medium">{formatCurrency(current)}</span>
                  <span className={`text-xs ml-2 ${change > 0 ? 'text-red-400' : change < 0 ? 'text-green-400' : 'text-gray-400'}`}>
                    {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          }).filter(Boolean)}
        </div>
      </Card>
    </div>
  );
};

// ============ AUDITOR ============
const Auditor = ({ state }) => {
  const [messages, setMessages] = useState([{ role: 'bot', text: "Hi! I'm your Finance Auditor 🤖. Ask me about spending, savings, goals, or financial health!" }]);
  const [input, setInput] = useState('');
  
  const CATEGORIES = getCategories(state.customCategories);
  const balances = calculateBalances(state);
  
  const processQuery = (q) => {
    const lower = q.toLowerCase();
    const sr = balances.monthlyIncome > 0 ? ((balances.monthlyIncome - balances.monthlyExpenses - balances.monthlyRecurring) / balances.monthlyIncome) * 100 : 0;
    const cm = getCurrentMonth();
    
    if (lower.includes('spend') && lower.includes('most')) {
      const top = CATEGORIES.map(c => ({ name: c.name, icon: c.icon, total: state.expenses.filter(e => e.category === c.name && e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0) })).sort((a, b) => b.total - a.total)[0];
      return top?.total > 0 ? `${top.icon} Top spending: **${top.name}** at **${formatCurrency(top.total)}** this month.` : "No expenses recorded this month.";
    }
    if (lower.includes('total') && lower.includes('expense')) return `💸 Total: **${formatCurrency(balances.monthlyExpenses + balances.monthlyRecurring)}**\n• One-time: ${formatCurrency(balances.monthlyExpenses)}\n• Recurring: ${formatCurrency(balances.monthlyRecurring)}`;
    if (lower.includes('saving') || lower.includes('save')) {
      if (sr >= 30) return `🎉 Excellent! Saving **${formatCurrency(balances.monthlyAvailable)}** (${sr.toFixed(0)}%)`;
      if (sr >= 20) return `👍 Good! Saving **${formatCurrency(balances.monthlyAvailable)}** (${sr.toFixed(0)}%). Try 30%!`;
      if (sr > 0) return `⚠️ Saving **${formatCurrency(balances.monthlyAvailable)}** (${sr.toFixed(0)}%). Aim for 20%+`;
      return `🚨 Overspending! Review your expenses.`;
    }
    if (lower.includes('income')) return `💰 Monthly income: **${formatCurrency(balances.monthlyIncome)}**`;
    if (lower.includes('invest')) return balances.totalInvestments > 0 ? `📈 Total invested: **${formatCurrency(balances.totalInvestments)}** across ${state.investments.length} investments.` : "No investments yet. Start investing!";
    if (lower.includes('goal')) {
      if (state.goals.length === 0) return "🎯 No goals set. Create some!";
      return `🎯 **Goals:**\n${state.goals.map(g => `• ${g.icon} ${g.name}: ${((g.currentAmount / g.targetAmount) * 100).toFixed(0)}%`).join('\n')}`;
    }
    if (lower.includes('health') || lower.includes('score')) {
      const hs = Math.min(100, Math.max(0, Math.round(sr * 2)));
      return hs > 60 ? `🟢 **Score: ${hs}/100** - Excellent!` : hs > 30 ? `🟡 **Score: ${hs}/100** - Can improve` : `🔴 **Score: ${hs}/100** - Needs attention`;
    }
    if (lower.includes('budget')) {
      const cm = getCurrentMonth();
      const over = CATEGORIES.filter(c => { const b = state.budgets.find(b => b.category === c.name && b.month === cm); const s = state.expenses.filter(e => e.category === c.name && e.date?.startsWith(cm)).reduce((s, e) => s + Number(e.amount), 0); return b && s > Number(b.limit); });
      return over.length > 0 ? `⚠️ Over budget: ${over.map(c => c.name).join(', ')}` : state.budgets.length > 0 ? "✅ All budgets on track!" : "No budgets set.";
    }
    if (lower.includes('balance') || lower.includes('available')) return `💵 **Monthly Available:** ${formatCurrency(balances.monthlyAvailable)}\n💰 **Overall Available:** ${formatCurrency(balances.overallAvailable)}`;
    if (lower.includes('tip') || lower.includes('advice')) {
      const tips = ["💡 50/30/20 rule: 50% needs, 30% wants, 20% savings", "💡 Review subscriptions monthly", "💡 Auto-transfer to savings on payday", "💡 Track every expense", "💡 Build 3-6 months emergency fund"];
      return tips[Math.floor(Math.random() * tips.length)];
    }
    return "🤔 Try asking about:\n• Spending/expenses\n• Savings rate\n• Budget status\n• Goals progress\n• Health score\n• Available balance\n• Tips";
  };
  
  const send = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: input }, { role: 'bot', text: processQuery(input) }]);
    setInput('');
  };
  
  const quickPrompts = ["Where do I spend most?", "Am I saving enough?", "Show my goals", "What's my health score?", "Budget alerts?", "Available balance"];
  
  return (
    <div className="space-y-5 animate-fadeIn flex flex-col h-full">
      <div className="flex items-center gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-white">Finance Auditor</h2>
        <Bot size={24} className="text-purple-400" />
      </div>
      
      <div className="flex flex-wrap gap-2">
        {quickPrompts.map(p => <button key={p} onClick={() => setInput(p)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 transition-all hover:border-purple-500/50">{p}</button>)}
      </div>
      
      <Card className="flex-1 flex flex-col min-h-[350px]">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-line ${m.role === 'user' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-sm' : 'bg-white/10 text-gray-200 rounded-bl-sm'}`}>
                {m.text.split('**').map((part, j) => j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && send()} placeholder="Ask about your finances..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
          <button onClick={send} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white p-3 rounded-xl transition-all flex-shrink-0"><Send size={20} /></button>
        </div>
      </Card>
    </div>
  );
};

// ============ GAMIFICATION ============
const GamificationSidebar = ({ state }) => {
  const lv = Math.floor(state.xp / 100) + 1, xp = state.xp % 100;
  const badges = [
    { id: 'first', icon: '🎯', name: 'First Step', earned: state.expenses.length > 0 },
    { id: 'saver', icon: '💰', name: 'Saver', earned: state.xp >= 100 },
    { id: 'investor', icon: '📈', name: 'Investor', earned: state.investments.length > 0 },
    { id: 'goal', icon: '🏆', name: 'Goal Setter', earned: state.goals.length >= 3 },
    { id: 'pro', icon: '👑', name: 'Finance Pro', earned: state.xp >= 500 },
  ];
  
  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
      <div className="p-3 bg-gradient-to-br from-purple-900/40 to-pink-900/30 rounded-xl border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2"><Crown size={16} className="text-yellow-400" /><span className="text-white font-bold">Level {lv}</span></div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${xp}%` }} /></div>
        <p className="text-gray-400 text-xs mt-1">{xp}/100 XP</p>
      </div>
      <div className="p-3 bg-white/5 rounded-xl"><div className="flex items-center gap-2"><Flame size={16} className={state.streak > 0 ? 'text-orange-500' : 'text-gray-500'} /><span className="text-white text-sm">{state.streak} Day Streak</span></div></div>
      <div className="p-3 bg-white/5 rounded-xl">
        <p className="text-gray-400 text-xs mb-2">Badges</p>
        <div className="flex flex-wrap gap-1">{badges.map(b => <div key={b.id} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${b.earned ? 'bg-purple-500/20' : 'bg-white/5 opacity-40'}`} title={b.name}>{b.icon}</div>)}</div>
      </div>
    </div>
  );
};

// ============ LOGIN SCREEN ============
const LoginScreen = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError('Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slideUp">
        {/* Card */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-3xl p-8 border border-white/10 backdrop-blur-xl shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/40 mb-4">
              <Gem size={36} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              FinTracker
            </h1>
            <p className="text-gray-400 mt-2 text-center text-sm">
              Your personal finance dashboard — accessible anywhere
            </p>
          </div>

          {/* Features list */}
          <div className="space-y-3 mb-8">
            {[
              { icon: '📊', text: 'Track income, expenses & investments' },
              { icon: '☁️', text: 'Cloud sync — access from any device' },
              { icon: '🎯', text: 'Set goals and monitor progress' },
              { icon: '🔒', text: 'Secured with your Google account' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <span className="text-xl">{f.icon}</span>
                <span className="text-gray-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Sign in button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin text-gray-500" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.2l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.9 6l6.2 5.2C40.2 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
            )}
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <p className="text-center text-gray-500 text-xs mt-4">
            Your data is private and only accessible by you
          </p>
        </div>
      </div>
    </div>
  );
};

// ============ MIGRATION MODAL ============
const MigrationModal = ({ localData, onKeepCloud, onImportLocal }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 w-full max-w-sm border border-white/10 shadow-2xl animate-slideUp">
      <div className="text-center mb-5">
        <div className="text-4xl mb-3">☁️</div>
        <h3 className="text-xl font-bold text-white mb-2">Existing Data Found</h3>
        <p className="text-gray-400 text-sm">
          We found data already saved in this browser. What would you like to do?
        </p>
      </div>

      <div className="space-y-2 mb-5 text-sm text-gray-300 bg-white/5 rounded-xl p-3">
        <p>📥 <span className="text-white font-medium">Local data:</span> {localData.incomes?.length || 0} incomes, {(localData.expenses?.length || 0) + (localData.recurringExpenses?.length || 0)} expenses, {localData.goals?.length || 0} goals</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={onImportLocal}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-xl font-medium transition-all"
        >
          📥 Import local data to cloud
        </button>
        <button
          onClick={onKeepCloud}
          className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-medium transition-all border border-white/10"
        >
          ☁️ Keep my existing cloud data
        </button>
      </div>
    </div>
  </div>
);

// ============ MAIN APP ============
export default function App() {
  const { user, authLoading, logout } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tab, setTab] = useState('dashboard');
  const [sidebar, setSidebar] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [save, setSave] = useState('saved');
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [dataLoading, setDataLoading] = useState(true);
  const [migrationData, setMigrationData] = useState(null); // holds local data if conflict
  const [dataReady, setDataReady] = useState(false); // true once initial load is done

  const showToast = (msg) => { setToast({ show: true, msg }); setTimeout(() => setToast({ show: false, msg: '' }), 2500); };

  useEffect(() => {
    const chk = () => { setMobile(window.innerWidth < 768); setSidebar(window.innerWidth >= 768); };
    chk(); window.addEventListener('resize', chk); return () => window.removeEventListener('resize', chk);
  }, []);

  // ── On login: load from Firestore + handle migration ──────────────────────
  useEffect(() => {
    if (!user) { setDataReady(false); setDataLoading(true); return; }

    const run = async () => {
      setDataLoading(true);
      try {
        const LOCAL_KEY = 'fintracker_v7';
        const rawLocal = localStorage.getItem(LOCAL_KEY);
        const localData = rawLocal ? JSON.parse(rawLocal) : null;
        const hasLocal = localData && (
          (localData.incomes?.length > 0) ||
          (localData.expenses?.length > 0) ||
          (localData.recurringExpenses?.length > 0) ||
          (localData.investments?.length > 0) ||
          (localData.goals?.length > 0) ||
          (localData.budgets?.length > 0)
        );

        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        const hasCloud = snap.exists();

        if (!hasCloud && hasLocal) {
          // No cloud data → migrate local → Firestore automatically
          await setDoc(docRef, localData);
          dispatch({ type: 'LOAD_DATA', payload: localData });
          localStorage.removeItem(LOCAL_KEY);
          showToast('Local data migrated to cloud ✅');
        } else if (hasCloud && hasLocal) {
          // Both exist → ask user
          setMigrationData(localData);
          dispatch({ type: 'LOAD_DATA', payload: snap.data() });
        } else if (hasCloud) {
          // Cloud only → normal load
          dispatch({ type: 'LOAD_DATA', payload: snap.data() });
          localStorage.removeItem(LOCAL_KEY); // clean up just in case
        }
        // else: fresh start — no data anywhere, keep initialState
      } catch (e) {
        console.error('Load error:', e);
      }
      setDataLoading(false);
      setDataReady(true);
    };

    run();
  }, [user]);

  // Migration: user chose to import local data
  const handleImportLocal = async () => {
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, migrationData);
      dispatch({ type: 'LOAD_DATA', payload: migrationData });
      localStorage.removeItem('fintracker_v7');
      setMigrationData(null);
      showToast('Local data imported to cloud ✅');
    } catch (e) {
      console.error('Migration error:', e);
    }
  };

  // Migration: user chose to keep cloud data
  const handleKeepCloud = () => {
    localStorage.removeItem('fintracker_v7');
    setMigrationData(null);
    showToast('Cloud data kept. Local data cleared ✅');
  };

  // ── Auto-save to Firestore (debounced 800ms) ───────────────────────────────
  useEffect(() => {
    if (!user || !dataReady) return;
    setSave('saving');
    const t = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), state);
        setSave('saved');
      } catch (e) {
        setSave('error');
        console.error('Save error:', e);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [state, user, dataReady]);
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'income', label: 'Income', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'investments', label: 'Invest', icon: BarChart3 },
    { id: 'budgets', label: 'Budgets', icon: PieIcon },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'insights', label: 'Insights', icon: Sparkles },
    { id: 'auditor', label: 'Auditor', icon: Bot },
  ];

  const click = (id) => { setTab(id); if (mobile) setSidebar(false); };

  const view = () => {
    const p = { state, dispatch, showToast };
    switch (tab) {
      case 'dashboard': return <Dashboard state={state} />;
      case 'income': return <Income {...p} />;
      case 'expenses': return <Expenses {...p} />;
      case 'investments': return <Investments {...p} />;
      case 'budgets': return <Budgets {...p} />;
      case 'goals': return <Goals {...p} />;
      case 'insights': return <Insights state={state} />;
      case 'auditor': return <Auditor state={state} />;
      default: return <Dashboard state={state} />;
    }
  };

  // ── Auth loading spinner ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/40">
            <Gem size={32} className="text-white" />
          </div>
          <Loader2 size={24} className="text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Not logged in → show login screen ─────────────────────────────────────
  if (!user) return <LoginScreen />;

  // ── Data loading spinner (after login, fetching Firestore) ─────────────────
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/40">
            <Gem size={32} className="text-white" />
          </div>
          <Loader2 size={24} className="text-purple-400 animate-spin" />
          <p className="text-gray-400 text-sm">Loading your data...</p>
        </div>
      </div>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  const isLight = state.theme === 'light';

  return (
    <div className={`min-h-screen ${isLight ? 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900' : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white'}`}>
      {/* Migration conflict modal */}
      {migrationData && (
        <MigrationModal
          localData={migrationData}
          onImportLocal={handleImportLocal}
          onKeepCloud={handleKeepCloud}
        />
      )}

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Mobile header */}
      <header className={`md:hidden fixed top-0 left-0 right-0 z-40 ${isLight ? 'bg-white/95 border-gray-200' : 'bg-slate-900/95 border-white/10'} backdrop-blur-xl border-b px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg shadow-purple-500/30"><Gem size={18} className="text-white" /></div>
          <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">FinTracker</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 ${save === 'saving' ? 'bg-yellow-500/20 text-yellow-400' : save === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {save === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
          </div>
          {/* Mobile user avatar */}
          {user.photoURL && (
            <img src={user.photoURL} alt="avatar" className="w-7 h-7 rounded-full border border-purple-500/40" />
          )}
          <button onClick={() => dispatch({ type: 'TOGGLE_THEME' })} className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400">
            {state.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setSidebar(!sidebar)} className="p-2 hover:bg-white/10 rounded-lg transition-all">{sidebar ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </header>

      {mobile && sidebar && <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setSidebar(false)} />}

      <div className="relative flex">
        {/* Sidebar */}
        <aside className={`${mobile ? 'fixed top-14 left-0 h-[calc(100vh-56px)] z-50' : 'sticky top-0 h-screen'} ${sidebar ? 'w-56 translate-x-0' : mobile ? '-translate-x-full w-56' : 'w-16'} ${isLight ? 'bg-white/95 border-gray-200' : 'bg-slate-900/95 border-white/10'} backdrop-blur-xl border-r p-3 transition-all duration-300 flex flex-col overflow-y-auto`}>
          {/* Logo */}
          <div className="hidden md:flex items-center gap-2 mb-6 p-2">
            <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg shadow-purple-500/30"><Gem size={20} className="text-white" /></div>
            {sidebar && <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">FinTracker</span>}
          </div>

          {/* Save status */}
          {sidebar && (
            <div className="hidden md:flex items-center justify-between mb-4">
              <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${save === 'saving' ? 'bg-yellow-500/10 text-yellow-400' : save === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                {save === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                <span>{save === 'saving' ? 'Saving...' : save === 'error' ? 'Save error' : 'Synced'}</span>
              </div>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white"
                title="Toggle theme"
              >
                {state.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          )}

          {/* Nav tabs */}
          <nav className="space-y-1 flex-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => click(t.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all ${tab === t.id ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30 shadow-lg shadow-purple-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                <t.icon size={18} />{(sidebar || mobile) && <span className="text-sm">{t.label}</span>}
              </button>
            ))}
          </nav>

          {/* Gamification */}
          {(sidebar || mobile) && <GamificationSidebar state={state} />}

          {/* User profile + sign out */}
          {(sidebar || mobile) ? (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 mb-2">
                {user.photoURL
                  ? <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full flex-shrink-0 border border-purple-500/40" />
                  : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">{user.displayName?.[0] || 'U'}</div>
                }
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate">{user.displayName || 'User'}</p>
                  <p className="text-gray-500 text-[10px] truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          ) : (
            /* Collapsed sidebar — just show avatar + sign out icon */
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
              {user.photoURL
                ? <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border border-purple-500/40" />
                : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">{user.displayName?.[0] || 'U'}</div>
              }
              <button onClick={logout} className="p-2 hover:bg-red-500/10 rounded-xl text-gray-400 hover:text-red-400 transition-all" title="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </aside>

        <main className="flex-1 p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6 overflow-auto">
          <div className="max-w-6xl mx-auto">{view()}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 ${isLight ? 'bg-white/95 border-gray-200' : 'bg-slate-900/95 border-white/10'} backdrop-blur-xl border-t px-1 py-2 z-40`}>
        <div className="flex justify-around">
          {tabs.slice(0, 5).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all ${tab === t.id ? 'text-purple-400' : 'text-gray-500'}`}>
              <t.icon size={18} /><span className="text-[10px]">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <Toast message={toast.msg} show={toast.show} />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
