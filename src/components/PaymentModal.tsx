import { useState, useEffect, useMemo } from 'react'; // <-- Importar useMemo
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Trash2, Search } from 'lucide-react'; // <-- Importar Search
import { Payment } from '../lib/supabase';
import { ImageUpload } from './ImageUpload';

interface PaymentModalProps {
  orderId: string;
  orderTotal: number;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({
  orderId,
  orderTotal,
  customerName,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [imageData, setImageData] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  // 1. Nuevo estado para el término de búsqueda
  const [searchTerm, setSearchTerm] = useState(''); 

  useEffect(() => {
    loadPayments();
  }, [orderId]);

  const loadPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('payment_date', { ascending: false });

    if (data) {
      setPayments(data);
    }
  };

  // 2. Lógica para filtrar los pagos (usa useMemo para optimizar)
  const filteredPayments = useMemo(() => {
    if (!searchTerm) {
      return payments;
    }
    
    const lowerCaseSearch = searchTerm.toLowerCase();

    return payments.filter(payment => 
      payment.reference_number 
        ? payment.reference_number.toLowerCase().includes(lowerCaseSearch)
        : false
    );
  }, [payments, searchTerm]);

  const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
  const remaining = orderTotal - totalPaid;

  const handleSubmit = async (e: React.FormEvent) => {
    // ... (Tu función handleSubmit permanece igual)
    e.preventDefault();
    if (!user || !amount) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('payments').insert([
        {
          order_id: orderId,
          user_id: user.id,
          amount: parseFloat(amount),
          reference_number: referenceNumber,
          payment_image_url: imageData,
        },
      ]);

      if (error) throw error;

      const newTotal = totalPaid + parseFloat(amount);
      if (newTotal >= orderTotal) {
        await supabase
          .from('orders')
          .update({ status: 'pagado' })
          .eq('id', orderId);
      }

      setAmount('');
      setReferenceNumber('');
      setImageData('');
      await loadPayments();
      onSuccess();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error al guardar el pago');
    } finally {
      setLoading(false);
    }
  };


  const handleDeletePayment = async (paymentId: string) => {
    // ... (Tu función handleDeletePayment permanece igual)
    if (!confirm('¿Estás seguro de eliminar este abono?')) return;

    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;
      await loadPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error al eliminar el abono');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            Abonos - {customerName}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-700 font-medium">Total a Pagar:</span>
              <span className="text-slate-900 font-bold">${orderTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700 font-medium">Total Abonado:</span>
              <span className="text-green-600 font-bold">${totalPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-slate-700 font-medium">Restante:</span>
              <span className="text-red-600 font-bold">${remaining.toFixed(2)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ... (Controles de Monto, Referencia e Imagen) ... */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Monto del Abono ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                placeholder="Ingrese el monto"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Número de Referencia
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                placeholder="Ej: 1234567890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Comprobante de Pago (Imagen)
              </label>
              <ImageUpload
                onImageSelected={setImageData}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !amount}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Registrar Abono'}
            </button>
          </form>
          
          {/* 3. Campo de búsqueda de referencia */}
          {payments.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por Número de Referencia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          )}

          {payments.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-slate-800 mb-3">
                Historial de Abonos 
                {searchTerm && ` (${filteredPayments.length} encontrados)`} {/* Indica cuántos se encontraron */}
              </h3>
              <div className="space-y-2">
                {/* Usar filteredPayments en lugar de payments */}
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-slate-50 p-3 rounded-lg flex justify-between items-start"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">
                        ${parseFloat(payment.amount.toString()).toFixed(2)}
                      </p>
                      <p className="text-sm text-slate-600">
                        {new Date(payment.payment_date).toLocaleString('es-VE')}
                      </p>
                      {payment.reference_number && (
                        <p className="text-xs text-slate-500">
                          Ref: {payment.reference_number}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      {payment.payment_image_url && (
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = payment.payment_image_url;
                            link.download = `comprobante-${payment.id}.png`;
                            link.click();
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                        >
                          Ver
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(payment.id)}
                        className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Mensaje si no se encuentran resultados */}
                {searchTerm && filteredPayments.length === 0 && (
                    <p className="text-center text-slate-500 py-4">No se encontraron abonos con esa referencia.</p>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}