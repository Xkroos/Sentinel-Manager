import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
    TrendingUp, DollarSign, ShoppingBag, Calendar, X, 
    ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, 
    User, Clock 
} from 'lucide-react'; 
import { Order, Payment } from '../lib/supabase'; 
import { useExchangeRate } from '../hooks/useExchangeRate'; 
import { format } from 'date-fns';
import { es } from 'date-fns/locale'; 

// ====================================================================
// TIPOS DE DATOS (Sin cambios)
// ====================================================================

interface OrderWithPayments extends Order {
    payments: Payment[];
}

interface OrderDetails {
    id: string;
    order_date: Date;
    remaining: number;
    first_due: Date;
    second_due: Date;
    is_fully_paid: boolean;
}

interface CustomerDebt {
    customer_name: string;
    total_due: number;
    earliest_due_date: Date | null;
    orders_pending: OrderDetails[];
}

interface CalendarEvent {
    date: Date;
    customer_name: string;
    type: 'Primer Abono' | 'Segundo Abono';
    order_id: string;
    amount_remaining: number;
    is_overdue: boolean;
    original_order_date: Date; 
}

interface DailyInfo {
    date: Date;
    events: CalendarEvent[];
    totalDueToday: number;
}

// ====================================================================
// 1. MODAL DE DETALLES DEL DÍA (DayDetailsModal)
// ====================================================================

interface DayDetailsModalProps {
    dailyInfo: DailyInfo;
    onClose: () => void;
    onViewOrderDetails: (orderId: string) => void;
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({ dailyInfo, onClose, onViewOrderDetails }) => {
    
    // Aquí onViewOrderDetails SÍ se usa dentro del onClick, el linter debería estar contento.
    const pendingEvents = dailyInfo.events.filter(e => e.amount_remaining > 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold">
    {/* 🚀 PATRÓN ALTERNATIVO DE UNA LÍNEA: EEEE, d 'de' MMMM 'de' yyyy */}
    {format(dailyInfo.date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
</h3>
                    <button onClick={onClose} className="text-blue-200 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Contenido */}
                <div className="p-4 flex-1 overflow-y-auto">
                    {pendingEvents.length === 0 ? (
                        <div className="text-center p-6 bg-green-50 rounded-lg">
                            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
                            <p className="text-lg font-medium text-green-800">No hay abonos pendientes este día.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-3 bg-yellow-100 rounded-lg border-l-4 border-yellow-500">
                                <p className="text-sm font-semibold text-yellow-800">
                                    Total a Cobrar Estimado: <span className="text-xl font-bold">${dailyInfo.totalDueToday.toFixed(2)}</span>
                                </p>
                            </div>

                            {pendingEvents.map((event, index) => (
                                <div key={index} className={`p-3 rounded-lg border ${event.is_overdue ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-start justify-between">
                                        
                                        {/* Columna Izquierda */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <User className="w-4 h-4 text-slate-700"/>
                                                <span className="font-semibold text-slate-800">{event.customer_name}</span>
                                            </div>
                                            
                                            <p className="text-xs text-slate-500 ml-6">
                                                <Clock className='w-3 h-3 inline mr-1'/> 
                                                Fecha de Compra: {format(event.original_order_date, 'd/MMM/yy', { locale: es })}
                                            </p>

                                             <p className="text-md font-bold text-slate-900 mt-1 ml-6">
                                                Deuda Total del Encargo: <span className='text-green-600'>${event.amount_remaining.toFixed(2)}</span>
                                            </p>
                                        </div>

                                        {/* Columna Derecha con botón */}
                                        <div className='flex flex-col items-end gap-2'>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${event.is_overdue ? 'bg-red-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                                                {event.type}
                                            </span>
                                            
                                            
                                        </div>
                                    </div>
                                    
                                    {event.is_overdue && (
                                        <p className="flex items-center gap-1 text-xs font-bold text-red-600 mt-2 ml-6">
                                            <AlertTriangle className='w-3 h-3' /> ¡Vencido!
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ====================================================================
// 2. VISTA DE CALENDARIO MENSUAL (PaymentCalendar)
// ====================================================================

interface PaymentCalendarProps {
    customerDebts: CustomerDebt[];
    onClose: () => void;
    onViewOrderDetails: (orderId: string) => void; 
}

const PaymentCalendar: React.FC<PaymentCalendarProps> = ({ customerDebts, onClose, onViewOrderDetails }) => {
    
    // Aquí onViewOrderDetails SÍ se usa en el useCallback y como dependencia.
    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [selectedDayInfo, setSelectedDayInfo] = useState<DailyInfo | null>(null);
    
    const startOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
    const endOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), [currentDate]);

    // Función que usa onViewOrderDetails para pasarlo al componente padre
    const handleViewOrderDetails = useCallback((orderId: string) => {
        setSelectedDayInfo(null); 
        onViewOrderDetails(orderId); // 👈 Uso de onViewOrderDetails
    }, [onViewOrderDetails]); // 👈 Uso como dependencia


    // Generar eventos (Sin cambios)
    const allEvents = useMemo<CalendarEvent[]>(() => {
        const events: CalendarEvent[] = [];
        customerDebts.forEach(debt => {
            debt.orders_pending.forEach(order => {
                const now = new Date();
                
                if (order.remaining <= 0) return;

                // Primer Abono (15 días)
                events.push({
                    date: order.first_due,
                    customer_name: debt.customer_name,
                    type: 'Primer Abono',
                    order_id: order.id,
                    amount_remaining: order.remaining,
                    is_overdue: order.first_due < now,
                    original_order_date: order.order_date, 
                });

                // Segundo Abono (30 días)
                 events.push({
                    date: order.second_due,
                    customer_name: debt.customer_name,
                    type: 'Segundo Abono',
                    order_id: order.id,
                    amount_remaining: order.remaining,
                    is_overdue: order.second_due < now,
                    original_order_date: order.order_date, 
                });
            });
        });
        return events;
    }, [customerDebts]);

    // Agrupar eventos por día (Sin cambios)
    const groupedEvents = useMemo(() => {
        return allEvents.reduce((acc, event) => {
            const dateKey = format(event.date, 'yyyy-MM-dd');
            if (!acc[dateKey]) {
                acc[dateKey] = {
                    date: event.date,
                    events: [],
                    totalDueToday: 0,
                };
            }
            if (event.amount_remaining > 0) {
                 acc[dateKey].events.push(event);
                 acc[dateKey].totalDueToday += event.amount_remaining / 2; 
            }
            return acc;
        }, {} as Record<string, DailyInfo>);
    }, [allEvents]);

    // Generar la cuadrícula del calendario (Sin cambios)
    const calendarDays = useMemo(() => {
        const days = [];
        const monthStartDay = startOfMonth.getDay(); 
        const startingDayIndex = monthStartDay === 0 ? 6 : monthStartDay - 1;

        const prevMonthLastDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
        for (let i = startingDayIndex; i > 0; i--) {
             days.push({ 
                date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthLastDay - i + 1), 
                isCurrentMonth: false 
             });
        }
        
        for (let i = 1; i <= endOfMonth.getDate(); i++) {
            days.push({ 
                date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i), 
                isCurrentMonth: true 
            });
        }

        const remainingCells = 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) {
            days.push({
                date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i),
                isCurrentMonth: false
            });
        }

        return days.slice(0, 42); 
    }, [currentDate, startOfMonth, endOfMonth]);


    const handlePrevMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }, []);

    const handleNextMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }, []);

    const handleDayClick = useCallback((date: Date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const info = groupedEvents[dateKey] || { 
            date: date, 
            events: [], 
            totalDueToday: 0 
        };
        setSelectedDayInfo(info);
    }, [groupedEvents]);

    const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                
                {/* Header y Navegación */}
                <div className="bg-slate-700 text-white px-6 py-4 flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Calendar className="w-6 h-6" /> Control de Abonos Pendientes
                    </h2>
                    <button onClick={onClose} className="text-slate-300 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex justify-between items-center p-4 border-b">
                    <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft className="w-5 h-5 text-slate-700" /></button>
                    <h3 className="text-xl font-bold text-slate-800">{format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()}</h3>
                    <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight className="w-5 h-5 text-slate-700" /></button>
                </div>

                {/* Cuadrícula del Calendario (Sin cambios) */}
                <div className="p-4 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-7 text-center font-semibold text-sm text-slate-500 border-b border-slate-200">
                        {daysOfWeek.map(day => (<div key={day} className="py-2">{day}</div>))}
                    </div>
                    <div className="grid grid-cols-7 grid-rows-6 h-full gap-px bg-slate-200 border border-slate-200">
                        {calendarDays.map((dayInfo, index) => {
                            const dateKey = format(dayInfo.date, 'yyyy-MM-dd');
                            const dailyData = groupedEvents[dateKey];
                            const hasPaymentDue = dailyData && dailyData.events.length > 0;
                            const isToday = dateKey === todayKey;
                            const isOverdue = hasPaymentDue && dailyData!.events.some(e => e.is_overdue);

                            let cellClasses = 'h-32 p-1 text-right relative transition-all duration-100 cursor-pointer ';
                            cellClasses += dayInfo.isCurrentMonth ? 'bg-white hover:bg-blue-50' : 'bg-slate-50 text-slate-400 hover:bg-slate-100';
                            if (isToday) {cellClasses += ' border-2 border-blue-500';}
                            if (hasPaymentDue) {cellClasses += isOverdue ? ' bg-red-100 hover:bg-red-200' : ' bg-yellow-50 hover:bg-yellow-100';}

                            return (
                                <div key={index} className={cellClasses} onClick={() => handleDayClick(dayInfo.date)}>
                                    <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : ''}`}>{dayInfo.date.getDate()}</span>
                                    {dailyData && dailyData.events.length > 0 && (
                                        <div className='absolute bottom-1 left-1 right-1 p-1'>
                                            <div className='flex items-center justify-end'>
                                                <Clock className={`w-3 h-3 ${isOverdue ? 'text-red-700' : 'text-yellow-700'} mr-1`} />
                                                <span className={`text-xs font-bold ${isOverdue ? 'text-red-700' : 'text-yellow-700'}`}>${dailyData.totalDueToday.toFixed(2)}</span>
                                            </div>
                                            <p className='text-xs text-center mt-1 text-slate-600'>{dailyData.events.length} abono{dailyData.events.length > 1 ? 's' : ''}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal de Detalles del Día */}
            {selectedDayInfo && (
                <DayDetailsModal 
                    dailyInfo={selectedDayInfo} 
                    onClose={() => setSelectedDayInfo(null)}
                    onViewOrderDetails={handleViewOrderDetails} 
                />
            )}
        </div>
    );
};


// ====================================================================
// 3. COMPONENTE PRINCIPAL: StatisticsModule
// ====================================================================

export function StatisticsModule() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<OrderWithPayments[]>([]);
    const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false); 
    const { rate: exchangeRate } = useExchangeRate();

    // 🚀 2. DECLARACIÓN DEL HOOK DE NAVEGACIÓN
    const navigate = useNavigate(); 
    

    useEffect(() => {
        if (user) {
            loadOrders();
        }
    }, [user]);

    const loadOrders = async () => { /* ... (Lógica de carga de órdenes) ... */
        if (!user) return;
        const { data: ordersData } = await supabase.from('orders').select('*').eq('user_id', user.id).order('order_date', { ascending: false });
        if (ordersData) {
            const ordersWithPayments = await Promise.all(
                ordersData.map(async (order) => {
                    const { data: payments } = await supabase.from('payments').select('*').eq('order_id', order.id);
                    return { ...order, payments: payments || [], };
                })
            );
            setOrders(ordersWithPayments as OrderWithPayments[]);
        }
    };

    // Lógica de Agrupación de Deudas (Sin cambios)
    const customerDebts = useMemo<CustomerDebt[]>(() => {
        const debtMap = new Map<string, CustomerDebt>();
        orders.forEach(order => {
            const paidAmount = order.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
            const remaining = Math.max(0, parseFloat(order.sale_price.toString()) - paidAmount);
            if (remaining <= 0) return; 

            const orderDate = new Date(order.order_date);
            const firstDue = new Date(orderDate); firstDue.setDate(orderDate.getDate() + 15);
            const secondDue = new Date(orderDate); secondDue.setDate(orderDate.getDate() + 30);
            
            const currentDebt = debtMap.get(order.customer_name) || { customer_name: order.customer_name, total_due: 0, earliest_due_date: null, orders_pending: [], };
            currentDebt.total_due += remaining;

            const today = new Date();
            let nextDueDate: Date | null = null;
            if (remaining > 0) {
                 if (firstDue > today) { nextDueDate = firstDue; } 
                 else if (secondDue > today) { nextDueDate = secondDue; } 
                 else { nextDueDate = secondDue; } 
            }
            if (nextDueDate && (!currentDebt.earliest_due_date || nextDueDate < currentDebt.earliest_due_date)) {
                currentDebt.earliest_due_date = nextDueDate;
            }

            currentDebt.orders_pending.push({
                id: order.id, order_date: orderDate, remaining: remaining, first_due: firstDue, second_due: secondDue, is_fully_paid: false,
            });

            debtMap.set(order.customer_name, currentDebt);
        });
        return Array.from(debtMap.values()).sort((a, b) => {
            if (!a.earliest_due_date) return 1;
            if (!b.earliest_due_date) return -1;
            return a.earliest_due_date.getTime() - b.earliest_due_date.getTime();
        });
    }, [orders]);


    // ✅ FUNCIÓN DE REDIRECCIÓN IMPLEMENTADA
    const handleViewOrderDetailsFromCalendar = (orderId: string) => {
        // 1. Cerrar el modal del calendario
        setIsCalendarOpen(false); 

        // 🚀 3. REDIRECCIÓN REAL USANDO REACT ROUTER
        navigate(`/abonos/detalle/${orderId}`); 
        
        console.log(`[REDIRECCIÓN EJECUTADA] Navegando a: /abonos/detalle/${orderId}`);
    };


    // ... (Lógica de estadísticas se mantiene) ...
    const getDateRange = () => { /* ... */
        const now = new Date(); let startDate = new Date();
        switch (period) {
            case 'week': startDate.setDate(now.getDate() - 7); break;
            case 'month': startDate.setMonth(now.getMonth() - 1); break;
            case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
        }
        return startDate;
    };
    const filteredOrders = orders.filter((order) => new Date(order.order_date) >= getDateRange());
    const stats = filteredOrders.reduce((acc, order) => { /* ... */
        const revenue = parseFloat(order.sale_price.toString());
        const investment = parseFloat(order.purchase_price.toString());
        const profit = parseFloat(order.profit.toString());
        const totalPaid = order.payments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
        return { totalRevenue: acc.totalRevenue + revenue, totalInvestment: acc.totalInvestment + investment, totalProfit: acc.totalProfit + profit, totalPaid: acc.totalPaid + totalPaid, orderCount: acc.orderCount + 1, paidOrders: order.status === 'pagado' ? acc.paidOrders + 1 : acc.paidOrders, };
    }, { totalRevenue: 0, totalInvestment: 0, totalProfit: 0, totalPaid: 0, orderCount: 0, paidOrders: 0 });
    const profitMargin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
    const getPeriodLabel = () => {
        switch (period) {
            case 'week': return 'Última Semana';
            case 'month': return 'Último Mes';
            case 'year': return 'Último Año';
        }
    };


    return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Estadísticas</h2>
        <div className="flex gap-2">
            {/* BOTÓN PARA ABRIR EL CALENDARIO */}
            <button
                onClick={() => setIsCalendarOpen(true)}
                className="px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
            >
                <Calendar className="w-5 h-5" />
                Control de Abonos
            </button>
            <button onClick={() => setPeriod('week')} className={`px-4 py-2 rounded-lg transition-colors ${period === 'week' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Semana</button>
          <button onClick={() => setPeriod('month')} className={`px-4 py-2 rounded-lg transition-colors ${period === 'month' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Mes</button>
          <button onClick={() => setPeriod('year')} className={`px-4 py-2 rounded-lg transition-colors ${period === 'year' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Año</button>
        </div>
      </div>
        
      {/* Bloque de resumen de periodo (Sin cambios) */}
      <div className="bg-slate-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 text-slate-700"><Calendar className="w-5 h-5" /><span className="font-medium">Período: {getPeriodLabel()}</span></div>
      </div>

      {/* Tarjetas de estadísticas (Sin cambios) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Encargos */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><div className="p-3 bg-blue-100 rounded-lg"><ShoppingBag className="w-6 h-6 text-blue-600" /></div><div><p className="text-slate-600 text-sm">Total Encargos</p><p className="text-2xl font-bold text-slate-800">{stats.orderCount}</p></div></div><div className="text-sm text-slate-600"><p>Pagados: {stats.paidOrders}</p><p>Pendientes: {stats.orderCount - stats.paidOrders}</p></div></div>
        {/* Ganancia Total */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><div className="p-3 bg-green-100 rounded-lg"><TrendingUp className="w-6 h-6 text-green-600" /></div><div><p className="text-slate-600 text-sm">Ganancia Total</p><p className="text-2xl font-bold text-slate-800">${stats.totalProfit.toFixed(2)}</p></div></div>{exchangeRate > 0 && (<p className="text-sm text-slate-600">Bs. {(stats.totalProfit * exchangeRate).toFixed(2)}</p>)}<p className="text-sm text-slate-600 mt-2">Margen: {profitMargin.toFixed(1)}%</p></div>
        {/* Inversión Total */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><div className="p-3 bg-red-100 rounded-lg"><DollarSign className="w-6 h-6 text-red-600" /></div><div><p className="text-slate-600 text-sm">Inversión Total</p><p className="text-2xl font-bold text-slate-800">${stats.totalInvestment.toFixed(2)}</p></div></div>{exchangeRate > 0 && (<p className="text-sm text-slate-600">Bs. {(stats.totalInvestment * exchangeRate).toFixed(2)}</p>)}</div>
        {/* Ingresos Totales */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><div className="p-3 bg-slate-100 rounded-lg"><DollarSign className="w-6 h-6 text-slate-600" /></div><div><p className="text-slate-600 text-sm">Ingresos Totales</p><p className="text-2xl font-bold text-slate-800">${stats.totalRevenue.toFixed(2)}</p></div></div>{exchangeRate > 0 && (<p className="text-sm text-slate-600">Bs. {(stats.totalRevenue * exchangeRate).toFixed(2)}</p>)}</div>
        {/* Dinero Recibido */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><div className="p-3 bg-green-100 rounded-lg"><DollarSign className="w-6 h-6 text-green-600" /></div><div><p className="text-slate-600 text-sm">Dinero Recibido</p><p className="text-2xl font-bold text-slate-800">${stats.totalPaid.toFixed(2)}</p></div></div>{exchangeRate > 0 && (<p className="text-sm text-slate-600">Bs. {(stats.totalPaid * exchangeRate).toFixed(2)}</p>)}</div>
        {/* Por Cobrar */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><div className="p-3 bg-yellow-100 rounded-lg"><DollarSign className="w-6 h-6 text-yellow-600" /></div><div><p className="text-slate-600 text-sm">Por Cobrar</p><p className="text-2xl font-bold text-slate-800">${(stats.totalRevenue - stats.totalPaid).toFixed(2)}</p></div></div>{exchangeRate > 0 && (<p className="text-sm text-slate-600">Bs. {((stats.totalRevenue - stats.totalPaid) * exchangeRate).toFixed(2)}</p>)}</div>
      </div>

      {/* Tasa de cambio (Sin cambios) */}
      {exchangeRate > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-blue-900 text-sm font-medium">Tasa BCV: Bs. {exchangeRate.toFixed(2)} por dólar</p>
        </div>
      )}

      {/* RENDERIZADO DEL CALENDARIO COMPLETO */}
      {isCalendarOpen && (
        <PaymentCalendar
          customerDebts={customerDebts}
          onClose={() => setIsCalendarOpen(false)}
          onViewOrderDetails={handleViewOrderDetailsFromCalendar} 
        />
      )}
    </div>
  );
}