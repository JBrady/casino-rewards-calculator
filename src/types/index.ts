// src/types/index.ts

export interface UserFormData {
    // Corresponds to DB columns (nullable as they might not be saved yet)
    id?: string; // Primary key (optional on insert/update)
    user_id?: string; // Set automatically on save
    created_at?: string;
    updated_at?: string;

    last_collection_time?: string | null; // ISO string format
    expected_reward?: number | string | null; // Use string for input flexibility, number for db
    tax_rate?: number | string | null;
    cc_return?: number | string | null;
    interest_rate?: number | string | null;
    time_zone?: string | null;
    include_weekends?: boolean | null;
}

// Type specifically for the form state (using strings for input fields)
export interface FormState extends Omit<UserFormData, 'expected_reward' | 'tax_rate' | 'cc_return' | 'interest_rate' | 'include_weekends' | 'last_collection_time'> {
    last_collection_time: string;
    expected_reward: string;
    tax_rate: string;
    cc_return: string;
    interest_rate: string;
    time_zone: string;
    include_weekends: boolean;
}
