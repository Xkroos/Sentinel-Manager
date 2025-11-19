import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Zap, Save } from 'lucide-react'; 
import { Order, Payment } from '../lib/supabase';


// Definición de tipos
interface OrderWithPayments extends Order {
  payments: Payment[];
}

export function FinancialOperationsModule() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
    
    // Estados para los datos guardados
  const [withdrawn, setWithdrawn] = useState(0);
  const [investedAmount, setInvestedAmount] = useState(0);
    
    // Estados temporales para los inputs
    const [tempWithdrawn, setTempWithdrawn] = useState(0);
    const [tempInvestedAmount, setTempInvestedAmount] = useState(0);
    
    // Estados para las descripciones (temporal)
    const [investDescription, setInvestDescription] = useState('');
    const [withdrawDescription, setWithdrawDescription] = useState('');
    const [isProcessing, setIsProcessing] = useState(false); // Para el estado del botón
    
    // Simulación de carga de datos iniciales
    useEffect(() => {
        // En un entorno real, cargarías 'withdrawn' e 'investedAmount' persistentes de tu DB.
        setTempWithdrawn(0);
        setTempInvestedAmount(0);
    }, []);
    

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

  const getTotalPaid = (payments: Payment[]) => {
    return payments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
  };

  const financialSummary = orders.reduce(
    (acc, order) => {
      const investment = parseFloat(order.purchase_price.toString());
      const revenue = parseFloat(order.sale_price.toString());
      const totalPaid = getTotalPaid(order.payments);
      const remaining = revenue - totalPaid;

      return {
        totalPaid: acc.totalPaid + totalPaid,
        totalPending: acc.totalPending + (order.status === 'pendiente' ? remaining : 0),
        totalInvested: acc.totalInvested + investment,
        totalRevenue: acc.totalRevenue + revenue,
      };
    },
    { totalPaid: 0, totalPending: 0, totalInvested: 0, totalRevenue: 0 }
  );

   // En FinancialOperationsModule.tsx

const handleApplyChanges = useCallback(async (type: 'invest' | 'withdraw') => {
    setIsProcessing(true);
    try {
        const amount = type === 'invest' ? tempInvestedAmount : tempWithdrawn;
        const description = type === 'invest' ? investDescription : withdrawDescription;

        if (amount <= 0 || !description.trim()) {
            alert('El monto debe ser positivo y se requiere una descripción.');
            setIsProcessing(false);
            return;
        }

        // 🚀 LLAMADA REAL A SUPABASE
        const { error } = await supabase
            .from('financial_transactions')
            .insert({
                user_id: user.id, // ID del usuario autenticado
                amount: amount,
                description: description,
                type: type === 'invest' ? 'inversion' : 'retiro', // Usa el tipo ENUM definido
            });

        if (error) throw error;
        
        // Si la inserción es exitosa, actualizamos el estado local
        if (type === 'invest') {
            setInvestedAmount(prev => prev + amount);
            setTempInvestedAmount(0);
            setInvestDescription('');
            alert(`Inversión de $${amount.toFixed(2)} registrada exitosamente.`);
        } else {
            setWithdrawn(prev => prev + amount);
            setTempWithdrawn(0);
            setWithdrawDescription('');
            alert(`Retiro de $${amount.toFixed(2)} registrado exitosamente.`);
        }

    } catch (error) {
        console.error('Error al aplicar cambios:', error);
        alert('Ocurrió un error al guardar los cambios en la base de datos.');
    } finally {
        setIsProcessing(false);
    }
}, [tempInvestedAmount, tempWithdrawn, investDescription, withdrawDescription, user]); // Asegúrate de que 'user' esté en dependencias


    // Cálculo del Efectivo Neto (Liquidez Real)
  const netCashFlow = financialSummary.totalPaid - investedAmount - withdrawn;
  const currentBalance = financialSummary.totalPaid; 

    // --- CÁLCULO Y REPARACIÓN DEL GRÁFICO (useMemo) ---
  const chartData = useMemo(() => ([
    {
      label: 'Ingresos Pagados',
      value: financialSummary.totalPaid,
      color: '#10b981', // Verde
    },
    {
      label: 'Ingresos Pendientes',
      value: financialSummary.totalPending,
      color: '#f59e0b', // Amarillo
    },
    {
      label: 'Inversión Total',
      value: investedAmount,
      color: '#ef4444', // Rojo
    },
    {
      label: 'Retirado Total',
      value: withdrawn,
      color: '#6366f1', // Índigo
    },
  ].filter(item => item.value > 0)), [financialSummary.totalPaid, financialSummary.totalPending, investedAmount, withdrawn]);

  const totalChartValue = chartData.reduce((sum, item) => sum + item.value, 0) || 1; 
    
    // FUNCIÓN REPARADA DEL GRÁFICO (conic-gradient)
    const getConicGradientStyle = useCallback(() => {
        if (totalChartValue === 0) return { background: 'white' };

        let gradientString = 'conic-gradient(';
        let startPercent = 0;

        chartData.forEach((item, index) => {
            const percentage = (item.value / totalChartValue) * 100;
            const endPercent = startPercent + percentage;
            
            gradientString += `${item.color} ${startPercent}% ${endPercent}%${index === chartData.length - 1 ? '' : ', '}`;
            
            startPercent = endPercent;
        });

        gradientString += ')';
        return {
            background: gradientString,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        };
    }, [chartData, totalChartValue]);
    // En FinancialOperationsModule.tsx

// 💡 Nueva función para cargar los totales acumulados
const loadAccumulatedTotals = async () => {
    if (!user) return;
    
    // Consulta para sumar todos los montos por tipo
    const { data, error } = await supabase
        .from('financial_transactions')
        .select('type, amount')
        .eq('user_id', user.id);

    if (error) {
        console.error("Error loading totals:", error);
        return;
    }

    let totalInvested = 0;
    let totalWithdrawn = 0;

    data.forEach(transaction => {
        const amountValue = parseFloat(transaction.amount.toString());
        if (transaction.type === 'inversion') {
            totalInvested += amountValue;
        } else if (transaction.type === 'retiro') {
            totalWithdrawn += amountValue;
        }
    });

    setInvestedAmount(totalInvested);
    setWithdrawn(totalWithdrawn);
};

useEffect(() => {
    if (user) {
        loadOrders();
        loadAccumulatedTotals(); // ⬅️ Llamada para cargar los totales
    }
    // Inicializamos los inputs temporales a 0
    setTempWithdrawn(0);
    setTempInvestedAmount(0);
}, [user]); // Dependencia del usuario para asegurar la carga después del login


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Operaciones Financieras</h2>
      
      {/* 💳 TARJETA DESTACADA: EFECTIVO NETO */}
      <div className={`bg-white border border-slate-200 rounded-lg p-6 shadow-md ${
        netCashFlow >= 0 ? 'border-green-400' : 'border-red-400'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${
              netCashFlow >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <Zap className={`w-6 h-6 ${
                netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-slate-600">Efectivo Neto (Liquidez Real)</p>
              <p className={`text-3xl font-bold ${
                netCashFlow >= 0 ? 'text-green-800' : 'text-red-800'
              }`}>
                ${netCashFlow.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">
                Fórmula: Pagado - Invertido - Retirado
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* INGRESOS PAGADOS Y PENDIENTES */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm text-slate-600">Dinero Pagado (Ingreso Bruto)</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            ${financialSummary.totalPaid.toFixed(2)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-sm text-slate-600">Por Cobrar</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            ${financialSummary.totalPending.toFixed(2)}
          </p>
        </div>
        
        {/* 🟥 INVERSIÓN: CON INPUTS Y BOTÓN */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-sm text-slate-600">Registrar Nueva Inversión</span>
          </div>
            <p className="text-xl font-bold text-red-800 mb-2">Total Acumulado: ${investedAmount.toFixed(2)}</p>
            
            <label className="block text-xs font-semibold text-slate-700 mb-1">Monto a Invertir</label>
          <input
            type="number"
            step="0.01"
            value={tempInvestedAmount}
            onChange={(e) => setTempInvestedAmount(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 text-lg font-bold mb-3"
            placeholder="$0.00"
          />

            <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción (p. ej: "Compra de materia prima")</label>
            <input
            type="text"
            value={investDescription}
            onChange={(e) => setInvestDescription(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm mb-4"
            placeholder="Razón de la inversión"
          />
            
            <button
                onClick={() => handleApplyChanges('invest')}
                disabled={isProcessing || tempInvestedAmount <= 0 || !investDescription.trim()}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition duration-150 disabled:bg-slate-400"
            >
                <Save className="w-5 h-5" />
                {isProcessing ? 'Guardando...' : 'Aplicar Inversión'}
            </button>
        </div>

        {/* 🟦 RETIRO: CON INPUTS Y BOTÓN */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Wallet className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-sm text-slate-600">Registrar Nuevo Retiro</span>
          </div>
            <p className="text-xl font-bold text-indigo-800 mb-2">Total Acumulado: ${withdrawn.toFixed(2)}</p>
            
            <label className="block text-xs font-semibold text-slate-700 mb-1">Monto a Retirar</label>
          <input
            type="number"
            step="0.01"
            value={tempWithdrawn}
            onChange={(e) => setTempWithdrawn(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg font-bold mb-3"
            placeholder="$0.00"
          />

            <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción (p. ej: "Pago de luz", "Retiro personal")</label>
            <input
            type="text"
            value={withdrawDescription}
            onChange={(e) => setWithdrawDescription(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm mb-4"
            placeholder="Razón del retiro"
          />
            
            <button
                onClick={() => handleApplyChanges('withdraw')}
                disabled={isProcessing || tempWithdrawn <= 0 || !withdrawDescription.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg transition duration-150 disabled:bg-slate-400"
            >
                <Save className="w-5 h-5" />
                {isProcessing ? 'Guardando...' : 'Aplicar Retiro'}
            </button>
        </div>
      </div>
---
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">
            Distribución de Flujo de Caja
          </h3>
          <div className="flex items-center gap-8">
            <div className="flex-1 flex justify-center">
              <div
                className="relative w-48 h-48"
                style={getConicGradientStyle()}
              >
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-slate-600">Total</p>
                    <p className="text-xl font-bold text-slate-800">
                      ${totalChartValue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {chartData.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    ${item.value.toFixed(2)}
                  </p>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        backgroundColor: item.color,
                        width: `${(item.value / totalChartValue) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Resumen Financiero</h3>

          <div className="space-y-3">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Saldo de Pagos Recibidos</p>
              <p className="text-2xl font-bold text-slate-800">
                ${currentBalance.toFixed(2)}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700 mb-1">Efectivo Neto (Liquidez)</p>
              <p className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                ${netCashFlow.toFixed(2)}
              </p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-red-700 mb-1">Gastos Totales (Invertido + Retirado)</p>
              <p className="text-2xl font-bold text-red-800">
                ${(investedAmount + withdrawn).toFixed(2)}
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700 mb-1">Total de Ingresos Potenciales</p>
              <p className="text-2xl font-bold text-blue-800">
                ${(financialSummary.totalPaid + financialSummary.totalPending).toFixed(2)}
              </p>
            </div>
            
          </div>
        </div>
      </div>

---

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Detalles de Órdenes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Producto
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">
                  Inversión
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">
                  Ingreso
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">
                  Pagado
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => {
                const totalPaid = getTotalPaid(order.payments);
                return (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {order.customer_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {order.product_description.substring(0, 30)}...
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">
                      ${parseFloat(order.purchase_price.toString()).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">
                      ${parseFloat(order.sale_price.toString()).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">
                      ${totalPaid.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          order.status === 'pagado'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {order.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}