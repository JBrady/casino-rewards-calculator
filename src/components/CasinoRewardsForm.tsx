import React, { useState, useEffect, useCallback } from 'react';
import { FormState } from '../types'; // Import shared FormState type

// Define props for the component using the correct FormState type
interface CasinoRewardsFormProps {
  initialData: FormState;
  onSave: (currentFormData: FormState) => Promise<boolean>; // Function to call when saving
  isSaving: boolean; // Flag to indicate if parent is saving
}

// Define error record based on FormState keys
type FormErrors = Partial<Record<keyof FormState, string>> & { calculation?: string };

const CasinoRewardsForm: React.FC<CasinoRewardsFormProps> = ({ initialData, onSave, isSaving }) => {
  // Initialize state directly from the initialData prop using FormState
  const [formData, setFormData] = useState<FormState>(initialData);
  const [nextCollectionTime, setNextCollectionTime] = useState<string | null>(null);
  const [netReward, setNetReward] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({}); // Use the correctly typed FormErrors
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Update form state when initialData prop changes (e.g., after initial fetch)
  useEffect(() => {
    setFormData(initialData);
    // Reset calculation/save status when initial data changes
    setNextCollectionTime(null);
    setNetReward(null);
    setSaveStatus('idle');
    setErrors({}); // Clear errors when new initial data arrives
  }, [initialData]);

  const validateField = (name: keyof FormState, value: string | boolean): string => {
     // Ensure value is treated as string for most validations
     const stringValue = typeof value === 'boolean' ? '' : String(value ?? '').trim(); // Added nullish coalescing for safety

    switch (name) {
      case 'last_collection_time':
        // Check if the date string is valid after trimming
        if (!stringValue) return 'Last collection time is required.';
        if (isNaN(new Date(stringValue).getTime())) return 'Invalid date/time format.';
        return '';
      case 'expected_reward':
      case 'tax_rate':
      case 'cc_return':
      case 'interest_rate':
        if (stringValue === '') return ''; // Allow empty for optional fields
        const num = Number(stringValue);
        if (isNaN(num)) return 'Must be a valid number.';
        if (name === 'tax_rate' && (num < 0 || num > 100)) return 'Must be between 0 and 100.';
        if (name === 'expected_reward' && num < 0) return 'Cannot be negative.';
        // Add other specific range checks if needed (e.g., for cc_return, interest_rate)
        if ((name === 'cc_return' || name === 'interest_rate') && num < 0) return 'Cannot be negative.';
        return '';
      case 'time_zone':
            if (!stringValue) return 'Time zone is required.';
            try {
                // Use the value directly for the check
                Intl.DateTimeFormat(undefined, { timeZone: value as string });
                return '';
            } catch (ex) {
                return 'Invalid time zone selected';
            }
      case 'include_weekends':
            return ''; // Boolean value, no string validation needed here
      default:
        // This should technically be unreachable if all keys are handled.
        // Removing the `never` assignment to resolve the persistent lint error.
        console.warn(`Unhandled validation case in switch: ${name}`);
        return '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const fieldName = name as keyof FormState;
    let processedValue: string | boolean = value;

    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    }

    const error = validateField(fieldName, processedValue);

    setFormData(prev => ({
      ...prev,
      [fieldName]: processedValue
    }));

    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));

    // Clear calculation results when inputs change
    setNextCollectionTime(null);
    setNetReward(null);
    setSaveStatus('idle'); // Reset save status if user changes data
  };

  const runAllValidations = useCallback((): boolean => {
      const newErrors: FormErrors = {};
      let hasErrors = false;
      // Iterate over keys of the current formData state to validate
      (Object.keys(formData) as Array<keyof FormState>).forEach(key => {
          // Ensure the value passed to validateField is never undefined.
          const value = formData[key];
          let error = '';
          if (key === 'include_weekends') {
              // Handle boolean case explicitly
              error = validateField(key, typeof value === 'boolean' ? value : false); // Default boolean to false if undefined/wrong type
          } else {
              // Handle string cases explicitly
              error = validateField(key, typeof value === 'string' ? value : ''); // Default strings to '' if undefined/wrong type
          }
          
          if (error) {
              newErrors[key] = error;
              hasErrors = true;
          }
      });
      setErrors(newErrors);
      return !hasErrors; // Return true if valid (no errors)
  }, [formData]);

  const calculateNextCollection = useCallback(() => {
    const { last_collection_time, time_zone, include_weekends } = formData;
    // Add validation check within calculation as well
    if (!last_collection_time || !time_zone || validateField('last_collection_time', last_collection_time) || validateField('time_zone', time_zone)) {
        setErrors(prev => ({ ...prev, calculation: "Missing or invalid required fields for calculation (Time, Timezone)." }));
        return null;
    }

    try {
        // Parse the datetime-local string. It represents local time.
        const lastCollectionDate = new Date(last_collection_time);
        if (isNaN(lastCollectionDate.getTime())) throw new Error("Invalid Date format from input");

        let nextCollectionDate = new Date(lastCollectionDate);

        const hoursToAdd = 24; // Assuming a 24-hour cycle
        nextCollectionDate.setHours(nextCollectionDate.getHours() + hoursToAdd);

        if (!include_weekends) {
            let dayOfWeek = nextCollectionDate.getDay(); // 0 = Sunday, 6 = Saturday
            // Adjust forward past Saturday and Sunday
            while (dayOfWeek === 6 || dayOfWeek === 0) { 
                nextCollectionDate.setDate(nextCollectionDate.getDate() + 1);
                dayOfWeek = nextCollectionDate.getDay();
            }
        }

        // Format the output using the specified timezone
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: 'numeric',
            timeZone: time_zone, // Use the selected time_zone from state
            hour12: true
        };
        // Use 'lookup' matcher for potentially better cross-browser consistency with IANA names
        return new Intl.DateTimeFormat('en-US', options).format(nextCollectionDate);

    } catch (error: any) {
        console.error("Error calculating next collection:", error);
        setErrors(prev => ({ ...prev, calculation: `Calculation Error: ${error.message || "Check date/time inputs."}` }));
        return null;
    }
  }, [formData]);

  const calculateNetReward = useCallback((): number | null => {
    const { expected_reward, tax_rate, cc_return, interest_rate } = formData;
    // Use parseFloat for potentially decimal inputs, provide default 0 if empty/invalid
    // Use String() constructor to handle potential null/undefined safely before parseFloat
    const reward = parseFloat(String(expected_reward ?? '')) || 0;
    const tax = (parseFloat(String(tax_rate ?? '')) || 0) / 100;
    const cc = (parseFloat(String(cc_return ?? '')) || 0) / 100;
    const interest = (parseFloat(String(interest_rate ?? '')) || 0) / 100;

    if (reward <= 0) {
         // Don't calculate if reward is zero or negative or invalid
         // Clear potential previous calculation error
         setErrors(prev => { 
             const { calculation, ...rest } = prev; 
             return { ...rest }; 
         });
        return null;
    }

    const taxAmount = reward * tax;
    const ccValue = reward * cc;
    const interestCost = reward * interest; // Assuming interest is a cost

    return reward - taxAmount + ccValue - interestCost;
  }, [formData]);

  const handleCalculate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // Run validations before calculating
    if (!runAllValidations()) {
        alert("Please fix the errors highlighted in the form before calculating.");
        return;
    }
    setErrors(prev => { // Clear previous calculation error if any
        const { calculation, ...rest } = prev; 
        return { ...rest }; 
    }); 
    setNextCollectionTime(calculateNextCollection());
    setNetReward(calculateNetReward());
  };

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // Run validations before saving
    if (!runAllValidations()) {
        alert("Please fix the errors highlighted in the form before saving.");
        return;
    }
    setSaveStatus('saving');
    const success = await onSave(formData); // Call the prop function with current FormState data
    setSaveStatus(success ? 'success' : 'error');

    if (success) {
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Memoize time zone options to prevent re-computation on every render
  const timeZoneOptions = React.useMemo(() => 
      Intl.supportedValuesOf('timeZone').map(tz => (
          <option key={tz} value={tz}>{tz}</option>
      )), 
  []);

  const isDisabled = isSaving || saveStatus === 'saving';

  return (
    // Use onSubmit on the form for accessibility (Enter key)
    // Add noValidate to disable default browser validation bubbles
    <form onSubmit={(e) => { e.preventDefault(); handleCalculate(e as any); }} noValidate className="bg-gray-800 text-white p-6 rounded-lg shadow-xl space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Last Collection Time */}
        <div className="col-span-1">
          <label htmlFor="last_collection_time" className="block text-sm font-medium text-gray-300">Last Collection Time <span className="text-red-500">*</span></label>
          <input
            type="datetime-local"
            id="last_collection_time"
            name="last_collection_time" // Matches FormState key
            value={formData.last_collection_time}
            onChange={handleInputChange}
            disabled={isDisabled}
            required // HTML5 validation attribute (optional, supplements JS validation)
            className={`mt-1 block w-full bg-gray-700 border ${errors.last_collection_time ? 'border-red-500' : 'border-gray-600'} rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          {errors.last_collection_time && <p className="mt-1 text-xs text-red-400">{errors.last_collection_time}</p>}
        </div>

        {/* Expected Reward */}
        <div className="col-span-1">
          <label htmlFor="expected_reward" className="block text-sm font-medium text-gray-300">Expected Reward ($)</label>
          <input
            type="number"
            id="expected_reward"
            name="expected_reward" // Matches FormState key
            value={formData.expected_reward}
            onChange={handleInputChange}
            disabled={isDisabled}
            min="0" // Allow 0, validation handles negative
            step="0.01"
            placeholder="e.g., 10.50"
            className={`mt-1 block w-full bg-gray-700 border ${errors.expected_reward ? 'border-red-500' : 'border-gray-600'} rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          {errors.expected_reward && <p className="mt-1 text-xs text-red-400">{errors.expected_reward}</p>}
        </div>

         {/* Tax Rate (%) */}
         <div className="col-span-1">
          <label htmlFor="tax_rate" className="block text-sm font-medium text-gray-300">Tax Rate (%)</label>
          <input
            type="number"
            id="tax_rate"
            name="tax_rate" // Matches FormState key
            value={formData.tax_rate}
            onChange={handleInputChange}
            disabled={isDisabled}
            min="0"
            max="100"
            step="0.1" // Or "any"
            placeholder="e.g., 15"
            className={`mt-1 block w-full bg-gray-700 border ${errors.tax_rate ? 'border-red-500' : 'border-gray-600'} rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          {errors.tax_rate && <p className="mt-1 text-xs text-red-400">{errors.tax_rate}</p>}
        </div>

        {/* Credit Card Return (%) */}
        <div className="col-span-1">
          <label htmlFor="cc_return" className="block text-sm font-medium text-gray-300">Credit Card Return (%)</label>
          <input
            type="number"
            id="cc_return"
            name="cc_return" // Matches FormState key
            value={formData.cc_return}
            onChange={handleInputChange}
            disabled={isDisabled}
            min="0"
            step="0.1" // Or "any"
            placeholder="e.g., 1.5"
            className={`mt-1 block w-full bg-gray-700 border ${errors.cc_return ? 'border-red-500' : 'border-gray-600'} rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          {errors.cc_return && <p className="mt-1 text-xs text-red-400">{errors.cc_return}</p>}
        </div>

        {/* Interest Rate / Opportunity Cost (%) */}
        <div className="col-span-1">
          <label htmlFor="interest_rate" className="block text-sm font-medium text-gray-300">Interest/Opportunity Cost (%)</label>
          <input
            type="number"
            id="interest_rate"
            name="interest_rate" // Matches FormState key
            value={formData.interest_rate}
            onChange={handleInputChange}
            disabled={isDisabled}
            min="0"
            step="0.1" // Or "any"
            placeholder="e.g., 0.5"
            className={`mt-1 block w-full bg-gray-700 border ${errors.interest_rate ? 'border-red-500' : 'border-gray-600'} rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          {errors.interest_rate && <p className="mt-1 text-xs text-red-400">{errors.interest_rate}</p>}
        </div>

        {/* Time Zone Dropdown */}
        <div className="col-span-1">
          <label htmlFor="time_zone" className="block text-sm font-medium text-gray-300">Your Time Zone <span className="text-red-500">*</span></label>
          <select
            id="time_zone"
            name="time_zone" // Matches FormState key
            value={formData.time_zone}
            onChange={handleInputChange}
            disabled={isDisabled}
            required
            className={`mt-1 block w-full bg-gray-700 border ${errors.time_zone ? 'border-red-500' : 'border-gray-600'} rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
              <option value="">-- Select Time Zone --</option>
              {timeZoneOptions}
          </select>
          {errors.time_zone && <p className="mt-1 text-xs text-red-400">{errors.time_zone}</p>}
        </div>

        {/* Include Weekends Checkbox */}
        <div className="flex items-center md:col-span-2"> {/* Span full width on medium screens and up */}
          <input
            id="include_weekends"
            name="include_weekends" // Matches FormState key
            type="checkbox"
            checked={formData.include_weekends}
            onChange={handleInputChange}
            disabled={isDisabled}
            className={`h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 rounded bg-gray-700 ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          <label htmlFor="include_weekends" className="ml-2 block text-sm text-gray-300">
            Include Weekends in Next Collection Calculation
          </label>
        </div>
      </div>

      {/* Buttons Container */}
      <div className="col-span-2 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4 pt-4 border-t border-gray-700">
          {/* Save Button - Type "button" to prevent form submission */} 
           <button
              type="button" // Important: Prevent default form submission
              onClick={handleSave}
              disabled={isDisabled}
              className={`w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isDisabled ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Data'}
          </button>

          {/* Calculate Button - Now primary action via form onSubmit */} 
          <button
            type="submit" // Triggers form onSubmit
            disabled={isDisabled} // Also disable calculation while saving
            className={`w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isDisabled ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'}`}
          >
            Calculate
          </button>
      </div>

      {/* Save Status Messages */}
      <div className="col-span-2 text-center h-4"> {/* Added height to prevent layout shift */}
          {saveStatus === 'success' && <p className="text-sm text-green-400">Data saved successfully!</p>}
          {saveStatus === 'error' && <p className="text-sm text-red-400">Failed to save data.</p>}
      </div>

      {/* Calculation Results */}
      <div className="col-span-2 mt-6 p-4 bg-gray-900 rounded">
        <h3 className="text-lg font-medium text-center text-indigo-400 mb-3">Results</h3>
        {errors.calculation && <p className="text-center text-red-400 mb-2 text-sm">{errors.calculation}</p>}
        {nextCollectionTime && (
          <p className="text-center text-gray-300">
            Next Collection Available: <strong className="text-green-400">{nextCollectionTime}</strong>
          </p>
        )}
        {netReward !== null && (
          <p className="text-center text-gray-300 mt-2">
            Estimated Net Reward: <strong className="text-yellow-400">${netReward.toFixed(2)}</strong>
          </p>
        )}
        {nextCollectionTime === null && netReward === null && !errors.calculation && (
          <p className="text-center text-gray-500">Enter details and click Calculate.</p>
        )}
      </div>
    </form>
  );
};

export default CasinoRewardsForm;
