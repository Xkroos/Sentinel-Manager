
import { useState, useEffect, useMemo } from 'react'; // <-- Agregado useMemo
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, DollarSign, Search } from 'lucide-react';
import { OrderForm } from './OrderForm';
import { PaymentModal } from './PaymentModal';
import { Order, Payment } from '../lib/supabase';

interface OrderWithPayments extends Order {
  payments: Payment[];
}

// Interfaz para almacenar el resultado de la búsqueda por referencia
interface ReferenceMatch {
  order: OrderWithPayments;
  referenceNumber: string;
}

export function OrdersModule() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithPayments[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pendiente' | 'pagado'>('all');
  const [exchangeRate, setExchangeRate] = useState(0);

  // 1. Nuevo estado para guardar la coincidencia de referencia
  const [referenceMatch, setReferenceMatch] = useState<ReferenceMatch | null>(null);


  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, filterStatus]);

  const loadOrders = async () => {
    if (!user) return;

    // Tu lógica de carga de órdenes permanece igual
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

  const filterOrders = () => {
    let filtered = orders;
    const lowerCaseSearch = searchTerm.toLowerCase();
    
    // Resetear la coincidencia de referencia
    setReferenceMatch(null); 

    if (searchTerm) {
      
      // 2. Lógica de Búsqueda por Número de Referencia (Máxima Prioridad)
      const referenceMatchResult = orders.find(order => 
        order.payments.some(payment => 
          payment.reference_number && 
          payment.reference_number.toLowerCase() === lowerCaseSearch // Búsqueda exacta en referencia
        )
      );

      if (referenceMatchResult) {
        // Encontramos un pago que coincide exactamente con la referencia.
        const matchingPayment = referenceMatchResult.payments.find(p => 
            p.reference_number && p.reference_number.toLowerCase() === lowerCaseSearch
        );
        
        if (matchingPayment) {
            setReferenceMatch({ 
                order: referenceMatchResult, 
                referenceNumber: matchingPayment.reference_number 
            });
            // Mostrar solo la orden que coincide con la referencia
            filtered = [referenceMatchResult]; 
        } else {
             // Si no hay match de referencia, volvemos a la búsqueda de cliente
             filtered = orders.filter((order) =>
              order.customer_name.toLowerCase().includes(lowerCaseSearch)
            );
        }

      } else {
        // 3. Lógica de Búsqueda por Nombre de Cliente (Si no hay match de referencia)
        filtered = orders.filter((order) =>
          order.customer_name.toLowerCase().includes(lowerCaseSearch) // Búsqueda parcial en nombre
        );
      }
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((order) => order.status === filterStatus);
    }

    setFilteredOrders(filtered);
  };
  
  // ... (Tus otras funciones permanecen igual: handleDelete, getTotalPaid, getCustomerTotals, globalTotals) ...
  
  // Tu función handleDelete

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este encargo?')) return;

    const { error } = await supabase.from('orders').delete().eq('id', id);

    if (!error) {
      loadOrders();
    }
  };

  const getTotalPaid = (payments: Payment[]) => {
    return payments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
  };

  const getCustomerTotals = (customerName: string) => {
    const customerOrders = orders.filter(
      (order) => order.customer_name.toLowerCase() === customerName.toLowerCase()
    );

    const totalDebt = customerOrders.reduce((sum, order) => {
      if (order.status === 'pendiente') {
        const paid = getTotalPaid(order.payments);
        return sum + (parseFloat(order.sale_price.toString()) - paid);
      }
      return sum;
    }, 0);

    return { totalDebt, orderCount: customerOrders.length };
  };

  const globalTotals = filteredOrders.reduce(
    (acc, order) => {
      const investment = parseFloat(order.purchase_price.toString());
      const revenue = parseFloat(order.sale_price.toString());
      const profit = parseFloat(order.profit.toString());
      return {
        totalInvestment: acc.totalInvestment + investment,
        totalRevenue: acc.totalRevenue + revenue,
        totalProfit: acc.totalProfit + profit,
      };
    },
    { totalInvestment: 0, totalRevenue: 0, totalProfit: 0 }
  );


  return (
    <div className="space-y-6">
      {/* ... (Tu sección de Totales Globales) ... */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-lg shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-slate-200 text-sm">Inversión Total</p>
            <p className="text-3xl font-bold">${globalTotals.totalInvestment.toFixed(2)}</p>
            {exchangeRate > 0 && (
              <p className="text-slate-200 text-sm">
                Bs. {(globalTotals.totalInvestment * exchangeRate).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <p className="text-slate-200 text-sm">Ingresos Totales</p>
            <p className="text-3xl font-bold">${globalTotals.totalRevenue.toFixed(2)}</p>
            {exchangeRate > 0 && (
              <p className="text-slate-200 text-sm">
                Bs. {(globalTotals.totalRevenue * exchangeRate).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <p className="text-slate-200 text-sm">Ganancia Total</p>
            <p className="text-3xl font-bold">${globalTotals.totalProfit.toFixed(2)}</p>
            {exchangeRate > 0 && (
              <p className="text-slate-200 text-sm">
                Bs. {(globalTotals.totalProfit * exchangeRate).toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre o número de referencia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          />
        </div>
        {/* ... (Tus controles de filtro de estado y nuevo encargo) ... */}
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          >
            <option value="all">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="pagado">Pagados</option>
          </select>
          <button
            onClick={() => {
              setEditOrder(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Encargo
          </button>
        </div>
      </div>
      
      {/* 4. Mostrar información de coincidencia por Referencia */}
      {referenceMatch && searchTerm && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <h4 className="text-green-900 font-bold mb-1">
                ✅ Referencia Encontrada: {referenceMatch.referenceNumber}
            </h4>
            <p className="text-green-800 font-semibold">
                Cliente: {referenceMatch.order.customer_name}
            </p>
            <p className="text-green-700 text-sm">
                Pedido: {referenceMatch.order.product_description} (Total: ${parseFloat(referenceMatch.order.sale_price.toString()).toFixed(2)})
            </p>
        </div>
      )}

      {searchTerm && !referenceMatch && filteredOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-blue-900 font-semibold">
            Deuda total de "{searchTerm}": $
            {getCustomerTotals(searchTerm).totalDebt.toFixed(2)}
          </p>
          <p className="text-blue-700 text-sm">
            {getCustomerTotals(searchTerm).orderCount} encargo(s) encontrado(s)
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredOrders.map((order) => {
          const totalPaid = getTotalPaid(order.payments);
          const remaining = parseFloat(order.sale_price.toString()) - totalPaid;

          return (
            <div
              key={order.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 text-lg">
                    {order.customer_name}
                  </h3>
                  <p className="text-slate-600 text-sm">{order.product_description}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    {new Date(order.order_date).toLocaleDateString('es-VE')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPaymentModal(order.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Gestionar pagos"
                  >
                    <DollarSign className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditOrder(order);
                      setShowForm(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(order.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            
            {/* Si es una coincidencia por referencia, resaltamos el pago */}
            {referenceMatch && referenceMatch.order.id === order.id && (
                <div className="mt-2 p-2 bg-green-50 border-l-4 border-green-500 text-xs text-green-800 font-semibold">
                    Pago con Ref. {referenceMatch.referenceNumber} encontrado.
                </div>
            )}
            
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                {/* ... (Tus detalles de orden: Compra, Venta, Ganancia, etc.) ... */}
                <div>
                  <p className="text-slate-500">Compra</p>
                  <p className="font-semibold">${parseFloat(order.purchase_price.toString()).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Venta</p>
                  <p className="font-semibold">${parseFloat(order.sale_price.toString()).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Ganancia</p>
                  <p className="font-semibold text-green-600">
                    ${parseFloat(order.profit.toString()).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Abonado</p>
                  <p className="font-semibold text-blue-600">${totalPaid.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Mercancía</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    order.merchandise_status === 'comprada'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {order.merchandise_status === 'comprada' ? 'Comprada' : 'Por Comprar'}
                  </span>
                </div>
                <div>
                  <p className="text-slate-500">Pago</p>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                      order.status === 'pagado'
                        ? 'bg-green-100 text-green-800'
                        : remaining > 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {order.status === 'pagado' ? 'Pagado' : `Debe $${remaining.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* ... (Tu mensaje de no encontrados) ... */}
        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No se encontraron encargos
          </div>
        )}
      </div>
      
      {/* ... (Tus modales de OrderForm y PaymentModal) ... */}
      {showForm && (
        <OrderForm
          onClose={() => {
            setShowForm(false);
            setEditOrder(null);
          }}
          onSuccess={loadOrders}
          editOrder={editOrder}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          orderId={showPaymentModal}
          orderTotal={
            parseFloat(
              orders.find((o) => o.id === showPaymentModal)?.sale_price.toString() || '0'
            )
          }
          customerName={
            orders.find((o) => o.id === showPaymentModal)?.customer_name || ''
          }
          onClose={() => setShowPaymentModal(null)}
          onSuccess={loadOrders}
        />
      )}
    </div>
  );
}