import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Order {
  id: string;
  user_id: string;
  order_date: string;
  customer_name: string;
  product_description: string;
  purchase_price: number;
  sale_price: number;
  profit: number;
  status: 'pendiente' | 'pagado';
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  reference_number: string;
  payment_image_url: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}
