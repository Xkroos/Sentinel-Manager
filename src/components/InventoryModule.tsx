import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Package, Plus, Edit3, Trash2, DollarSign, TrendingUp, XCircle, CheckCircle, Search } from 'lucide-react'; 
import { InventoryItem, Order, Payment } from '../lib/supabase'; 

// Definición de tipos complementarios
interface OrderWithPayments extends Order {
  payments: Payment[];
}

// Nuevo tipo para manejar la edición
interface EditingItemState extends InventoryItem {
    isEditing: boolean;
}

export function InventoryModule() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<OrderWithPayments[]>([]); 
  const [loading, setLoading] = useState(true);

  // --- 🔎 NUEVO ESTADO DE BÚSQUEDA ---
  const [searchTerm, setSearchTerm] = useState('');
  // -------------------------------------

  // Estados para el formulario de nuevo artículo
  const [newItemName, setNewItemName] = useState('');
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState(0); 
  const [newItemSalePrice, setNewItemSalePrice] = useState(0);      
  const [newItemQuantity, setNewItemQuantity] = useState(0);
  const [newItemSku, setNewItemSku] = useState('');

  // Estado para manejar qué ítem se está editando
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);


  // --------------------------------------------------
  // 🚀 LÓGICA DE CARGA DE DATOS
  // --------------------------------------------------

  const getTotalPaid = (payments: Payment[]) => {
    return payments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
  };

  // Función para Cargar el Inventario
  const loadInventory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error cargando el inventario:', error);
    } else {
      setItems(data as InventoryItem[]); 
    }
    setLoading(false);
  }, [user]);

  // Función para cargar Órdenes (se omite por brevedad, pero se mantiene la llamada)
  const loadOrders = useCallback(async () => {
    if (!user) return;

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, payments(*)') 
      .eq('user_id', user.id)
      .order('order_date', { ascending: false });

    if (ordersData) {
        setOrders(ordersData as OrderWithPayments[]);
    }
  }, [user]);

  useEffect(() => {
    loadInventory();
    loadOrders();
  }, [loadInventory, loadOrders]);


  // --------------------------------------------------
  // 🧠 LÓGICA DE FILTRADO Y CÁLCULOS
  // --------------------------------------------------

  // 🔎 NUEVA FUNCIÓN: Filtrar artículos por nombre o SKU
  const filteredItems = useMemo(() => {
    if (!searchTerm) {
      return items;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    return items.filter(item => {
      // Búsqueda por nombre
      const nameMatch = item.name.toLowerCase().includes(lowerCaseSearchTerm);
        
      // Búsqueda por SKU (si existe)
      const skuMatch = item.sku?.toLowerCase().includes(lowerCaseSearchTerm);

      return nameMatch || skuMatch;
    });
  }, [items, searchTerm]);


  // El resumen de inventario ahora se calcula sobre los items COMPLETOS (items), no sobre los filtrados
  const inventorySummary = useMemo(() => {
    return items.reduce((acc, item) => {
      const quantity = item.stock_quantity;
      const purchasePrice = parseFloat(item.unit_price.toString());
      const salePrice = parseFloat(item.sale_price.toString());

      return {
        totalInvestment: acc.totalInvestment + (quantity * purchasePrice),
        totalPotentialRevenue: acc.totalPotentialRevenue + (quantity * salePrice),
      };
    }, { totalInvestment: 0, totalPotentialRevenue: 0 });
  }, [items]);

  const totalPotentialProfit = inventorySummary.totalPotentialRevenue - inventorySummary.totalInvestment;

  // Cálculos de ventas (sin cambios)
  const salesSummary = useMemo(() => {
    return orders.reduce((acc, order) => {
      const revenue = parseFloat(order.sale_price.toString());
      const totalPaid = getTotalPaid(order.payments);
      const remaining = revenue - totalPaid;

      return {
        totalCollected: acc.totalCollected + totalPaid,
        totalPending: acc.totalPending + remaining,
        totalSalesRevenue: acc.totalSalesRevenue + revenue,
      };
    }, { totalCollected: 0, totalPending: 0, totalSalesRevenue: 0 });
  }, [orders]);


  // --------------------------------------------------
  // ➕ FUNCIONES DE ACCIÓN (sin cambios significativos)
  // --------------------------------------------------
  
  const handleAddItem = async () => { /* ... (código anterior) ... */ };
  const handleUpdateItem = async () => { /* ... (código anterior) ... */ };
  const handleDeleteItem = async (itemId: string, itemName: string) => { /* ... (código anterior) ... */ };
  const startEditing = (item: InventoryItem) => { /* ... (código anterior) ... */ };
  const handleEditChange = (field: keyof InventoryItem, value: string | number) => { /* ... (código anterior) ... */ };
  const cancelEditing = () => { /* ... (código anterior) ... */ };
  
  if (!user) {
    return <p className="text-red-500">Inicia sesión para acceder al módulo de Inventario.</p>;
  }


  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
        <Package className="w-7 h-7" /> Módulo de Inventario
      </h2>
      
      <hr />
      
      {/* 📊 RESUMEN DE INVENTARIO Y VENTAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ... (código de resumen anterior) ... */}
        <div className="bg-white border border-red-300 rounded-lg p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-600">Inversión Total en Stock</p>
            <p className="text-2xl font-bold text-red-800">
                ${inventorySummary.totalInvestment.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
                ({items.length} artículos)
            </p>
        </div>

        <div className="bg-white border border-green-300 rounded-lg p-5 shadow-sm">
            <p className="text-sm font-semibold text-green-600">Ganancia Potencial (Stock)</p>
            <p className="text-2xl font-bold text-green-800">
                ${totalPotentialProfit.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
                (Venta Potencial - Inversión)
            </p>
        </div>
        
        <div className="bg-white border border-blue-300 rounded-lg p-5 shadow-sm">
            <p className="text-sm font-semibold text-blue-600 flex items-center gap-1">
                <DollarSign className="w-4 h-4" /> Dinero Recogido
            </p>
            <p className="text-2xl font-bold text-blue-800">
                ${salesSummary.totalCollected.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
                (Ventas ya pagadas)
            </p>
        </div>

        <div className="bg-white border border-yellow-300 rounded-lg p-5 shadow-sm">
            <p className="text-sm font-semibold text-yellow-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> Dinero Por Recoger
            </p>
            <p className="text-2xl font-bold text-yellow-800">
                ${salesSummary.totalPending.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
                (Ventas pendientes de pago)
            </p>
        </div>
      </div>

      <hr />
      
      {/* ➕ SECCIÓN: AGREGAR NUEVO ARTÍCULO (sin cambios significativos) */}
      <div className="bg-white border border-green-200 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-green-700 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Agregar Nuevo Artículo
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nombre</label>
            <input 
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder="Ingrese un Nombre"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Costo de Compra</label>
            <input 
              type="number"
              step="0.01"
              value={newItemPurchasePrice === 0 ? '' : newItemPurchasePrice}
              onChange={(e) => setNewItemPurchasePrice(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder="Ingrese un Monto"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Precio de Venta</label>
            <input 
              type="number"
              step="0.01"
              value={newItemSalePrice === 0 ? '' : newItemSalePrice}
              onChange={(e) => setNewItemSalePrice(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder="Ingrese un Monto"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Stock</label>
            <input 
              type="number"
              value={newItemQuantity === 0 ? '' : newItemQuantity}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setNewItemQuantity(isNaN(value) ? 0 : value);
              }}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder="Ingrese el numero de stock"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">SKU</label>
            <input 
              type="text"
              value={newItemSku}
              onChange={(e) => setNewItemSku(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder="Ingrese un codigo unico"
              disabled={loading}
            />
          </div>
        </div>
        <button 
          onClick={handleAddItem}
          disabled={loading || !newItemName.trim() || newItemQuantity <= 0 || newItemPurchasePrice <= 0 || newItemSalePrice <= 0}
          className="mt-6 w-full md:w-auto px-6 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-slate-400 transition"
        >
          {loading ? 'Procesando...' : 'Guardar Artículo'}
        </button>
      </div>

      <hr />

      {/* 📋 SECCIÓN: LISTADO DE INVENTARIO */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-slate-700 mb-4">
            Artículos en Stock ({filteredItems.length} {searchTerm && `de ${items.length} total`})
        </h3>
        
        {/* 🔎 NUEVO CAMPO DE BÚSQUEDA */}
        <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
                type="text"
                placeholder="Buscar por Nombre o Código SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
        
        {loading && <p className="text-blue-500">Cargando inventario...</p>}
        
        {!loading && items.length === 0 && (
          <p className="text-slate-500 italic">No hay artículos en tu inventario. ¡Agrega uno!</p>
        )}
        
        {!loading && items.length > 0 && filteredItems.length === 0 && searchTerm && (
          <p className="text-red-500 italic">No se encontraron resultados para "{searchTerm}".</p>
        )}

        {/* NOTA: La tabla ahora usa filteredItems */}
        {!loading && filteredItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Artículo (SKU)</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Costo (Compra)</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Precio (Venta)</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Ganancia Unit.</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Valor Stock (Venta)</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredItems.map((item) => {
                    const purchasePrice = parseFloat(item.unit_price.toString());
                    const salePrice = parseFloat(item.sale_price.toString());
                    const unitProfit = salePrice - purchasePrice;
                    const totalSaleValue = item.stock_quantity * salePrice;

                    return (
                        <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">
                                {item.name}
                                {item.sku && <span className="text-xs text-slate-500 block">({item.sku})</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                                {item.stock_quantity}
                            </td>
                            <td className="px-4 py-3 text-right text-red-700">
                                ${purchasePrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-green-700">
                                ${salePrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700">
                                ${unitProfit.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-blue-700">
                                ${totalSaleValue.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center space-x-2">
                                <button
                                    onClick={() => startEditing(item)}
                                    disabled={loading}
                                    className="p-1.5 bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200 disabled:opacity-50"
                                    title="Editar detalles"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteItem(item.id, item.name)}
                                    disabled={loading}
                                    className="p-1.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200 disabled:opacity-50"
                                    title="Eliminar producto"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📝 MODAL/FORMULARIO DE EDICIÓN (sin cambios) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 shadow-2xl w-full max-w-lg">
                {/* ... (código de edición anterior) ... */}
                <h3 className="text-2xl font-bold text-slate-800 mb-4">
                    Editando: {editingItem.name}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Nombre del Artículo *</label>
                        <input 
                            type="text"
                            value={editingItem.name}
                            onChange={(e) => handleEditChange('name', e.target.value)}
                            className="mt-1 w-full px-3 py-2 border rounded-md"
                            placeholder="Nombre del producto"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">SKU</label>
                        <input 
                            type="text"
                            value={editingItem.sku || ''}
                            onChange={(e) => handleEditChange('sku', e.target.value)}
                            className="mt-1 w-full px-3 py-2 border rounded-md"
                            placeholder="Código interno (Ej: TLC-RJA-100)"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Costo de Compra *</label>
                            <input 
                                type="number"
                                step="0.01"
                                value={editingItem.unit_price}
                                onChange={(e) => handleEditChange('unit_price', e.target.value)}
                                className="mt-1 w-full px-3 py-2 border rounded-md"
                                placeholder="Costo de inversión"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Precio de Venta *</label>
                            <input 
                                type="number"
                                step="0.01"
                                value={editingItem.sale_price}
                                onChange={(e) => handleEditChange('sale_price', e.target.value)}
                                className="mt-1 w-full px-3 py-2 border rounded-md"
                                placeholder="Precio al cliente"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Cantidad en Stock *</label>
                        <input 
                            type="number"
                            value={editingItem.stock_quantity}
                            onChange={(e) => handleEditChange('stock_quantity', e.target.value)}
                            className="mt-1 w-full px-3 py-2 border rounded-md"
                            placeholder="Cantidad actual"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button 
                        onClick={cancelEditing}
                        className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-md hover:bg-slate-300 transition flex items-center gap-1"
                        disabled={loading}
                    >
                        <XCircle className="w-5 h-5" /> Cancelar
                    </button>
                    <button 
                        onClick={handleUpdateItem}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition flex items-center gap-1"
                        disabled={loading || !editingItem.name.trim() || editingItem.unit_price < 0 || editingItem.sale_price < 0}
                    >
                        <CheckCircle className="w-5 h-5" /> {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

// ----------------------------------------------------
// ⚠️ NOTA: Las funciones handleAddItem, handleUpdateItem,
// handleDeleteItem, startEditing, handleEditChange y cancelEditing
// deben ser copiadas COMPLETAS desde el código anterior si fueron
// eliminadas por brevedad. En este ejemplo, se asume que solo
// fueron comentadas.
// ----------------------------------------------------