export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          role: 'consumer' | 'provider' | 'admin';
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          role?: 'consumer' | 'provider' | 'admin';
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          role?: 'consumer' | 'provider' | 'admin';
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      providers: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          instagram: string | null;
          description: string | null;
          profile_image_url: string | null;
          logo_image_url: string | null;
          logo_storage_path: string | null;
          mobile_service: boolean;
          street_address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          service_radius_miles: number;
          status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
          is_public: boolean;
          rejection_reason: string | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_name: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          instagram?: string | null;
          description?: string | null;
          profile_image_url?: string | null;
          logo_image_url?: string | null;
          logo_storage_path?: string | null;
          mobile_service?: boolean;
          street_address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          service_radius_miles?: number;
          status?: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
          is_public?: boolean;
          rejection_reason?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          business_name?: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          instagram?: string | null;
          description?: string | null;
          profile_image_url?: string | null;
          logo_image_url?: string | null;
          logo_storage_path?: string | null;
          mobile_service?: boolean;
          street_address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          service_radius_miles?: number;
          status?: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
          is_public?: boolean;
          rejection_reason?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          updated_at?: string;
        };
      };
      service_categories: {
        Row: {
          id: string;
          slug: string;
          label: string;
          icon: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          label: string;
          icon?: string | null;
          created_at?: string;
        };
        Update: {
          slug?: string;
          label?: string;
          icon?: string | null;
        };
      };
      provider_services: {
        Row: {
          id: string;
          provider_id: string;
          category_id: string;
          price_min: number | null;
          price_max: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          category_id: string;
          price_min?: number | null;
          price_max?: number | null;
          created_at?: string;
        };
        Update: {
          provider_id?: string;
          category_id?: string;
          price_min?: number | null;
          price_max?: number | null;
        };
      };
      vehicles: {
        Row: {
          id: string;
          user_id: string;
          year: number | null;
          make: string | null;
          model: string | null;
          trim: string | null;
          vin: string | null;
          color: string | null;
          mileage: number | null;
          plate: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year?: number | null;
          make?: string | null;
          model?: string | null;
          trim?: string | null;
          vin?: string | null;
          color?: string | null;
          mileage?: number | null;
          plate?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          year?: number | null;
          make?: string | null;
          model?: string | null;
          trim?: string | null;
          vin?: string | null;
          color?: string | null;
          mileage?: number | null;
          plate?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      service_records: {
        Row: {
          id: string;
          vehicle_id: string;
          user_id: string;
          provider_id: string | null;
          service_date: string | null;
          title: string | null;
          description: string | null;
          mileage: number | null;
          amount: number | null;
          document_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          user_id: string;
          provider_id?: string | null;
          service_date?: string | null;
          title?: string | null;
          description?: string | null;
          mileage?: number | null;
          amount?: number | null;
          document_url?: string | null;
        };
        Update: {
          service_date?: string | null;
          title?: string | null;
          description?: string | null;
          mileage?: number | null;
          amount?: number | null;
          document_url?: string | null;
          updated_at?: string;
        };
      };
      lead_requests: {
        Row: {
          id: string;
          provider_id: string;
          consumer_user_id: string;
          vehicle_id: string | null;
          service_category_id: string | null;
          service_needed: string | null;
          preferred_date: string | null;
          notes: string | null;
          contact_name: string;
          contact_phone: string | null;
          contact_email: string | null;
          vehicle_year: number | null;
          vehicle_make: string | null;
          vehicle_model: string | null;
          status: 'new' | 'viewed' | 'contacted' | 'closed' | 'spam';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          consumer_user_id: string;
          vehicle_id?: string | null;
          service_category_id?: string | null;
          service_needed?: string | null;
          preferred_date?: string | null;
          notes?: string | null;
          contact_name: string;
          contact_phone?: string | null;
          contact_email?: string | null;
          vehicle_year?: number | null;
          vehicle_make?: string | null;
          vehicle_model?: string | null;
          status?: 'new' | 'viewed' | 'contacted' | 'closed' | 'spam';
        };
        Update: {
          status?: 'new' | 'viewed' | 'contacted' | 'closed' | 'spam';
          updated_at?: string;
        };
      };
      provider_subscriptions: {
        Row: {
          id: string;
          provider_id: string;
          billing_mode: 'per_lead' | 'unlimited';
          status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_session_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          billing_mode?: 'per_lead' | 'unlimited';
          status?: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_session_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };
        Update: {
          billing_mode?: 'per_lead' | 'unlimited';
          status?: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_session_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          updated_at?: string;
        };
      };
      provider_lead_events: {
        Row: {
          id: string;
          provider_id: string;
          lead_request_id: string;
          event_type: 'lead_created' | 'lead_billed' | 'lead_included_unlimited' | 'duplicate_prevented' | 'manual_adjustment';
          amount: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          lead_request_id: string;
          event_type: 'lead_created' | 'lead_billed' | 'lead_included_unlimited' | 'duplicate_prevented' | 'manual_adjustment';
          amount?: number | null;
          notes?: string | null;
        };
        Update: never;
      };
      reviews: {
        Row: {
          id: string;
          provider_id: string;
          consumer_user_id: string;
          rating: number | null;
          title: string | null;
          body: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          consumer_user_id: string;
          rating?: number | null;
          title?: string | null;
          body?: string | null;
          is_public?: boolean;
        };
        Update: {
          rating?: number | null;
          title?: string | null;
          body?: string | null;
          is_public?: boolean;
          updated_at?: string;
        };
      };
      provider_approval_decisions: {
        Row: {
          id: string;
          provider_id: string;
          decision: 'approved' | 'rejected' | 'suspended' | 'resubmitted' | 'status_note';
          previous_status: string | null;
          new_status: string | null;
          notes: string | null;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          decision: 'approved' | 'rejected' | 'suspended' | 'resubmitted' | 'status_note';
          previous_status?: string | null;
          new_status?: string | null;
          notes?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Update: never;
      };
      provider_gallery_images: {
        Row: {
          id: string;
          provider_id: string;
          image_url: string;
          caption: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          image_url: string;
          caption?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          image_url?: string;
          caption?: string | null;
          sort_order?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      vehicle_photos: {
        Row: {
          id: string;
          vehicle_id: string;
          user_id: string;
          image_url: string;
          storage_path: string;
          caption: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          user_id: string;
          image_url: string;
          storage_path: string;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          caption?: string | null;
          sort_order?: number;
        };
      };
      lead_unlock_payments: {
        Row: {
          id: string;
          provider_id: string;
          lead_request_id: string;
          amount_cents: number;
          status: 'pending' | 'succeeded' | 'failed' | 'refunded';
          stripe_payment_intent_id: string | null;
          stripe_session_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          lead_request_id: string;
          amount_cents?: number;
          status?: 'pending' | 'succeeded' | 'failed' | 'refunded';
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string | null;
        };
        Update: {
          status?: 'pending' | 'succeeded' | 'failed' | 'refunded';
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string | null;
          updated_at?: string;
        };
      };
      lead_reveals: {
        Row: {
          id: string;
          provider_id: string;
          lead_request_id: string;
          reveal_type: 'subscription' | 'paid_unlock';
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          lead_request_id: string;
          reveal_type?: 'subscription' | 'paid_unlock';
          created_at?: string;
        };
        Update: never;
      };
      vehicle_service_records: {
        Row: {
          id: string;
          vehicle_id: string | null;
          vin: string;
          uploaded_by_user_id: string;
          provider_id: string | null;
          record_title: string;
          record_type: string | null;
          service_date: string | null;
          mileage: number | null;
          notes: string | null;
          file_url: string;
          file_storage_path: string;
          file_type: string | null;
          file_size_bytes: number | null;
          source_type: 'owner_upload' | 'provider_upload' | 'admin_upload';
          visibility: 'private_owner' | 'shared_with_current_owner' | 'shared_vehicle_history';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id?: string | null;
          vin: string;
          uploaded_by_user_id: string;
          provider_id?: string | null;
          record_title: string;
          record_type?: string | null;
          service_date?: string | null;
          mileage?: number | null;
          notes?: string | null;
          file_url: string;
          file_storage_path: string;
          file_type?: string | null;
          file_size_bytes?: number | null;
          source_type: 'owner_upload' | 'provider_upload' | 'admin_upload';
          visibility?: 'private_owner' | 'shared_with_current_owner' | 'shared_vehicle_history';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          record_title?: string;
          record_type?: string | null;
          service_date?: string | null;
          mileage?: number | null;
          notes?: string | null;
          file_url?: string;
          file_storage_path?: string;
          file_type?: string | null;
          file_size_bytes?: number | null;
          visibility?: 'private_owner' | 'shared_with_current_owner' | 'shared_vehicle_history';
          updated_at?: string;
        };
      };
      vehicle_service_record_access: {
        Row: {
          id: string;
          service_record_id: string;
          user_id: string;
          access_role: 'owner' | 'provider' | 'viewer';
          created_at: string;
        };
        Insert: {
          id?: string;
          service_record_id: string;
          user_id: string;
          access_role: 'owner' | 'provider' | 'viewer';
          created_at?: string;
        };
        Update: {
          access_role?: 'owner' | 'provider' | 'viewer';
        };
      };
    };
    Views: {
      lead_locked_preview: {
        Row: {
          id: string;
          provider_id: string;
          service_category_id: string | null;
          service_needed: string | null;
          preferred_date: string | null;
          vehicle_year: number | null;
          vehicle_make: string | null;
          status: 'new' | 'viewed' | 'contacted' | 'closed' | 'spam';
          created_at: string;
          service_category_label: string | null;
        };
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      provider_has_lead_access: {
        Args: { p_provider_id: string; p_lead_id: string };
        Returns: boolean;
      };
      reveal_lead_via_subscription: {
        Args: { p_lead_id: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Provider = Database['public']['Tables']['providers']['Row'];
export type ServiceCategory = Database['public']['Tables']['service_categories']['Row'];
export type ProviderService = Database['public']['Tables']['provider_services']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type ServiceRecord = Database['public']['Tables']['service_records']['Row'];
export type LeadRequest = Database['public']['Tables']['lead_requests']['Row'];
export type ProviderSubscription = Database['public']['Tables']['provider_subscriptions']['Row'];
export type ProviderLeadEvent = Database['public']['Tables']['provider_lead_events']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type ProviderApprovalDecision = Database['public']['Tables']['provider_approval_decisions']['Row'];
export type ProviderGalleryImage = Database['public']['Tables']['provider_gallery_images']['Row'];
export type LeadUnlockPayment = Database['public']['Tables']['lead_unlock_payments']['Row'];
export type LeadReveal = Database['public']['Tables']['lead_reveals']['Row'];
export type VehiclePhoto = Database['public']['Tables']['vehicle_photos']['Row'];
export type LeadLockedPreview = Database['public']['Views']['lead_locked_preview']['Row'];

export type VehicleServiceRecord = Database['public']['Tables']['vehicle_service_records']['Row'];
export type VehicleServiceRecordAccess = Database['public']['Tables']['vehicle_service_record_access']['Row'];

export type ProviderWithCategories = Provider & {
  provider_services: (ProviderService & {
    service_categories: ServiceCategory;
  })[];
};
