import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, StickyNote } from 'lucide-react';
import { Note } from '../lib/supabase';

export function NotesModule() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotes();
    }
  }, [user]);

  const loadNotes = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setNotes(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !noteText.trim()) return;

    setLoading(true);
    try {
      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update({
            note_text: noteText,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingNote.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('notes').insert([
          {
            user_id: user.id,
            note_text: noteText,
          },
        ]);

        if (error) throw error;
      }

      setNoteText('');
      setEditingNote(null);
      setShowForm(false);
      await loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Error al guardar la nota');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setNoteText(note.note_text);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta nota?')) return;

    const { error } = await supabase.from('notes').delete().eq('id', id);

    if (!error) {
      loadNotes();
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingNote(null);
    setNoteText('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Notas</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nueva Nota
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {editingNote ? 'Editar Nota' : 'Nueva Nota'}
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 min-h-[120px]"
                placeholder="Escribe tus observaciones aquí..."
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !noteText.trim()}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : editingNote ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <StickyNote className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="text-slate-800 text-sm whitespace-pre-wrap">
                  {note.note_text}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {new Date(note.created_at).toLocaleDateString('es-VE', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(note)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {notes.length === 0 && !showForm && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No hay notas guardadas
          </div>
        )}
      </div>
    </div>
  );
}
