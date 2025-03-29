import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CasinoRewardsForm from '../components/CasinoRewardsForm';
import { supabase } from '../lib/supabaseClient';
import { UserFormData, FormState } from '../types'; 
import { Session } from '@supabase/supabase-js';

const convertFormStateToDbFormat = (formState: FormState): Omit<UserFormData, 'id' | 'user_id' | 'created_at' | 'updated_at'> => {
    return {
        last_collection_time: formState.last_collection_time || null,
        expected_reward: formState.expected_reward === '' ? null : Number(formState.expected_reward),
        tax_rate: formState.tax_rate === '' ? null : Number(formState.tax_rate),
        cc_return: formState.cc_return === '' ? null : Number(formState.cc_return),
        interest_rate: formState.interest_rate === '' ? null : Number(formState.interest_rate),
        time_zone: formState.time_zone || null,
        include_weekends: formState.include_weekends,
    };
};

const convertDbFormatToFormState = (dbData: UserFormData | null | undefined): FormState => {
    const now = new Date();
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
        last_collection_time: dbData?.last_collection_time ? new Date(dbData.last_collection_time).toISOString().slice(0, 16) : now.toISOString().slice(0, 16),
        expected_reward: dbData?.expected_reward?.toString() ?? '',
        tax_rate: dbData?.tax_rate?.toString() ?? '',
        cc_return: dbData?.cc_return?.toString() ?? '',
        interest_rate: dbData?.interest_rate?.toString() ?? '',
        time_zone: dbData?.time_zone ?? localTimeZone,
        include_weekends: dbData?.include_weekends ?? true,
    };
};

const CalculatorPage: React.FC = () => {
    const [userFormData, setUserFormData] = useState<UserFormData | null>(null);
    const [initialFormData, setInitialFormData] = useState<FormState | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
             setSession(session);
        });
        return () => { authListener?.subscription.unsubscribe(); };
    }, []);

    const fetchFormData = useCallback(async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('user_form_data')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle(); 

            if (fetchError) throw fetchError;

            setUserFormData(data);

        } catch (err: any) {
            console.error("Error fetching form data:", err);
            setError("Failed to load saved data. Please try again.");
            setUserFormData(null); 
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session?.user?.id) {
            fetchFormData(session.user.id);
        } else {
            setLoading(false);
            setUserFormData(null); 
        }
    }, [session, fetchFormData]);

    const initialFormDataMemo = useMemo(() => {
        return userFormData ? convertDbFormatToFormState(userFormData) : null;
    }, [userFormData]);

    const handleSaveData = async (currentFormData: FormState) => {
        if (!session?.user?.id) {
            setError("Cannot save data: User not logged in.");
            return false;
        }
        setIsSaving(true); 
        setError(null); // Clear previous errors
        setSaveSuccess(null); // Clear previous success message
        try {
            const dbData = {
                ...convertFormStateToDbFormat(currentFormData),
                user_id: session.user.id, 
            };

            const { data, error: saveError } = await supabase
                .from('user_form_data')
                .upsert(dbData, { onConflict: 'user_id' })
                .select() // Select the row after upsert
                .single(); // Expect a single row back

            if (saveError) {
                console.error("Error saving data:", saveError.message);
                throw saveError;
            }

            if (data) {
                // **Correction:** Update the userFormData state (which holds DB format)
                setUserFormData(data as UserFormData);
                setSaveSuccess("Data saved successfully!");
            } else {
                console.warn("Upsert did not return data as expected. Refetching might be needed.");
                // Maybe add a refetch here just in case
                // fetchFormData(session.user.id);
            }
 
            return true; // Indicate success
        } catch (err: any) {
            console.error("Error saving data:", err);
            setError(`Failed to save data: ${err.message || 'Unknown error'}`);
            return false; // Indicate failure
        } finally {
            setIsSaving(false);
        }
    };

    if (loading || !initialFormDataMemo) {
        return <div className="text-center mt-10">Loading calculator...</div>;
    }

    return (
        <div>
            {error && <p className="text-red-600 text-center mb-4">Error: {error}</p>}
            {saveSuccess && <p className="text-green-600 text-center mb-4">{saveSuccess}</p>}
            <CasinoRewardsForm 
                initialData={initialFormDataMemo} 
                onSave={handleSaveData} 
                isSaving={isSaving} 
            />
        </div>
    );
};

export default CalculatorPage;
