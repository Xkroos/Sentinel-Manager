import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, DollarSign, ShoppingBag, Calendar } from 'lucide-react';
import { Order, Payment } from '../lib/supabase';
import { useExchangeRate } from '../hooks/useExchangeRate';

interface OrderWithPayments extends Order {
  payments: Payment[];
}

export function StatisticsModule() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const { rate: exchangeRate } = useExchangeRate();

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('order_date', { ascending: false });

    if (ordersData) {
      const ordersWithPayments = await Promise.all(
        ordersData.map(async (order) => {
          const { data: payments } = await supabase
            .from('payments')
            .select('*')
            .eq('order_id', order.id);

          return {
            ...order,
            payments: payments || [],
          };
        })
      );

      setOrders(ordersWithPayments);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return startDate;
  };

  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.order_date);
    return orderDate >= getDateRange();
  });

  const stats = filteredOrders.reduce(
    (acc, order) => {
      const revenue = parseFloat(order.sale_price.toString());
      const investment = parseFloat(order.purchase_price.toString());
      const profit = parseFloat(order.profit.toString());
      const totalPaid = order.payments.reduce(
        (sum, payment) => sum + parseFloat(payment.amount.toString()),
        0
      );

      return {
        totalRevenue: acc.totalRevenue + revenue,
        totalInvestment: acc.totalInvestment + investment,
        totalProfit: acc.totalProfit + profit,
        totalPaid: acc.totalPaid + totalPaid,
        orderCount: acc.orderCount + 1,
        paidOrders: order.status === 'pagado' ? acc.paidOrders + 1 : acc.paidOrders,
      };
    },
    {
      totalRevenue: 0,
      totalInvestment: 0,
      totalProfit: 0,
      totalPaid: 0,
      orderCount: 0,
      paidOrders: 0,
    }
  );

  const profitMargin =
    stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;

  const getPeriodLabel = () => {
    switch (period) {
      case 'week':
        return 'Última Semana';
      case 'month':
        return 'Último Mes';
      case 'year':
        return 'Último Año';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Estadísticas</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              period === 'week'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              period === 'month'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              period === 'year'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Año
          </button>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 text-slate-700">
          <Calendar className="w-5 h-5" />
          <span className="font-medium">Período: {getPeriodLabel()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Total Encargos</p>
              <p className="text-2xl font-bold text-slate-800">{stats.orderCount}</p>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            <p>Pagados: {stats.paidOrders}</p>
            <p>Pendientes: {stats.orderCount - stats.paidOrders}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Ganancia Total</p>
              <p className="text-2xl font-bold text-slate-800">
                ${stats.totalProfit.toFixed(2)}
              </p>
            </div>
          </div>
          {exchangeRate > 0 && (
            <p className="text-sm text-slate-600">
              Bs. {(stats.totalProfit * exchangeRate).toFixed(2)}
            </p>
          )}
          <p className="text-sm text-slate-600 mt-2">
            Margen: {profitMargin.toFixed(1)}%
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Inversión Total</p>
              <p className="text-2xl font-bold text-slate-800">
                ${stats.totalInvestment.toFixed(2)}
              </p>
            </div>
          </div>
          {exchangeRate > 0 && (
            <p className="text-sm text-slate-600">
              Bs. {(stats.totalInvestment * exchangeRate).toFixed(2)}
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-slate-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Ingresos Totales</p>
              <p className="text-2xl font-bold text-slate-800">
                ${stats.totalRevenue.toFixed(2)}
              </p>
            </div>
          </div>
          {exchangeRate > 0 && (
            <p className="text-sm text-slate-600">
              Bs. {(stats.totalRevenue * exchangeRate).toFixed(2)}
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Dinero Recibido</p>
              <p className="text-2xl font-bold text-slate-800">
                ${stats.totalPaid.toFixed(2)}
              </p>
            </div>
          </div>
          {exchangeRate > 0 && (
            <p className="text-sm text-slate-600">
              Bs. {(stats.totalPaid * exchangeRate).toFixed(2)}
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Por Cobrar</p>
              <p className="text-2xl font-bold text-slate-800">
                ${(stats.totalRevenue - stats.totalPaid).toFixed(2)}
              </p>
            </div>
          </div>
          {exchangeRate > 0 && (
            <p className="text-sm text-slate-600">
              Bs. {((stats.totalRevenue - stats.totalPaid) * exchangeRate).toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {exchangeRate > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-blue-900 text-sm font-medium">
            Tasa BCV: Bs. {exchangeRate.toFixed(2)} por dólar
          </p>
        </div>
      )}
    </div>
  );
}
