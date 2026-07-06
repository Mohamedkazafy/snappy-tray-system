export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      day_closings: {
        Row: {
          business_day: string
          closed_at: string
          closed_by: string | null
          closing_cash: number
          difference: number
          id: string
          notes: string | null
          opening_cash: number
          total_card: number
          total_cash: number
          total_other: number
          total_purchases: number
          total_sales: number
        }
        Insert: {
          business_day: string
          closed_at?: string
          closed_by?: string | null
          closing_cash?: number
          difference?: number
          id?: string
          notes?: string | null
          opening_cash?: number
          total_card?: number
          total_cash?: number
          total_other?: number
          total_purchases?: number
          total_sales?: number
        }
        Update: {
          business_day?: string
          closed_at?: string
          closed_by?: string | null
          closing_cash?: number
          difference?: number
          id?: string
          notes?: string | null
          opening_cash?: number
          total_card?: number
          total_cash?: number
          total_other?: number
          total_purchases?: number
          total_sales?: number
        }
        Relationships: []
      }
      dining_areas: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      dining_tables: {
        Row: {
          area_id: string
          id: string
          name: string
          seats: number
          status: Database["public"]["Enums"]["table_status"]
        }
        Insert: {
          area_id: string
          id?: string
          name: string
          seats?: number
          status?: Database["public"]["Enums"]["table_status"]
        }
        Update: {
          area_id?: string
          id?: string
          name?: string
          seats?: number
          status?: Database["public"]["Enums"]["table_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "dining_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cost: number
          id: string
          name: string
          notes: string | null
          order_id: string
          price: number
          product_id: string
          qty: number
          tax_rate: number
        }
        Insert: {
          cost?: number
          id?: string
          name: string
          notes?: string | null
          order_id: string
          price?: number
          product_id: string
          qty?: number
          tax_rate?: number
        }
        Update: {
          cost?: number
          id?: string
          name?: string
          notes?: string | null
          order_id?: string
          price?: number
          product_id?: string
          qty?: number
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          payment_method_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          payment_method_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          payment_method_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          business_day: string
          cost_total: number
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          discount: number
          id: string
          notes: string | null
          order_number: number
          paid_at: string | null
          sale_type: Database["public"]["Enums"]["sale_type"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          tax: number
          total: number
        }
        Insert: {
          business_day?: string
          cost_total?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          notes?: string | null
          order_number?: number
          paid_at?: string | null
          sale_type?: Database["public"]["Enums"]["sale_type"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax?: number
          total?: number
        }
        Update: {
          business_day?: string
          cost_total?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          notes?: string | null
          order_number?: number
          paid_at?: string | null
          sale_type?: Database["public"]["Enums"]["sale_type"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          id: string
          is_cash: boolean
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id?: string
          is_cash?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          is_cash?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category_id: string | null
          code: string | null
          cost: number
          created_at: string
          id: string
          name: string
          price: number
          product_type: Database["public"]["Enums"]["product_type"]
          tax_rate: number | null
          taxable: boolean
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          code?: string | null
          cost?: number
          created_at?: string
          id?: string
          name: string
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          tax_rate?: number | null
          taxable?: boolean
        }
        Update: {
          active?: boolean
          category_id?: string | null
          code?: string | null
          cost?: number
          created_at?: string
          id?: string
          name?: string
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          tax_rate?: number | null
          taxable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          cost: number
          id: string
          product_id: string
          purchase_id: string
          qty: number
          tax_rate: number
        }
        Insert: {
          cost: number
          id?: string
          product_id: string
          purchase_id: string
          qty: number
          tax_rate?: number
        }
        Update: {
          cost?: number
          id?: string
          product_id?: string
          purchase_id?: string
          qty?: number
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          business_day: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid: boolean
          purchase_number: number
          subtotal: number
          supplier_id: string | null
          tax: number
          total: number
          warehouse_id: string
        }
        Insert: {
          business_day?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid?: boolean
          purchase_number?: number
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
          warehouse_id: string
        }
        Update: {
          business_day?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid?: boolean
          purchase_number?: number
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          id: string
          ingredient_id: string
          product_id: string
          qty: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          product_id: string
          qty?: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_day_end: string
          business_day_start: string
          currency: string
          default_tax_rate: number
          id: number
          restaurant_name: string
          updated_at: string
        }
        Insert: {
          business_day_end?: string
          business_day_start?: string
          currency?: string
          default_tax_rate?: number
          id?: number
          restaurant_name?: string
          updated_at?: string
        }
        Update: {
          business_day_end?: string
          business_day_start?: string
          currency?: string
          default_tax_rate?: number
          id?: number
          restaurant_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock: {
        Row: {
          avg_cost: number
          min_qty: number
          product_id: string
          qty: number
          warehouse_id: string
        }
        Insert: {
          avg_cost?: number
          min_qty?: number
          product_id: string
          qty?: number
          warehouse_id: string
        }
        Update: {
          avg_cost?: number
          min_qty?: number
          product_id?: string
          qty?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          cost: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          qty: number
          reason: Database["public"]["Enums"]["stock_move_reason"]
          ref_id: string | null
          ref_type: string | null
          warehouse_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          qty: number
          reason: Database["public"]["Enums"]["stock_move_reason"]
          ref_id?: string | null
          ref_type?: string | null
          warehouse_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          qty?: number
          reason?: Database["public"]["Enums"]["stock_move_reason"]
          ref_id?: string | null
          ref_type?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          tax_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          active: boolean
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          _delta: number
          _note: string
          _product_id: string
          _warehouse_id: string
        }
        Returns: undefined
      }
      apply_stock_movement: {
        Args: {
          _cost: number
          _note: string
          _product_id: string
          _qty: number
          _reason: Database["public"]["Enums"]["stock_move_reason"]
          _ref_id: string
          _ref_type: string
          _warehouse_id: string
        }
        Returns: undefined
      }
      business_day_for: { Args: { ts: string }; Returns: string }
      complete_order: { Args: { _order_id: string }; Returns: undefined }
      default_warehouse_id: { Args: never; Returns: string }
      finalize_order: {
        Args: { _order_id: string; _payments: Json }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      receive_purchase: { Args: { _purchase_id: string }; Returns: undefined }
      record_order_payments: {
        Args: { _order_id: string; _payments: Json }
        Returns: undefined
      }
      transfer_stock: {
        Args: {
          _from_wh: string
          _note: string
          _product_id: string
          _qty: number
          _to_wh: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "cashier" | "waiter"
      order_status: "open" | "paid" | "void"
      product_type: "raw" | "manufactured" | "ready"
      sale_type: "takeaway" | "dinein" | "delivery" | "special"
      stock_move_reason:
        | "purchase"
        | "sale"
        | "adjust"
        | "transfer_in"
        | "transfer_out"
        | "issue"
        | "receive"
        | "count"
      table_status: "available" | "occupied" | "reserved" | "waiting_payment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cashier", "waiter"],
      order_status: ["open", "paid", "void"],
      product_type: ["raw", "manufactured", "ready"],
      sale_type: ["takeaway", "dinein", "delivery", "special"],
      stock_move_reason: [
        "purchase",
        "sale",
        "adjust",
        "transfer_in",
        "transfer_out",
        "issue",
        "receive",
        "count",
      ],
      table_status: ["available", "occupied", "reserved", "waiting_payment"],
    },
  },
} as const
